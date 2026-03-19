import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rolePermissionsTable = pgTable("role_permissions", {
  id: text("id").primaryKey(),
  roleId: text("role_id").notNull(),
  permission: text("permission").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("role_permissions_role_id_permission_unique").on(table.roleId, table.permission),
]);

export const insertRolePermissionSchema = createInsertSchema(rolePermissionsTable).omit({
  createdAt: true,
});
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;
