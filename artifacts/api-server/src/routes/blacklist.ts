import { Router } from "express";
import { db, blacklistTable, visitorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrgAccess, requireRole } from "../lib/auth.js";
import { generateId } from "../lib/id.js";

const router = Router({ mergeParams: true });

// GET /api/organizations/:orgId/blacklist
router.get("/", requireAuth, requireOrgAccess, requireRole("org_admin", "visitor_manager", "super_admin"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { search, page = "1", limit = "20" } = req.query;

    let entries = await db.select({
      blacklist: blacklistTable,
      visitor: visitorsTable,
    })
      .from(blacklistTable)
      .leftJoin(visitorsTable, eq(blacklistTable.visitorId, visitorsTable.id))
      .where(eq(blacklistTable.orgId, orgId));

    if (search) {
      const s = (search as string).toLowerCase();
      entries = entries.filter(e =>
        (e.visitor?.fullName || "").toLowerCase().includes(s) ||
        (e.visitor?.phone || "").includes(s)
      );
    }

    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    const total = entries.length;
    const paginated = entries.slice((p - 1) * l, p * l).map(e => ({
      ...e.blacklist,
      visitor: e.visitor,
    }));

    res.json({ data: paginated, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/blacklist
router.post("/", requireAuth, requireOrgAccess, requireRole("org_admin", "visitor_manager", "super_admin"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { visitorId, reason, expiresAt } = req.body;
    if (!visitorId || !reason) {
      res.status(400).json({ error: "Visitor ID and reason are required" });
      return;
    }

    const id = generateId();
    await db.insert(blacklistTable).values({
      id,
      orgId,
      visitorId,
      reason,
      blacklistedById: req.user!.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    // Mark visitor as blacklisted
    await db.update(visitorsTable).set({ isBlacklisted: true, blacklistReason: reason })
      .where(eq(visitorsTable.id, visitorId));

    const entries = await db.select({ blacklist: blacklistTable, visitor: visitorsTable })
      .from(blacklistTable)
      .leftJoin(visitorsTable, eq(blacklistTable.visitorId, visitorsTable.id))
      .where(eq(blacklistTable.id, id))
      .limit(1);

    res.status(201).json({ ...entries[0].blacklist, visitor: entries[0].visitor });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/organizations/:orgId/blacklist/:blacklistId
router.delete("/:blacklistId", requireAuth, requireOrgAccess, requireRole("org_admin", "visitor_manager", "super_admin"), async (req, res) => {
  try {
    const { orgId, blacklistId } = req.params;

    const entries = await db.select().from(blacklistTable)
      .where(and(eq(blacklistTable.id, blacklistId), eq(blacklistTable.orgId, orgId)))
      .limit(1);
    if (!entries[0]) {
      res.status(404).json({ error: "Blacklist entry not found" });
      return;
    }

    await db.delete(blacklistTable)
      .where(and(eq(blacklistTable.id, blacklistId), eq(blacklistTable.orgId, orgId)));

    // Check if still on any other org's blacklist
    const otherEntries = await db.select().from(blacklistTable)
      .where(eq(blacklistTable.visitorId, entries[0].visitorId));

    if (otherEntries.length === 0) {
      await db.update(visitorsTable).set({ isBlacklisted: false, blacklistReason: null })
        .where(eq(visitorsTable.id, entries[0].visitorId));
    }

    res.json({ success: true, message: "Removed from blacklist" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
