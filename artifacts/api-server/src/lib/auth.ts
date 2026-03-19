import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, rolesTable, rolePermissionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ALL_PERMISSIONS, type Permission } from "@workspace/db";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  nameAr: string | null;
  role: string;
  roleId: string | null;
  orgId: string | null;
  branchId: string | null;
  department: string | null;
  jobTitle: string | null;
  mustChangePassword: boolean;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: {
        userId?: string;
        [key: string]: unknown;
      };
    }
  }
}

const SYSTEM_ROLES = ["super_admin", "org_admin"];
const ALL_PERMISSION_KEYS = Object.keys(ALL_PERMISSIONS) as Permission[];

export async function resolveRoleId(role: string, orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  const match = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(and(eq(rolesTable.orgId, orgId), eq(rolesTable.slug, role)))
    .limit(1);
  return match[0]?.id ?? null;
}

export async function loadPermissions(role: string, roleId: string | null): Promise<string[]> {
  if (SYSTEM_ROLES.includes(role)) {
    return [...ALL_PERMISSION_KEYS];
  }
  if (!roleId) {
    return [];
  }
  const perms = await db
    .select({ permission: rolePermissionsTable.permission })
    .from(rolePermissionsTable)
    .where(eq(rolePermissionsTable.roleId, roleId));
  return perms.map(p => p.permission);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req as unknown as { session?: { userId?: string } }).session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
    return;
  }

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user[0] || !user[0].isActive) {
    res.status(401).json({ error: "Unauthorized", message: "User not found or inactive" });
    return;
  }

  let roleId = user[0].roleId ?? null;

  if (!roleId && !SYSTEM_ROLES.includes(user[0].role) && user[0].orgId) {
    roleId = await resolveRoleId(user[0].role, user[0].orgId);
    if (roleId) {
      await db.update(usersTable).set({ roleId }).where(eq(usersTable.id, user[0].id));
    }
  }

  const permissions = await loadPermissions(user[0].role, roleId);

  req.user = {
    id: user[0].id,
    email: user[0].email,
    name: user[0].name,
    nameAr: user[0].nameAr,
    role: user[0].role,
    roleId,
    orgId: user[0].orgId,
    branchId: user[0].branchId,
    department: user[0].department,
    jobTitle: user[0].jobTitle,
    mustChangePassword: user[0].mustChangePassword,
    permissions,
  };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userPerms = req.user.permissions;
    const hasAny = permissions.some(p => userPerms.includes(p));
    if (!hasAny) {
      res.status(403).json({ error: "Forbidden", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireOrgAccess(req: Request, res: Response, next: NextFunction) {
  const orgId = req.params.orgId;
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role === "super_admin") {
    next();
    return;
  }
  if (req.user.orgId !== orgId) {
    res.status(403).json({ error: "Forbidden", message: "Access denied to this organization" });
    return;
  }
  next();
}
