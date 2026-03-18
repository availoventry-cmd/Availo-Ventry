import { Router } from "express";
import { db, visitRequestsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrgAccess } from "../lib/auth.js";

const router = Router({ mergeParams: true });

// GET /api/organizations/:orgId/reports/visitor-traffic
router.get("/visitor-traffic", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { period = "weekly", branchId, dateFrom, dateTo } = req.query;

    let requests = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.orgId, orgId));
    if (branchId) requests = requests.filter(r => r.branchId === branchId);
    if (dateFrom) requests = requests.filter(r => r.scheduledDate >= dateFrom as string);
    if (dateTo) requests = requests.filter(r => r.scheduledDate <= dateTo as string);

    let data: Array<{ label: string; totalVisitors: number; checkedIn: number; checkedOut: number; walkIns: number; preRegistered: number }> = [];

    if (period === "daily") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = d.toISOString().split("T")[0];
        const dayReqs = requests.filter(r => r.scheduledDate === date);
        data.push({
          label: date,
          totalVisitors: dayReqs.length,
          checkedIn: dayReqs.filter(r => ["checked_in", "checked_out"].includes(r.status)).length,
          checkedOut: dayReqs.filter(r => r.status === "checked_out").length,
          walkIns: dayReqs.filter(r => r.type === "walk_in").length,
          preRegistered: dayReqs.filter(r => r.type === "pre_registered").length,
        });
      }
    } else if (period === "weekly") {
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - i * 7 - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const wsStr = weekStart.toISOString().split("T")[0];
        const weStr = weekEnd.toISOString().split("T")[0];
        const weekReqs = requests.filter(r => r.scheduledDate >= wsStr && r.scheduledDate <= weStr);
        data.push({
          label: `Week of ${wsStr}`,
          totalVisitors: weekReqs.length,
          checkedIn: weekReqs.filter(r => ["checked_in", "checked_out"].includes(r.status)).length,
          checkedOut: weekReqs.filter(r => r.status === "checked_out").length,
          walkIns: weekReqs.filter(r => r.type === "walk_in").length,
          preRegistered: weekReqs.filter(r => r.type === "pre_registered").length,
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const month = d.toISOString().slice(0, 7);
        const monthReqs = requests.filter(r => r.scheduledDate.startsWith(month));
        data.push({
          label: month,
          totalVisitors: monthReqs.length,
          checkedIn: monthReqs.filter(r => ["checked_in", "checked_out"].includes(r.status)).length,
          checkedOut: monthReqs.filter(r => r.status === "checked_out").length,
          walkIns: monthReqs.filter(r => r.type === "walk_in").length,
          preRegistered: monthReqs.filter(r => r.type === "pre_registered").length,
        });
      }
    }

    const approved = requests.filter(r => r.status !== "pending" && r.status !== "cancelled").length;
    const approvalRate = requests.length > 0 ? (approved / requests.length) * 100 : 0;

    res.json({
      period,
      data,
      summary: {
        totalVisitors: requests.length,
        avgDuration: 60,
        approvalRate: Math.round(approvalRate),
        peakHour: "10:00 AM",
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
