import { Router } from "express";
import { db, telegramSubscriptionsTable, visitRequestsTable, visitorsTable, usersTable, branchesTable, organizationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole, loadPermissions } from "../lib/auth.js";
import { generateId } from "../lib/id.js";
import * as TG from "../lib/telegram.js";

const router = Router();

// In-memory link code map (token → userId). For production, store in DB with TTL.
const linkCodes = new Map<string, { userId: string; expiresAt: Date }>();

function generateLinkCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// GET /api/telegram/status
router.get("/status", requireAuth, async (req, res) => {
  const user = req.user!;
  const configured = TG.isConfigured();

  const subs = await db.select().from(telegramSubscriptionsTable)
    .where(and(eq(telegramSubscriptionsTable.userId, user.id), eq(telegramSubscriptionsTable.isActive, true)))
    .limit(1);

  res.json({
    botConfigured: configured,
    linked: subs.length > 0,
    subscription: subs[0] || null,
  });
});

// POST /api/telegram/generate-link-code
// Generates a short code the user sends to the bot to link their account
router.post("/generate-link-code", requireAuth, async (req, res) => {
  const user = req.user!;
  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  linkCodes.set(code, { userId: user.id, expiresAt });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const botUsername = token ? await getBotUsername() : null;

  res.json({
    code,
    expiresAt,
    botUsername,
    instructions: botUsername
      ? `Open Telegram, message @${botUsername}, and send: /link ${code}`
      : `Open Telegram, message the bot, and send: /link ${code}`,
  });
});

async function getBotUsername(): Promise<string | null> {
  try {
    const res = await TG.getBotInfo() as { ok: boolean; result?: { username?: string } };
    if (res.ok && res.result) return res.result.username || null;
    return null;
  } catch {
    return null;
  }
}

// POST /api/telegram/unlink
router.post("/unlink", requireAuth, async (req, res) => {
  const user = req.user!;
  await db.update(telegramSubscriptionsTable)
    .set({ isActive: false })
    .where(eq(telegramSubscriptionsTable.userId, user.id));

  res.json({ success: true, message: "Telegram account unlinked" });
});

// PATCH /api/telegram/preferences
router.patch("/preferences", requireAuth, async (req, res) => {
  const user = req.user!;
  const { notifyApprovals, notifyCheckIns, notifyWalkIns, notifyRejections } = req.body;

  const updates: Record<string, boolean> = {};
  if (notifyApprovals !== undefined) updates.notifyApprovals = notifyApprovals;
  if (notifyCheckIns !== undefined) updates.notifyCheckIns = notifyCheckIns;
  if (notifyWalkIns !== undefined) updates.notifyWalkIns = notifyWalkIns;
  if (notifyRejections !== undefined) updates.notifyRejections = notifyRejections;

  await db.update(telegramSubscriptionsTable)
    .set(updates)
    .where(and(eq(telegramSubscriptionsTable.userId, user.id), eq(telegramSubscriptionsTable.isActive, true)));

  res.json({ success: true });
});

// POST /api/telegram/test
router.post("/test", requireAuth, async (req, res) => {
  const user = req.user!;
  const subs = await db.select().from(telegramSubscriptionsTable)
    .where(and(eq(telegramSubscriptionsTable.userId, user.id), eq(telegramSubscriptionsTable.isActive, true)))
    .limit(1);

  if (!subs[0]) {
    res.status(400).json({ error: "No Telegram account linked" });
    return;
  }

  const result = await TG.sendTelegramMessage(
    subs[0].chatId,
    `<b>✅ Ventry Test Notification</b>\n\nYour Telegram is connected and working correctly.\n\n👤 Account: <b>${user.name}</b>`
  );

  res.json({ success: result.ok, description: result.description });
});

