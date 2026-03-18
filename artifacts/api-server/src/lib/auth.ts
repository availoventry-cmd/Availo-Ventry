import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  nameAr: string | null;
  role: string;
  orgId: string | null;
  branchId: string | null;
  department: string | null;
  jobTitle: string | null;
  mustChangePassword: boolean;
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

  req.user = {
    id: user[0].id,
    email: user[0].email,
    name: user[0].name,
    nameAr: user[0].nameAr,
    role: user[0].role,
    orgId: user[0].orgId,
    branchId: user[0].branchId,
    department: user[0].department,
    jobTitle: user[0].jobTitle,
    mustChangePassword: user[0].mustChangePassword,
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
