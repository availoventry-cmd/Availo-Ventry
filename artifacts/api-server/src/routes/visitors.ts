import { Router } from "express";
import { db, visitorsTable, visitRequestsTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth, requireOrgAccess } from "../lib/auth.js";

const router = Router({ mergeParams: true });

// GET /api/organizations/:orgId/visitors
router.get("/", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { search, isBlacklisted, page = "1", limit = "20" } = req.query;

    // Get visitor IDs that have visit requests for this org
    const orgRequests = await db.select({ visitorId: visitRequestsTable.visitorId })
      .from(visitRequestsTable)
      .where(eq(visitRequestsTable.orgId, orgId));

    const visitorIds = [...new Set(orgRequests.map(r => r.visitorId))];
    if (visitorIds.length === 0) {
      const p = parseInt(page as string);
      const l = parseInt(limit as string);
      res.json({ data: [], meta: { total: 0, page: p, limit: l, totalPages: 0 } });
      return;
    }

    let visitors = await db.select().from(visitorsTable);
    visitors = visitors.filter(v => visitorIds.includes(v.id));

    if (isBlacklisted !== undefined) {
      visitors = visitors.filter(v => v.isBlacklisted === (isBlacklisted === "true"));
    }
    if (search) {
      const s = (search as string).toLowerCase();
      visitors = visitors.filter(v =>
        v.fullName.toLowerCase().includes(s) ||
        (v.phone || "").includes(s) ||
        (v.nationalIdNumber || "").includes(s) ||
        (v.email || "").toLowerCase().includes(s)
      );
    }

    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    const total = visitors.length;
    const paginated = visitors.slice((p - 1) * l, p * l);

    res.json({ data: paginated, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/organizations/:orgId/visitors/:visitorId
router.get("/:visitorId", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId, visitorId } = req.params;
    const visitors = await db.select().from(visitorsTable).where(eq(visitorsTable.id, visitorId)).limit(1);
    if (!visitors[0]) {
      res.status(404).json({ error: "Visitor not found" });
      return;
    }

    const visitHistory = await db.select().from(visitRequestsTable)
      .where(and(eq(visitRequestsTable.visitorId, visitorId), eq(visitRequestsTable.orgId, orgId)))
      .orderBy(visitRequestsTable.createdAt);

    res.json({ ...visitors[0], visitHistory });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
