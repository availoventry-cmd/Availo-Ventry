import { pgTable, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rolesTable = pgTable("roles", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("roles_org_id_slug_unique").on(table.orgId, table.slug),
]);

export const insertRoleSchema = createInsertSchema(rolesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof rolesTable.$inferSelect;
