import { Router } from "express";
import { db, organizationsTable, usersTable, branchesTable, visitRequestsTable } from "@workspace/db";
import { eq, ilike, and, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { generateId, generateToken } from "../lib/id.js";
import { hashPassword } from "../lib/password.js";
import { addDays } from "../lib/dateUtils.js";
import { invitationsTable } from "@workspace/db";

const router = Router();

function paginate<T>(data: T[], page: number, limit: number) {
  const total = data.length;
  const start = (page - 1) * limit;
  return {
    data: data.slice(start, start + limit),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// GET /api/organizations
router.get("/", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { status, type, search, page = "1", limit = "20" } = req.query;
    let orgs = await db.select().from(organizationsTable).orderBy(organizationsTable.createdAt);

    if (status) orgs = orgs.filter(o => o.status === status);
    if (type) orgs = orgs.filter(o => o.type === type);
    if (search) {
      const s = (search as string).toLowerCase();
      orgs = orgs.filter(o => o.name.toLowerCase().includes(s) || (o.nameAr || "").toLowerCase().includes(s));
    }

    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    res.json(paginate(orgs, p, l));
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations
router.post("/", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const {
      name, nameAr, type, address, subscriptionTier = "starter",
      maxUsers = 20, maxBranches = 5,
      contractStartDate, contractEndDate,
      primaryContactName, primaryContactEmail, primaryContactPhone,
      firstAdminName, firstAdminEmail, firstAdminPhone,
    } = req.body;

    if (!name || !type || !firstAdminName || !firstAdminEmail) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const orgId = generateId();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    await db.insert(organizationsTable).values({
      id: orgId,
      name,
      nameAr,
      type,
      address,
      subscriptionTier,
      publicBookingSlug: slug,
      status: "pending_setup",
      maxUsers,
      maxBranches,
      contractStartDate,
      contractEndDate,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone,
      verificationPolicy: "none",
      nafathEnabled: false,
      otpEnabled: true,
      verificationBypassForTrusted: false,
      setupWizardCompleted: false,
      createdById: req.user!.id,
    });

    // Create invitation for first org admin
    const inviteToken = generateToken();
    const invId = generateId();
    await db.insert(invitationsTable).values({
      id: invId,
      orgId,
      invitedById: req.user!.id,
      email: firstAdminEmail.toLowerCase(),
      name: firstAdminName,
      phone: firstAdminPhone,
      role: "org_admin",
      invitationToken: inviteToken,
      tokenExpiresAt: addDays(new Date(), 3),
      status: "pending",
    });

    const orgs = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    res.status(201).json(orgs[0]);
  } catch (err) {
    console.error("Create org error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/organizations/:orgId
router.get("/:orgId", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    if (req.user!.role !== "super_admin" && req.user!.orgId !== orgId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const orgs = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    if (!orgs[0]) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    res.json(orgs[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/organizations/:orgId
router.put("/:orgId", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    if (req.user!.role !== "super_admin" && req.user!.role !== "org_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (req.user!.role === "org_admin" && req.user!.orgId !== orgId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const allowedFields = [
      "name", "nameAr", "logo", "address", "publicBookingSlug",
      "verificationPolicy", "nafathEnabled", "otpEnabled", "verificationBypassForTrusted",
      "telegramChatId", "primaryContactName", "primaryContactEmail", "primaryContactPhone",
      "setupWizardCompleted",
    ];

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (field in req.body) {
        const dbField = field.replace(/([A-Z])/g, "_$1").toLowerCase() as keyof typeof updates;
        updates[dbField] = req.body[field];
      }
    }

    // If setup wizard completed, activate org
    if (req.body.setupWizardCompleted === true) {
      const orgs = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
      if (orgs[0]?.status === "pending_setup") {
        (updates as Record<string, unknown>).status = "active";
        (updates as Record<string, unknown>).activated_at = new Date();
      }
    }

    await db.update(organizationsTable).set(updates as Partial<typeof organizationsTable.$inferInsert>).where(eq(organizationsTable.id, orgId));
    const updated = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/status
router.patch("/:orgId/status", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { status, reason } = req.body;

    const updates: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === "suspended") {
      updates.suspension_reason = reason;
      updates.suspended_at = new Date();
    } else if (status === "active") {
      updates.suspension_reason = null;
      updates.activated_at = new Date();
    } else if (status === "deactivated") {
      updates.deactivated_at = new Date();
    }

    await db.update(organizationsTable).set(updates as Partial<typeof organizationsTable.$inferInsert>).where(eq(organizationsTable.id, orgId));
    const updated = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/organizations/:orgId/stats
router.get("/:orgId/stats", requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    if (req.user!.role !== "super_admin" && req.user!.orgId !== orgId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [userStats] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.orgId, orgId));
    const [activeUserStats] = await db.select({ total: count() }).from(usersTable).where(and(eq(usersTable.orgId, orgId), eq(usersTable.isActive, true)));
    const [branchStats] = await db.select({ total: count() }).from(branchesTable).where(eq(branchesTable.orgId, orgId));
    const [activeBranchStats] = await db.select({ total: count() }).from(branchesTable).where(and(eq(branchesTable.orgId, orgId), eq(branchesTable.isActive, true)));
    const [requestStats] = await db.select({ total: count() }).from(visitRequestsTable).where(eq(visitRequestsTable.orgId, orgId));

    const today = new Date().toISOString().split("T")[0];
    const todayRequests = await db.select().from(visitRequestsTable)
      .where(and(eq(visitRequestsTable.orgId, orgId), eq(visitRequestsTable.scheduledDate, today)));

    const pending = todayRequests.filter(r => r.status === "pending").length;
    const checkedIn = todayRequests.filter(r => r.status === "checked_in").length;

    const allRequests = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.orgId, orgId));
    const approved = allRequests.filter(r => r.status !== "pending" && r.status !== "cancelled").length;
    const approvalRate = allRequests.length > 0 ? (approved / allRequests.length) * 100 : 0;

    res.json({
      totalVisitorsThisMonth: requestStats?.total || 0,
      totalRequestsThisMonth: requestStats?.total || 0,
      approvalRate: Math.round(approvalRate),
      activeUsers: activeUserStats?.total || 0,
      totalUsers: userStats?.total || 0,
      activeBranches: activeBranchStats?.total || 0,
      totalBranches: branchStats?.total || 0,
      visitorsToday: todayRequests.length,
      pendingApprovals: pending,
      checkedInNow: checkedIn,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
