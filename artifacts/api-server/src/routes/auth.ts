import { Router } from "express";
import { db, usersTable, invitationsTable, organizationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, loadPermissions, resolveRoleId } from "../lib/auth.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateId } from "../lib/id.js";

const router = Router();

async function buildUserResponse(user: typeof usersTable.$inferSelect, orgInfo: typeof organizationsTable.$inferSelect | null) {
  const setupWizardCompleted = user.role === "super_admin" ? true : (orgInfo?.setupWizardCompleted ?? true);

  let roleId = user.roleId ?? null;
  const SYSTEM_ROLES = ["super_admin", "org_admin"];
  if (!roleId && !SYSTEM_ROLES.includes(user.role) && user.orgId) {
    roleId = await resolveRoleId(user.role, user.orgId);
    if (roleId) {
      await db.update(usersTable).set({ roleId }).where(eq(usersTable.id, user.id));
    }
  }

  const permissions = await loadPermissions(user.role, roleId);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nameAr: user.nameAr,
    role: user.role,
    roleId,
    orgId: user.orgId,
    branchId: user.branchId,
    department: user.department,
    jobTitle: user.jobTitle,
    mustChangePassword: user.mustChangePassword,
    setupWizardCompleted,
    organizationName: orgInfo?.name || null,
    organizationStatus: orgInfo?.status || null,
    permissions,
  };
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Bad Request", message: "Email and password required" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    const user = users[0];

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "Account is deactivated" });
      return;
    }

    if (user.isLocked) {
      res.status(401).json({ error: "Unauthorized", message: `Account is locked: ${user.lockReason}` });
      return;
    }

    await db.update(usersTable)
      .set({ lastLoginAt: new Date(), lastActiveAt: new Date(), loginCount: (user.loginCount || 0) + 1 })
      .where(eq(usersTable.id, user.id));

    (req as unknown as { session: { userId: string; save: (cb: (err: unknown) => void) => void } }).session.userId = user.id;

    let orgInfo = null;
    if (user.orgId) {
      const orgs = await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.orgId)).limit(1);
      if (orgs[0]) orgInfo = orgs[0];
    }

    res.json({ user: await buildUserResponse(user, orgInfo) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  const session = (req as unknown as { session: { destroy: (cb: (err: unknown) => void) => void } }).session;
  session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.json({ success: true, message: "Logged out" });
  });
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users[0]) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0];
    let orgInfo = null;
    if (user.orgId) {
      const orgs = await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.orgId)).limit(1);
      if (orgs[0]) orgInfo = orgs[0];
    }
    res.json(await buildUserResponse(user, orgInfo));
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/auth/verify-invitation-token
router.get("/verify-invitation-token", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      res.status(400).json({ error: "Token required" });
      return;
    }

    const invitations = await db.select({
      invitation: invitationsTable,
      org: organizationsTable,
    })
      .from(invitationsTable)
      .leftJoin(organizationsTable, eq(invitationsTable.orgId, organizationsTable.id))
      .where(eq(invitationsTable.invitationToken, token as string))
      .limit(1);

    const row = invitations[0];
    if (!row?.invitation) {
      res.status(400).json({ error: "Invalid token" });
      return;
    }

    const inv = row.invitation;
    if (inv.status !== "pending") {
      res.status(400).json({ error: `Invitation is ${inv.status}` });
      return;
    }
    if (new Date(inv.tokenExpiresAt) < new Date()) {
      await db.update(invitationsTable).set({ status: "expired" }).where(eq(invitationsTable.id, inv.id));
      res.status(400).json({ error: "Invitation has expired" });
      return;
    }

    res.json({
      valid: true,
      email: inv.email,
      name: inv.name,
      role: inv.role,
      roleId: inv.roleId ?? null,
      orgName: row.org?.name || "",
      expiresAt: inv.tokenExpiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/auth/accept-invitation
router.post("/accept-invitation", async (req, res) => {
  try {
    const { token, password, acceptedTerms } = req.body;
    if (!token || !password || !acceptedTerms) {
      res.status(400).json({ error: "Bad Request", message: "Token, password, and terms acceptance required" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const invitations = await db.select({
      invitation: invitationsTable,
      org: organizationsTable,
    })
      .from(invitationsTable)
      .leftJoin(organizationsTable, eq(invitationsTable.orgId, organizationsTable.id))
      .where(and(eq(invitationsTable.invitationToken, token), eq(invitationsTable.status, "pending")))
      .limit(1);

    const row = invitations[0];
    if (!row?.invitation) {
      res.status(400).json({ error: "Invalid or expired invitation" });
      return;
    }
    if (new Date(row.invitation.tokenExpiresAt) < new Date()) {
      res.status(400).json({ error: "Invitation has expired" });
      return;
    }

    const inv = row.invitation;
    const userId = generateId();
    const passwordHash = hashPassword(password);

    await db.insert(usersTable).values({
      id: userId,
      orgId: inv.orgId,
      branchId: inv.branchId,
      name: inv.name,
      nameAr: inv.nameAr,
      email: inv.email,
      phone: inv.phone,
      role: inv.role as "org_admin" | "visitor_manager" | "receptionist" | "host_employee",
      roleId: inv.roleId ?? null,
      department: inv.department,
      jobTitle: inv.jobTitle,
      passwordHash,
      invitedById: inv.invitedById,
      invitationAcceptedAt: new Date(),
      isActive: true,
      isLocked: false,
      mustChangePassword: false,
      twoFactorEnabled: false,
    });

    await db.update(invitationsTable)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(invitationsTable.id, inv.id));

    (req as unknown as { session: { userId: string } }).session.userId = userId;

    const orgInfo = row.org;
    const permissions = await loadPermissions(inv.role, inv.roleId ?? null);

    res.json({
      user: {
        id: userId,
        email: inv.email,
        name: inv.name,
        nameAr: inv.nameAr,
        role: inv.role,
        roleId: inv.roleId ?? null,
        orgId: inv.orgId,
        branchId: inv.branchId,
        mustChangePassword: false,
        setupWizardCompleted: inv.role === "org_admin" ? false : (orgInfo?.setupWizardCompleted ?? true),
        organizationName: orgInfo?.name || null,
        organizationStatus: orgInfo?.status || null,
        permissions,
      },
    });
  } catch (err) {
    console.error("Accept invitation error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users[0] || !verifyPassword(currentPassword, users[0].passwordHash)) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    await db.update(usersTable).set({
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    }).where(eq(usersTable.id, userId));

    res.json({ success: true, message: "Password changed" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
