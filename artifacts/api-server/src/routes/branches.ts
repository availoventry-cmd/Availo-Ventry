import { Router } from "express";
import { db, branchesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireOrgAccess, requireRole } from "../lib/auth.js";
import { generateId } from "../lib/id.js";

const router = Router({ mergeParams: true });

// GET /api/organizations/:orgId/branches
router.get("/", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId } = req.params;
    const branches = await db.select().from(branchesTable)
      .where(eq(branchesTable.orgId, orgId))
      .orderBy(branchesTable.name);
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/branches
router.post("/", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { name, nameAr, address, city, branchCode, entryMode = "staffed", maxConcurrentVisitors } = req.body;

    if (!name || !branchCode || !entryMode) {
      res.status(400).json({ error: "Name, branch code, and entry mode are required" });
      return;
    }

    const id = generateId();
    await db.insert(branchesTable).values({
      id,
      orgId,
      name,
      nameAr,
      address,
      city,
      branchCode,
      entryMode,
      maxConcurrentVisitors,
      isActive: true,
    });

    const branches = await db.select().from(branchesTable).where(eq(branchesTable.id, id)).limit(1);
    res.status(201).json(branches[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/organizations/:orgId/branches/:branchId
router.get("/:branchId", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId, branchId } = req.params;
    const branches = await db.select().from(branchesTable)
      .where(and(eq(branchesTable.id, branchId), eq(branchesTable.orgId, orgId)))
      .limit(1);
    if (!branches[0]) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json(branches[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/organizations/:orgId/branches/:branchId
router.put("/:branchId", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId, branchId } = req.params;
    const { name, nameAr, address, city, entryMode, verificationPolicyOverride, maxConcurrentVisitors, isActive } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (nameAr !== undefined) updates.name_ar = nameAr;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (entryMode !== undefined) updates.entry_mode = entryMode;
    if (verificationPolicyOverride !== undefined) updates.verification_policy_override = verificationPolicyOverride;
    if (maxConcurrentVisitors !== undefined) updates.max_concurrent_visitors = maxConcurrentVisitors;
    if (isActive !== undefined) updates.is_active = isActive;

    await db.update(branchesTable)
      .set(updates as Partial<typeof branchesTable.$inferInsert>)
      .where(and(eq(branchesTable.id, branchId), eq(branchesTable.orgId, orgId)));

    const branches = await db.select().from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1);
    res.json(branches[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/organizations/:orgId/branches/:branchId
router.delete("/:branchId", requireAuth, requireOrgAccess, requireRole("org_admin", "super_admin"), async (req, res) => {
  try {
    const { orgId, branchId } = req.params;
    await db.update(branchesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(branchesTable.id, branchId), eq(branchesTable.orgId, orgId)));
    res.json({ success: true, message: "Branch deactivated" });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
