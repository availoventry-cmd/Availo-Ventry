const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

async function callTelegram(method: string, body: Record<string, unknown>): Promise<TelegramResponse> {
  const token = getBotToken();
  if (!token) {
    console.warn("TELEGRAM_BOT_TOKEN not set — Telegram notifications disabled");
    return { ok: false, description: "Bot token not configured" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json() as TelegramResponse;
  } catch (err) {
    console.error(`Telegram ${method} error:`, err);
    return { ok: false, description: String(err) };
  }
}

export async function sendTelegramMessage(chatId: string | number, text: string, parseMode: "HTML" | "Markdown" = "HTML"): Promise<TelegramResponse> {
  return callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

export async function setBotWebhook(webhookUrl: string): Promise<TelegramResponse> {
  return callTelegram("setWebhook", {
    url: webhookUrl,
    drop_pending_updates: true,
  });
}

export async function deleteBotWebhook(): Promise<TelegramResponse> {
  return callTelegram("deleteWebhook", {});
}

export async function getBotInfo(): Promise<TelegramResponse> {
  return callTelegram("getMe", {});
}

export function isConfigured(): boolean {
  return !!getBotToken();
}

export function formatVisitorArrived(data: {
  visitorName: string;
  purpose: string;
  branchName: string;
  checkInTime: string;
  hostName?: string;
}): string {
  return `<b>🚶 Visitor Arrived</b>\n\n` +
    `👤 <b>${data.visitorName}</b>\n` +
    `📋 ${data.purpose}\n` +
    `🏢 ${data.branchName}\n` +
    `🕐 ${data.checkInTime}` +
    (data.hostName ? `\n👥 Host: ${data.hostName}` : "");
}

export function formatVisitApproved(data: {
  visitorName: string;
  purpose: string;
  scheduledDate: string;
  scheduledTimeFrom?: string;
  qrCode?: string;
  trackingToken: string;
}): string {
  return `<b>✅ Visit Request Approved</b>\n\n` +
    `👤 <b>${data.visitorName}</b>\n` +
    `📋 ${data.purpose}\n` +
    `📅 ${data.scheduledDate}` +
    (data.scheduledTimeFrom ? ` at ${data.scheduledTimeFrom}` : "") +
    (data.qrCode ? `\n\n🎫 QR Pass: <code>${data.qrCode}</code>` : "") +
    `\n🔗 Track: /pass_${data.trackingToken.slice(0, 8)}`;
}

export function formatWalkInRequest(data: {
  visitorName: string;
  purpose: string;
  branchName: string;
  orgName: string;
  requestId: string;
}): string {
  return `<b>🔔 New Walk-in Request</b>\n\n` +
    `👤 <b>${data.visitorName}</b>\n` +
    `📋 ${data.purpose}\n` +
    `🏢 ${data.branchName} — ${data.orgName}\n\n` +
    `Reply /approve_${data.requestId.slice(0, 8)} or /reject_${data.requestId.slice(0, 8)}`;
}

export function formatVisitRejected(data: {
  visitorName: string;
  purpose: string;
  reason?: string;
}): string {
  return `<b>❌ Visit Request Rejected</b>\n\n` +
    `👤 <b>${data.visitorName}</b>\n` +
    `📋 ${data.purpose}` +
    (data.reason ? `\n\n📝 Reason: ${data.reason}` : "");
}

export function formatCheckout(data: {
  visitorName: string;
  checkInTime: string;
  checkOutTime: string;
  duration: string;
}): string {
  return `<b>👋 Visitor Checked Out</b>\n\n` +
    `👤 <b>${data.visitorName}</b>\n` +
    `🕐 In: ${data.checkInTime}\n` +
    `🕑 Out: ${data.checkOutTime}\n` +
    `⏱️ Duration: ${data.duration}`;
}
