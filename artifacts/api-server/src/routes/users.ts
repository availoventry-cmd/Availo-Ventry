import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrgAccess, requireRole } from "../lib/auth.js";

const router = Router({ mergeParams: true });

// GET /api/organizations/:orgId/users
router.get("/", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { role, branchId, status, search, page = "1", limit = "20" } = req.query;

    let users = await db.select().from(usersTable)
      .where(eq(usersTable.orgId, orgId))
      .orderBy(usersTable.createdAt);

    if (role) users = users.filter(u => u.role === role);
    if (branchId) users = users.filter(u => u.branchId === branchId);
    if (status === "active") users = users.filter(u => u.isActive && u.invitationAcceptedAt);
    if (status === "deactivated") users = users.filter(u => !u.isActive);
    if (search) {
      const s = (search as string).toLowerCase();
      users = users.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }

    const p = parseInt(page as string);
    const l = parseInt(limit as string);
    const total = users.length;
    const paginated = users.slice((p - 1) * l, p * l);

    // Strip sensitive data
    const safeUsers = paginated.map(u => ({
      id: u.id,
      orgId: u.orgId,
      branchId: u.branchId,
      name: u.name,
      nameAr: u.nameAr,
      email: u.email,
      phone: u.phone,
      role: u.role,
      department: u.department,
      jobTitle: u.jobTitle,
      isActive: u.isActive,
      isLocked: u.isLocked,
      twoFactorEnabled: u.twoFactorEnabled,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));

    res.json({ data: safeUsers, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/organizations/:orgId/users/:userId
router.get("/:userId", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const users = await db.select().from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.orgId, orgId)))
      .limit(1);
    if (!users[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const u = users[0];
    res.json({
      id: u.id, orgId: u.orgId, branchId: u.branchId, name: u.name, nameAr: u.nameAr,
      email: u.email, phone: u.phone, role: u.role, department: u.department,
      jobTitle: u.jobTitle, isActive: u.isActive, isLocked: u.isLocked,
      twoFactorEnabled: u.twoFactorEnabled, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/organizations/:orgId/users/:userId
router.put("/:userId", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const { name, nameAr, phone, role, branchId, department, jobTitle } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (nameAr !== undefined) updates.name_ar = nameAr;
    if (phone !== undefined) updates.phone = phone;
    if (role !== undefined) updates.role = role;
    if (branchId !== undefined) updates.branch_id = branchId;
    if (department !== undefined) updates.department = department;
    if (jobTitle !== undefined) updates.job_title = jobTitle;

    await db.update(usersTable)
      .set(updates as Partial<typeof usersTable.$inferInsert>)
      .where(and(eq(usersTable.id, userId), eq(usersTable.orgId, orgId)));

    const updated = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const u = updated[0];
    res.json({
      id: u.id, orgId: u.orgId, branchId: u.branchId, name: u.name, nameAr: u.nameAr,
      email: u.email, phone: u.phone, role: u.role, department: u.department,
      jobTitle: u.jobTitle, isActive: u.isActive, isLocked: u.isLocked,
      twoFactorEnabled: u.twoFactorEnabled, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/users/:userId/deactivate
router.patch("/:userId/deactivate", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    await db.update(usersTable)
      .set({ isActive: false, deactivatedAt: new Date(), deactivatedById: req.user!.id })
      .where(and(eq(usersTable.id, userId), eq(usersTable.orgId, orgId)));
    res.json({ success: true, message: "User deactivated" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/users/:userId/reactivate
router.patch("/:userId/reactivate", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    await db.update(usersTable)
      .set({ isActive: true, deactivatedAt: undefined })
      .where(and(eq(usersTable.id, userId), eq(usersTable.orgId, orgId)));
    res.json({ success: true, message: "User reactivated" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/users/:userId/reset-password
router.post("/:userId/reset-password", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    await db.update(usersTable)
      .set({ mustChangePassword: true })
      .where(eq(usersTable.id, req.params.userId));
    res.json({ success: true, message: "User will be required to change password on next login" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
