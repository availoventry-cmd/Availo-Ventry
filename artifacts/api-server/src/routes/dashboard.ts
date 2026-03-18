import { Router } from "express";
import { db, organizationsTable, visitRequestsTable, usersTable, branchesTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router = Router();

// GET /api/dashboard/super-admin
router.get("/super-admin", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const orgs = await db.select().from(organizationsTable).orderBy(organizationsTable.createdAt);
    const totalOrgs = orgs.length;
    const activeOrgs = orgs.filter(o => o.status === "active").length;
    const suspendedOrgs = orgs.filter(o => o.status === "suspended").length;
    const pendingSetupOrgs = orgs.filter(o => o.status === "pending_setup").length;

    const today = new Date().toISOString().split("T")[0];
    const allRequests = await db.select().from(visitRequestsTable);
    const todayRequests = allRequests.filter(r => r.scheduledDate === today);

    const orgsByTier = ["starter", "professional", "enterprise", "government"].map(tier => ({
      tier,
      count: orgs.filter(o => o.subscriptionTier === tier).length,
    }));

    const recentOrgs = orgs.slice(-5).reverse();

    // Monthly growth for last 6 months
    const monthlyGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.toISOString().slice(0, 7);
      monthlyGrowth.push({
        month,
        newOrgs: orgs.filter(o => o.createdAt.toISOString().startsWith(month)).length,
        totalVisitors: allRequests.filter(r => r.createdAt.toISOString().startsWith(month)).length,
      });
    }

    res.json({
      totalOrgs,
      activeOrgs,
      suspendedOrgs,
      pendingSetupOrgs,
      totalVisitorsToday: todayRequests.length,
      totalRequestsToday: todayRequests.length,
      orgsByTier,
      recentOrgs,
      monthlyGrowth,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/dashboard/org/:orgId
router.get("/org/:orgId", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const user = req.user!;
    if (user.role !== "super_admin" && user.orgId !== orgId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const requests = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.orgId, orgId));
    const todayReqs = requests.filter(r => r.scheduledDate === today);
    const pending = requests.filter(r => r.status === "pending").length;
    const checkedIn = requests.filter(r => r.status === "checked_in").length;

    // Weekly trend
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split("T")[0];
      weeklyTrend.push({
        date,
        count: requests.filter(r => r.scheduledDate === date).length,
      });
    }

    // Branch comparison
    const branches = await db.select().from(branchesTable).where(eq(branchesTable.orgId, orgId));
    const branchComparison = branches.map(b => ({
      branchName: b.name,
      visitorsToday: todayReqs.filter(r => r.branchId === b.id).length,
      pendingApprovals: requests.filter(r => r.branchId === b.id && r.status === "pending").length,
    }));

    const recentRequests = requests.slice(-5).reverse();

    res.json({
      visitorsToday: todayReqs.length,
      pendingApprovals: pending,
      checkedInNow: checkedIn,
      weeklyTrend,
      branchComparison,
      recentRequests,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/dashboard/branch/:branchId
router.get("/branch/:branchId", requireAuth, async (req, res) => {
  try {
    const { branchId } = req.params;
    const user = req.user!;

    const today = new Date().toISOString().split("T")[0];
    let requests = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.branchId, branchId));

    const expectedVisitorsToday = requests.filter(r => r.scheduledDate === today && ["approved", "pending"].includes(r.status));
    const checkedIn = requests.filter(r => r.status === "checked_in");

    // Overstay: checked in > 4 hours ago
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const overstayAlerts = checkedIn.filter(r => r.checkInTime && r.checkInTime < fourHoursAgo);

    res.json({
      expectedVisitorsToday,
      pendingRequests: requests.filter(r => r.status === "pending").length,
      checkedInNow: checkedIn.length,
      overstayAlerts,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/dashboard/host
router.get("/host", requireAuth, requireRole("host_employee"), async (req, res) => {
  try {
    const user = req.user!;
    const requests = await db.select().from(visitRequestsTable)
      .where(and(eq(visitRequestsTable.hostUserId, user.id), eq(visitRequestsTable.orgId, user.orgId!)));

    const today = new Date().toISOString().split("T")[0];
    const upcomingVisitors = requests.filter(r => r.scheduledDate >= today && !["cancelled", "checked_out", "rejected"].includes(r.status));
    const pastVisitors = requests.filter(r => r.scheduledDate < today || ["checked_out", "rejected", "cancelled"].includes(r.status));

    const thisMonth = new Date().toISOString().slice(0, 7);
    const totalVisitorsThisMonth = requests.filter(r => r.createdAt.toISOString().startsWith(thisMonth)).length;

    res.json({ upcomingVisitors, pastVisitors, totalVisitorsThisMonth });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
