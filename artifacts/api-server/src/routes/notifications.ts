import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";

const router = Router();

// GET /api/notifications
router.get("/", requireAuth, async (req, res) => {
  try {
    const { unreadOnly, page = "1", limit = "20" } = req.query;
    const userId = req.user!.id;

    let notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(notificationsTable.createdAt);

    notifications = notifications.reverse();

    if (unreadOnly === "true") {
      notifications = notifications.filter(n => !n.isRead);
    }

    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    const total = notifications.length;
    const unreadCount = notifications.filter(n => !n.isRead).length;
    const paginated = notifications.slice((p - 1) * l, p * l);

    res.json({
      data: paginated,
      meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) },
      unreadCount,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/notifications/:notificationId/read
router.patch("/:notificationId/read", requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.userId, req.user!.id)));
    res.json({ success: true, message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/notifications/mark-all-read
router.patch("/mark-all-read", requireAuth, async (req, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.user!.id));
    res.json({ success: true, message: "All marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
