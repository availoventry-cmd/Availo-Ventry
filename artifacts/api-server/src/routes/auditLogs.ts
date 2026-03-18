import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireOrgAccess, requireRole } from "../lib/auth.js";

const router = Router({ mergeParams: true });

// GET /api/organizations/:orgId/audit-logs
router.get("/", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { userId, action, entityType, dateFrom, dateTo, page = "1", limit = "50" } = req.query;

    let logs = await db.select().from(auditLogsTable)
      .where(eq(auditLogsTable.orgId, orgId))
      .orderBy(auditLogsTable.timestamp);

    if (userId) logs = logs.filter(l => l.userId === userId);
    if (action) logs = logs.filter(l => l.action === action);
    if (entityType) logs = logs.filter(l => l.entityType === entityType);
    if (dateFrom) logs = logs.filter(l => l.timestamp >= new Date(dateFrom as string));
    if (dateTo) logs = logs.filter(l => l.timestamp <= new Date(dateTo as string));

    logs = logs.reverse();

    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    const total = logs.length;
    const paginated = logs.slice((p - 1) * l, p * l);

    res.json({ data: paginated, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
