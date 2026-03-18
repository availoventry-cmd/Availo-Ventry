import { Router } from "express";
import { db, invitationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrgAccess, requireRole } from "../lib/auth.js";
import { generateId, generateToken } from "../lib/id.js";
import { addDays } from "../lib/dateUtils.js";

const router = Router({ mergeParams: true });

// GET /api/organizations/:orgId/invitations
router.get("/", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { status } = req.query;

    let invitations = await db.select().from(invitationsTable)
      .where(eq(invitationsTable.orgId, orgId))
      .orderBy(invitationsTable.sentAt);

    // Auto-expire
    const now = new Date();
    invitations = invitations.map(inv => {
      if (inv.status === "pending" && new Date(inv.tokenExpiresAt) < now) {
        return { ...inv, status: "expired" as const };
      }
      return inv;
    });

    if (status) invitations = invitations.filter(i => i.status === status);

    res.json(invitations);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/invitations
router.post("/", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, nameAr, email, phone, role, branchId, department, jobTitle } = req.body;

    if (!name || !email || !role) {
      res.status(400).json({ error: "Name, email, and role are required" });
      return;
    }

    const id = generateId();
    const token = generateToken();
    const expiresAt = addDays(new Date(), 3);

    await db.insert(invitationsTable).values({
      id,
      orgId,
      branchId,
      invitedById: req.user!.id,
      email: email.toLowerCase(),
      name,
      nameAr,
      phone,
      role,
      department,
      jobTitle,
      invitationToken: token,
      tokenExpiresAt: expiresAt,
      status: "pending",
    });

    const invitations = await db.select().from(invitationsTable).where(eq(invitationsTable.id, id)).limit(1);
    res.status(201).json({ ...invitations[0], invitationLink: `/accept-invitation?token=${token}` });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/invitations/:invitationId/resend
router.post("/:invitationId/resend", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { invitationId } = req.params;
    const invitations = await db.select().from(invitationsTable).where(eq(invitationsTable.id, invitationId)).limit(1);
    const inv = invitations[0];
    if (!inv) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }
    if (inv.resendCount >= 3) {
      res.status(400).json({ error: "Maximum resend limit reached (3 times)" });
      return;
    }

    const newToken = generateToken();
    await db.update(invitationsTable).set({
      invitationToken: newToken,
      tokenExpiresAt: addDays(new Date(), 3),
      status: "pending",
      resendCount: inv.resendCount + 1,
      lastResentAt: new Date(),
    }).where(eq(invitationsTable.id, invitationId));

    const updated = await db.select().from(invitationsTable).where(eq(invitationsTable.id, invitationId)).limit(1);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/invitations/:invitationId/revoke
router.patch("/:invitationId/revoke", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { invitationId } = req.params;
    await db.update(invitationsTable).set({
      status: "revoked",
      revokedAt: new Date(),
      revokedById: req.user!.id,
    }).where(eq(invitationsTable.id, invitationId));
    res.json({ success: true, message: "Invitation revoked" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
