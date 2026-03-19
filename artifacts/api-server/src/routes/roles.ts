import { Router } from "express";
import { db, rolesTable, rolePermissionsTable, usersTable } from "@workspace/db";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, requireOrgAccess } from "../lib/auth.js";
import { generateId } from "../lib/id.js";

const router = Router({ mergeParams: true });

// GET /api/organizations/:orgId/roles/permissions/all
router.get("/permissions/all", requireAuth, requireOrgAccess, async (_req, res) => {
  res.json(ALL_PERMISSIONS);
});

// GET /api/organizations/:orgId/roles
router.get("/", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId } = req.params;
    const user = req.user!;

    const isOrgAdmin = user.role === "org_admin" || user.role === "super_admin";
    if (!isOrgAdmin && !user.permissions.includes("roles.view")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const roles = await db.select().from(rolesTable)
      .where(and(
        eq(rolesTable.orgId, orgId),
        eq(rolesTable.isActive, true),
      ))
      .orderBy(rolesTable.createdAt);

    const systemRoles = await db.select().from(rolesTable)
      .where(and(
        eq(rolesTable.isSystem, true),
      ));

    const allRoles = [...systemRoles, ...roles];

    const rolesWithCounts = await Promise.all(allRoles.map(async (role) => {
      const [permCount] = await db.select({ count: count() })
        .from(rolePermissionsTable)
        .where(eq(rolePermissionsTable.roleId, role.id));
      const [userCount] = await db.select({ count: count() })
        .from(usersTable)
        .where(eq(usersTable.roleId, role.id));
      return {
        ...role,
        permissionCount: Number(permCount?.count ?? 0),
        userCount: Number(userCount?.count ?? 0),
      };
    }));

    res.json(rolesWithCounts);
  } catch (err) {
    console.error("List roles error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/organizations/:orgId/roles/:roleId
router.get("/:roleId", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId, roleId } = req.params;
    const user = req.user!;

    const isOrgAdmin = user.role === "org_admin" || user.role === "super_admin";
    if (!isOrgAdmin && !user.permissions.includes("roles.view")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const roles = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
    const role = roles[0];
    if (!role) {
      res.status(404).json({ error: "Role not found" });
      return;
    }
    if (!role.isSystem && role.orgId !== orgId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const permissions = await db.select({ permission: rolePermissionsTable.permission })
      .from(rolePermissionsTable)
      .where(eq(rolePermissionsTable.roleId, roleId));

    res.json({ ...role, permissions: permissions.map(p => p.permission) });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/roles
router.post("/", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId } = req.params;
    const user = req.user!;

    const isOrgAdmin = user.role === "org_admin" || user.role === "super_admin";
    if (!isOrgAdmin && !user.permissions.includes("roles.manage")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { name, slug, description, permissions = [] } = req.body;
    if (!name || !slug) {
      res.status(400).json({ error: "Name and slug are required" });
      return;
    }

    const existing = await db.select().from(rolesTable)
      .where(and(eq(rolesTable.orgId, orgId), eq(rolesTable.slug, slug)))
      .limit(1);
    if (existing[0]) {
      res.status(409).json({ error: "A role with this slug already exists" });
      return;
    }

    const roleId = generateId();
    await db.insert(rolesTable).values({
      id: roleId,
      orgId,
      name,
      slug,
      description,
      isSystem: false,
      isDefault: false,
      isActive: true,
    });

    if (permissions.length > 0) {
      await db.insert(rolePermissionsTable).values(
        permissions.map((p: string) => ({ id: generateId(), roleId, permission: p }))
      );
    }

    const role = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
    res.status(201).json({ ...role[0], permissions });
  } catch (err) {
    console.error("Create role error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/organizations/:orgId/roles/:roleId
router.put("/:roleId", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId, roleId } = req.params;
    const user = req.user!;

    const isOrgAdmin = user.role === "org_admin" || user.role === "super_admin";
    if (!isOrgAdmin && !user.permissions.includes("roles.manage")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const roles = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
    const role = roles[0];
    if (!role) {
      res.status(404).json({ error: "Role not found" });
      return;
    }
    if (role.isSystem) {
      res.status(403).json({ error: "Cannot edit system roles" });
      return;
    }
    if (role.orgId !== orgId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { name, description, permissions } = req.body;

    await db.update(rolesTable)
      .set({ name: name ?? role.name, description: description ?? role.description, updatedAt: new Date() })
      .where(eq(rolesTable.id, roleId));

    if (Array.isArray(permissions)) {
      await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, roleId));
      if (permissions.length > 0) {
        await db.insert(rolePermissionsTable).values(
          permissions.map((p: string) => ({ id: generateId(), roleId, permission: p }))
        );
      }
    }

    const updatedRole = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
    const updatedPerms = await db.select({ permission: rolePermissionsTable.permission })
      .from(rolePermissionsTable)
      .where(eq(rolePermissionsTable.roleId, roleId));

    res.json({ ...updatedRole[0], permissions: updatedPerms.map(p => p.permission) });
  } catch (err) {
    console.error("Update role error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/organizations/:orgId/roles/:roleId
router.delete("/:roleId", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId, roleId } = req.params;
    const user = req.user!;

    const isOrgAdmin = user.role === "org_admin" || user.role === "super_admin";
    if (!isOrgAdmin && !user.permissions.includes("roles.manage")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const roles = await db.select().from(rolesTable).where(eq(rolesTable.id, roleId)).limit(1);
    const role = roles[0];
    if (!role) {
      res.status(404).json({ error: "Role not found" });
      return;
    }
    if (role.isSystem || role.isDefault) {
      res.status(403).json({ error: "Cannot delete system or default roles" });
      return;
    }
    if (role.orgId !== orgId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [userCount] = await db.select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.roleId, roleId));
    if (Number(userCount?.count ?? 0) > 0) {
      res.status(409).json({
        error: "Cannot delete role with assigned users",
        userCount: Number(userCount?.count ?? 0),
      });
      return;
    }

    await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, roleId));
    await db.delete(rolesTable).where(eq(rolesTable.id, roleId));

    res.json({ success: true });
  } catch (err) {
    console.error("Delete role error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
