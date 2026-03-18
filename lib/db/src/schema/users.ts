import { pgTable, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin", "org_admin", "visitor_manager", "receptionist", "host_employee"
]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  branchId: text("branch_id"),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  nationalId: text("national_id"),
  role: userRoleEnum("role").notNull(),
  department: text("department"),
  jobTitle: text("job_title"),
  isActive: boolean("is_active").notNull().default(true),
  isLocked: boolean("is_locked").notNull().default(false),
  lockReason: text("lock_reason"),
  invitedById: text("invited_by_id"),
  invitationAcceptedAt: timestamp("invitation_accepted_at"),
  telegramUserId: text("telegram_user_id"),
  telegramLinkedAt: timestamp("telegram_linked_at"),
  lastLoginAt: timestamp("last_login_at"),
  lastActiveAt: timestamp("last_active_at"),
  loginCount: integer("login_count").notNull().default(0),
  passwordHash: text("password_hash").notNull(),
  passwordChangedAt: timestamp("password_changed_at"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorMethod: text("two_factor_method"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deactivatedAt: timestamp("deactivated_at"),
  deactivatedById: text("deactivated_by_id"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
  updatedAt: true,
  loginCount: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
