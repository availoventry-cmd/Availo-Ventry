import { db, telegramSubscriptionsTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import * as TG from "./telegram.js";

async function getSubscribersForOrg(orgId: string, notifType: "notifyApprovals" | "notifyCheckIns" | "notifyWalkIns" | "notifyRejections") {
  const all = await db.select().from(telegramSubscriptionsTable)
    .where(and(
      eq(telegramSubscriptionsTable.orgId, orgId),
      eq(telegramSubscriptionsTable.isActive, true),
      eq(telegramSubscriptionsTable[notifType], true),
    ));
  return all;
}

async function getSubscriberForUser(userId: string, notifType: "notifyApprovals" | "notifyCheckIns" | "notifyWalkIns" | "notifyRejections") {
  const subs = await db.select().from(telegramSubscriptionsTable)
    .where(and(
      eq(telegramSubscriptionsTable.userId, userId),
      eq(telegramSubscriptionsTable.isActive, true),
      eq(telegramSubscriptionsTable[notifType], true),
    ))
    .limit(1);
  return subs[0] || null;
}

export async function notifyVisitApproved(data: {
  visitorName: string;
  purpose: string;
  scheduledDate: string;
  scheduledTimeFrom?: string | null;
  qrCode?: string | null;
  trackingToken: string;
  hostUserId?: string | null;
  orgId: string;
}) {
  if (!TG.isConfigured()) return;

  const message = TG.formatVisitApproved({
    visitorName: data.visitorName,
    purpose: data.purpose,
    scheduledDate: data.scheduledDate,
    scheduledTimeFrom: data.scheduledTimeFrom || undefined,
    qrCode: data.qrCode || undefined,
    trackingToken: data.trackingToken,
  });

  const recipients = new Map<string, string>();

  // Notify the host specifically
  if (data.hostUserId) {
    const sub = await getSubscriberForUser(data.hostUserId, "notifyApprovals");
    if (sub) recipients.set(sub.chatId, sub.chatId);
  }

  // Also notify all org-level subscribers
  const orgSubs = await getSubscribersForOrg(data.orgId, "notifyApprovals");
  for (const sub of orgSubs) {
    if (!recipients.has(sub.chatId)) {
      recipients.set(sub.chatId, sub.chatId);
    }
  }

  await Promise.allSettled([...recipients.values()].map(chatId =>
    TG.sendTelegramMessage(chatId, message)
  ));
}

export async function notifyCheckIn(data: {
  visitorName: string;
  purpose: string;
  branchName: string;
  checkInTime: string;
  hostUserId?: string | null;
  hostName?: string | null;
  orgId: string;
}) {
  if (!TG.isConfigured()) return;

  const message = TG.formatVisitorArrived({
    visitorName: data.visitorName,
    purpose: data.purpose,
    branchName: data.branchName,
    checkInTime: data.checkInTime,
    hostName: data.hostName || undefined,
  });

  const recipients = new Map<string, string>();

  if (data.hostUserId) {
    const sub = await getSubscriberForUser(data.hostUserId, "notifyCheckIns");
    if (sub) recipients.set(sub.chatId, sub.chatId);
  }

  const orgSubs = await getSubscribersForOrg(data.orgId, "notifyCheckIns");
  for (const sub of orgSubs) {
    if (!recipients.has(sub.chatId)) recipients.set(sub.chatId, sub.chatId);
  }

  await Promise.allSettled([...recipients.values()].map(chatId =>
    TG.sendTelegramMessage(chatId, message)
  ));
}

export async function notifyWalkIn(data: {
  visitorName: string;
  purpose: string;
  branchName: string;
  orgName: string;
  requestId: string;
  orgId: string;
}) {
  if (!TG.isConfigured()) return;

  const message = TG.formatWalkInRequest({
    visitorName: data.visitorName,
    purpose: data.purpose,
    branchName: data.branchName,
    orgName: data.orgName,
    requestId: data.requestId,
  });

  const orgSubs = await getSubscribersForOrg(data.orgId, "notifyWalkIns");
  await Promise.allSettled(orgSubs.map(sub =>
    TG.sendTelegramMessage(sub.chatId, message)
  ));
}

export async function notifyRejection(data: {
  visitorName: string;
  purpose: string;
  rejectionReason?: string | null;
  hostUserId?: string | null;
  orgId: string;
}) {
  if (!TG.isConfigured()) return;

  const message = TG.formatVisitRejected({
    visitorName: data.visitorName,
    purpose: data.purpose,
    reason: data.rejectionReason || undefined,
  });

  if (data.hostUserId) {
    const sub = await getSubscriberForUser(data.hostUserId, "notifyRejections");
    if (sub) await TG.sendTelegramMessage(sub.chatId, message);
  }
}