// POST /api/telegram/webhook  ← Telegram sends updates here
router.post("/webhook", async (req, res) => {
  // Respond immediately — Telegram requires 2xx within 3 seconds
  res.sendStatus(200);

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const headerToken = req.headers["x-telegram-bot-api-secret-token"];
    if (headerToken !== webhookSecret) return;
  }

  const update = req.body;

  const callbackQuery = update?.callback_query;
  if (callbackQuery) {
    const cbChatId = callbackQuery.message?.chat?.id;
    const cbMessageId = callbackQuery.message?.message_id;
    const cbData = callbackQuery.data as string;
    const cbQueryId = callbackQuery.id;

    if (!cbChatId || !cbData) return;

    await TG.answerCallbackQuery(cbQueryId);

    const subs = await db.select().from(telegramSubscriptionsTable)
      .where(and(eq(telegramSubscriptionsTable.chatId, cbChatId.toString()), eq(telegramSubscriptionsTable.isActive, true)))
      .limit(1);
    if (!subs[0]) {
      await TG.editMessageText(cbChatId, cbMessageId, "❌ Your account is not linked. Send /link CODE first.");
      return;
    }

    const userId = subs[0].userId;
    const cbUser = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
    if (!cbUser) return;

    const userPerms = await loadPermissions(cbUser.role, cbUser.roleId);
    if (!userPerms.includes("visit_requests.approve")) {
      await TG.editMessageText(cbChatId, cbMessageId, "❌ You don't have permission to approve/reject visit requests.");
      return;
    }

    if (cbData.startsWith("approve_")) {
      const requestId = cbData.replace("approve_", "");
      const request = (await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, requestId)).limit(1))[0];

      if (!request || request.status !== "pending") {
        await TG.editMessageText(cbChatId, cbMessageId, "❌ Request not found or already processed.");
        return;
      }

      if (request.orgId !== cbUser.orgId) {
        await TG.editMessageText(cbChatId, cbMessageId, "❌ This request does not belong to your organization.");
        return;
      }

      if (cbUser.branchId && request.branchId !== cbUser.branchId) {
        await TG.editMessageText(cbChatId, cbMessageId, "❌ This request is not in your assigned branch.");
        return;
      }

      const { generateQrCode, generateToken } = await import("../lib/id.js");
      const { addHours } = await import("../lib/dateUtils.js");
      const qrCode = request.qrCode || generateQrCode();
      const trackingToken = request.trackingToken || generateToken(16);

      await db.update(visitRequestsTable).set({
        status: "approved", approvedById: userId, approvedAt: new Date(),
        approvalMethod: "telegram", qrCode, qrExpiresAt: addHours(new Date(), 24), trackingToken,
      }).where(eq(visitRequestsTable.id, requestId));

      const visitor = (await db.select().from(visitorsTable).where(eq(visitorsTable.id, request.visitorId)).limit(1))[0];

      await TG.editMessageText(cbChatId, cbMessageId,
        `<b>✅ Approved by ${cbUser.name}</b>\n\n` +
        `👤 ${visitor?.fullName || "Unknown"}\n` +
        `📋 ${request.purpose}\n` +
        `📅 ${request.scheduledDate}\n\n` +
        `🎫 QR: <code>${qrCode}</code>`
      );

      if (visitor?.email) {
        try {
          const { sendEmail, buildVisitApprovedEmail, getBaseUrl } = await import("../lib/email.js");
          const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, request.orgId)).limit(1);
          const baseUrl = getBaseUrl(req);
          await sendEmail({
            to: visitor.email,
            subject: `Your visit to ${org?.name || "the organization"} has been approved`,
            html: buildVisitApprovedEmail({
              visitorName: visitor.fullName, organizationName: org?.name || "the organization",
              scheduledDate: request.scheduledDate, scheduledTime: request.scheduledTimeFrom || undefined,
              passLink: `${baseUrl}/public/pass/${trackingToken}`, qrCode,
            }),
          });
        } catch (e) { console.error("Email after Telegram approve:", e); }
      }
      return;
    }

    if (cbData.startsWith("reject_")) {
      const requestId = cbData.replace("reject_", "");
      const request = (await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, requestId)).limit(1))[0];

      if (!request || request.status !== "pending") {
        await TG.editMessageText(cbChatId, cbMessageId, "❌ Request not found or already processed.");
        return;
      }

      if (request.orgId !== cbUser.orgId) {
        await TG.editMessageText(cbChatId, cbMessageId, "❌ This request does not belong to your organization.");
        return;
      }

      if (cbUser.branchId && request.branchId !== cbUser.branchId) {
        await TG.editMessageText(cbChatId, cbMessageId, "❌ This request is not in your assigned branch.");
        return;
      }

      await db.update(visitRequestsTable).set({
        status: "rejected", approvedById: userId, approvedAt: new Date(), rejectionReason: "Rejected via Telegram",
      }).where(eq(visitRequestsTable.id, requestId));

      const visitor = (await db.select().from(visitorsTable).where(eq(visitorsTable.id, request.visitorId)).limit(1))[0];

      await TG.editMessageText(cbChatId, cbMessageId,
        `<b>❌ Rejected by ${cbUser.name}</b>\n\n` +
        `👤 ${visitor?.fullName || "Unknown"}\n` +
        `📋 ${request.purpose}`
      );

      if (visitor?.email) {
        try {
          const { sendEmail, buildVisitRejectedEmail } = await import("../lib/email.js");
          const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, request.orgId)).limit(1);
          sendEmail({
            to: visitor.email,
            subject: `Your visit request to ${org?.name || "the organization"} was declined`,
            html: buildVisitRejectedEmail({
              visitorName: visitor.fullName, organizationName: org?.name || "the organization",
              rejectionReason: "Rejected via Telegram",
            }),
          }).catch(console.error);
        } catch (e) { console.error("Email after Telegram reject:", e); }
      }
      return;
    }

    return;
  }

  const message = update?.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = (message.text as string).trim();
  const firstName = message.from?.first_name || "there";
  const username = message.from?.username;

  // /start
  if (text === "/start" || text.startsWith("/start ")) {
    await TG.sendTelegramMessage(chatId,
      `<b>👋 Welcome to Ventry Bot, ${firstName}!</b>\n\n` +
      `I can send you real-time notifications about visitor activity.\n\n` +
      `<b>Getting started:</b>\n` +
      `1. Log in to your Ventry portal\n` +
      `2. Go to <b>Notifications → Telegram</b>\n` +
      `3. Generate a link code\n` +
      `4. Send <code>/link YOUR_CODE</code> here\n\n` +
      `Need help? Contact your administrator.`
    );
    return;
  }

  // /link CODE
  if (text.startsWith("/link ")) {
    const code = text.split(" ")[1]?.toUpperCase().trim();
    if (!code) {
      await TG.sendTelegramMessage(chatId, "❌ Usage: <code>/link YOUR_CODE</code>");
      return;
    }

    const entry = linkCodes.get(code);
    if (!entry || entry.expiresAt < new Date()) {
      linkCodes.delete(code);
      await TG.sendTelegramMessage(chatId,
        "❌ <b>Invalid or expired code.</b>\n\nPlease generate a new code from the Ventry portal."
      );
      return;
    }

    const { userId } = entry;
    linkCodes.delete(code);

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user) {
      await TG.sendTelegramMessage(chatId, "❌ User not found. Please try again.");
      return;
    }

    await db.delete(telegramSubscriptionsTable).where(eq(telegramSubscriptionsTable.userId, userId));

    await db.insert(telegramSubscriptionsTable).values({
      id: generateId(),
      userId,
      orgId: user.orgId || null,
      chatId: chatId.toString(),
      username: username || null,
      firstName,
      notifyApprovals: true,
      notifyCheckIns: true,
      notifyWalkIns: true,
      notifyRejections: false,
      isActive: true,
    });

    await TG.sendTelegramMessage(chatId,
      `<b>✅ Account linked successfully!</b>\n\n` +
      `👤 <b>${user.name}</b> (${user.role.replace('_', ' ')})\n` +
      (user.orgId ? `🏢 ${(await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.orgId!)).limit(1))[0]?.name || ''}\n` : '') +
      `\nYou will now receive real-time visitor notifications here.\n\n` +
      `Send /help to see available commands.`
    );
    return;
  }

  // /help
  if (text === "/help") {
    await TG.sendTelegramMessage(chatId,
      `<b>Ventry Bot Commands</b>\n\n` +
      `/start — Welcome message\n` +
      `/link CODE — Link your Ventry account\n` +
      `/pending — View and manage pending requests\n` +
      `/status — Check your notification settings\n` +
      `/unlink — Disconnect your account\n` +
      `/help — Show this message`
    );
    return;
  }

  // /status
  if (text === "/status") {
    const subs = await db.select().from(telegramSubscriptionsTable)
      .where(and(eq(telegramSubscriptionsTable.chatId, chatId.toString()), eq(telegramSubscriptionsTable.isActive, true)))
      .limit(1);

    if (!subs[0]) {
      await TG.sendTelegramMessage(chatId,
        "❌ No linked account found.\n\nSend /link YOUR_CODE to connect your Ventry account."
      );
      return;
    }

    const sub = subs[0];
    await TG.sendTelegramMessage(chatId,
      `<b>📊 Your Notification Status</b>\n\n` +
      `✅ Approvals: ${sub.notifyApprovals ? 'On' : 'Off'}\n` +
      `✅ Check-ins: ${sub.notifyCheckIns ? 'On' : 'Off'}\n` +
      `✅ Walk-ins: ${sub.notifyWalkIns ? 'On' : 'Off'}\n` +
      `✅ Rejections: ${sub.notifyRejections ? 'On' : 'Off'}\n\n` +
      `Manage settings in your Ventry portal → Notifications → Telegram.`
    );
    return;
  }

  // /pending — List pending visit requests
  if (text === "/pending") {
    const subs = await db.select().from(telegramSubscriptionsTable)
      .where(and(eq(telegramSubscriptionsTable.chatId, chatId.toString()), eq(telegramSubscriptionsTable.isActive, true)))
      .limit(1);
    if (!subs[0]) {
      await TG.sendTelegramMessage(chatId, "❌ No linked account. Send /link CODE first.");
      return;
    }

    const userId = subs[0].userId;
    const pendingUser = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
    if (!pendingUser || !pendingUser.orgId) {
      await TG.sendTelegramMessage(chatId, "❌ User not found.");
      return;
    }

    const pendingPerms = await loadPermissions(pendingUser.role, pendingUser.roleId);
    if (!pendingPerms.includes("visit_requests.approve")) {
      await TG.sendTelegramMessage(chatId, "❌ You don't have permission to manage visit requests.");
      return;
    }

    let pending = await db.select().from(visitRequestsTable)
      .where(and(eq(visitRequestsTable.orgId, pendingUser.orgId), eq(visitRequestsTable.status, "pending")));

    if (pendingUser.branchId) {
      pending = pending.filter(r => r.branchId === pendingUser.branchId);
    }

    if (pending.length === 0) {
      await TG.sendTelegramMessage(chatId, "✅ No pending visit requests. All clear!");
      return;
    }

    for (const r of pending.slice(0, 10)) {
      const visitor = (await db.select().from(visitorsTable).where(eq(visitorsTable.id, r.visitorId)).limit(1))[0];
      const [branch] = r.branchId ? await db.select().from(branchesTable).where(eq(branchesTable.id, r.branchId)).limit(1) : [null];

      const msg = `<b>⏳ Pending Request</b>\n\n` +
        `👤 <b>${visitor?.fullName || "Unknown"}</b>\n` +
        `📋 ${r.purpose}\n` +
        `🏢 ${branch?.name || "—"}\n` +
        `📅 ${r.scheduledDate}` +
        (r.scheduledTimeFrom ? ` at ${r.scheduledTimeFrom}` : "") +
        `\n📝 Type: ${r.type.replace("_", " ")}`;

      const buttons = [[
        { text: "✅ Approve", callback_data: `approve_${r.id}` },
        { text: "❌ Reject", callback_data: `reject_${r.id}` },
      ]];

      await TG.sendTelegramMessageWithButtons(chatId, msg, buttons);
    }

    if (pending.length > 10) {
      await TG.sendTelegramMessage(chatId, `... and ${pending.length - 10} more. Check the portal for the full list.`);
    }
    return;
  }

  // /unlink
  if (text === "/unlink") {
    const deleted = await db.delete(telegramSubscriptionsTable)
      .where(and(eq(telegramSubscriptionsTable.chatId, chatId.toString()), eq(telegramSubscriptionsTable.isActive, true)));

    await TG.sendTelegramMessage(chatId,
      "✅ Your account has been unlinked. You will no longer receive notifications.\n\nSend /link CODE to reconnect."
    );
    return;
  }

  // /approve_REQUESTID
  if (text.startsWith("/approve_")) {
    const shortId = text.split("_")[1]?.trim();
    if (!shortId) {
      await TG.sendTelegramMessage(chatId, "❌ Invalid command format.");
      return;
    }

    const subs = await db.select().from(telegramSubscriptionsTable)
      .where(and(eq(telegramSubscriptionsTable.chatId, chatId.toString()), eq(telegramSubscriptionsTable.isActive, true)))
      .limit(1);
    if (!subs[0]) {
      await TG.sendTelegramMessage(chatId, "❌ Your account is not linked. Send /link CODE first.");
      return;
    }

    const userId = subs[0].userId;
    const user = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
    if (!user) {
      await TG.sendTelegramMessage(chatId, "❌ User account not found.");
      return;
    }

    const userPerms = await loadPermissions(user.role, user.roleId);
    if (!userPerms.includes("visit_requests.approve")) {
      await TG.sendTelegramMessage(chatId, "❌ You don't have permission to approve visit requests.");
      return;
    }

    const allRequests = await db.select().from(visitRequestsTable)
      .where(user.orgId ? eq(visitRequestsTable.orgId, user.orgId) : undefined as any);
    const request = allRequests.find(r => {
      if (!r.id.startsWith(shortId) || r.status !== "pending") return false;
      if (user.branchId && r.branchId !== user.branchId) return false;
      return true;
    });

    if (!request) {
      await TG.sendTelegramMessage(chatId, "❌ Visit request not found or already processed.");
      return;
    }

    const { generateQrCode, generateToken } = await import("../lib/id.js");
    const { addHours } = await import("../lib/dateUtils.js");

    const qrCode = request.qrCode || generateQrCode();
    const trackingToken = request.trackingToken || generateToken(16);

    await db.update(visitRequestsTable).set({
      status: "approved",
      approvedById: userId,
      approvedAt: new Date(),
      approvalMethod: "telegram",
      qrCode,
      qrExpiresAt: addHours(new Date(), 24),
      trackingToken,
    }).where(eq(visitRequestsTable.id, request.id));

    const visitor = (await db.select().from(visitorsTable).where(eq(visitorsTable.id, request.visitorId)).limit(1))[0];

    await TG.sendTelegramMessage(chatId,
      `<b>✅ Visit Approved!</b>\n\n` +
      `👤 ${visitor?.fullName || "Unknown"}\n` +
      `📋 ${request.purpose}\n` +
      `📅 ${request.scheduledDate}\n\n` +
      `The visitor will receive their QR pass.`
    );

    if (visitor?.email) {
      try {
        const { sendEmail, buildVisitApprovedEmail } = await import("../lib/email.js");
        const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, request.orgId)).limit(1);
        const baseUrl = process.env.APP_URL || process.env.APP_BASE_URL || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
        const passLink = `${baseUrl}/public/pass/${trackingToken}`;
        await sendEmail({
          to: visitor.email,
          subject: `Your visit to ${org?.name || "the organization"} has been approved`,
          html: buildVisitApprovedEmail({
            visitorName: visitor.fullName,
            organizationName: org?.name || "the organization",
            scheduledDate: request.scheduledDate,
            scheduledTime: request.scheduledTimeFrom || undefined,
            passLink,
            qrCode,
          }),
        });
      } catch (e) { console.error("Email after Telegram approve:", e); }
    }
    return;
  }

  // /reject_REQUESTID
  if (text.startsWith("/reject_")) {
    const shortId = text.split("_")[1]?.trim();
    if (!shortId) {
      await TG.sendTelegramMessage(chatId, "❌ Invalid command format.");
      return;
    }

    const subs = await db.select().from(telegramSubscriptionsTable)
      .where(and(eq(telegramSubscriptionsTable.chatId, chatId.toString()), eq(telegramSubscriptionsTable.isActive, true)))
      .limit(1);
    if (!subs[0]) {
      await TG.sendTelegramMessage(chatId, "❌ Your account is not linked.");
      return;
    }

    const userId = subs[0].userId;
    const user = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
    if (!user) {
      await TG.sendTelegramMessage(chatId, "❌ User account not found.");
      return;
    }

    const userPerms = await loadPermissions(user.role, user.roleId);
    if (!userPerms.includes("visit_requests.approve")) {
      await TG.sendTelegramMessage(chatId, "❌ You don't have permission to reject visit requests.");
      return;
    }

    const allRequests = await db.select().from(visitRequestsTable)
      .where(user.orgId ? eq(visitRequestsTable.orgId, user.orgId) : undefined as any);
    const request = allRequests.find(r => {
      if (!r.id.startsWith(shortId) || r.status !== "pending") return false;
      if (user.branchId && r.branchId !== user.branchId) return false;
      return true;
    });

    if (!request) {
      await TG.sendTelegramMessage(chatId, "❌ Visit request not found or already processed.");
      return;
    }

    await db.update(visitRequestsTable).set({
      status: "rejected",
      approvedById: userId,
      approvedAt: new Date(),
      rejectionReason: "Rejected via Telegram",
    }).where(eq(visitRequestsTable.id, request.id));

    const visitor = (await db.select().from(visitorsTable).where(eq(visitorsTable.id, request.visitorId)).limit(1))[0];

    await TG.sendTelegramMessage(chatId,
      `<b>❌ Visit Rejected</b>\n\n` +
      `👤 ${visitor?.fullName || "Unknown"}\n` +
      `📋 ${request.purpose}`
    );
    return;
  }
});

// POST /api/telegram/setup-webhook (super_admin only)
router.post("/setup-webhook", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl) {
    res.status(400).json({ error: "webhookUrl is required" });
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const result = await TG.setBotWebhook(webhookUrl, secret);
  res.json({ success: result.ok, description: result.description });
});

// GET /api/telegram/bot-info (super_admin only)
router.get("/bot-info", requireAuth, requireRole("super_admin"), async (req, res) => {
  const result = await TG.getBotInfo() as { ok: boolean; result?: unknown };
  res.json({ configured: TG.isConfigured(), botInfo: result.ok ? result.result : null });
});

export { linkCodes };
export default router;
