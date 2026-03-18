import { pgTable, text, boolean, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const entryModeEnum = pgEnum("entry_mode", ["staffed", "unmanned", "hybrid"]);

export const branchesTable = pgTable("branches", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  address: text("address"),
  city: text("city"),
  branchCode: text("branch_code").notNull(),
  entryMode: entryModeEnum("entry_mode").notNull().default("staffed"),
  verificationPolicyOverride: text("verification_policy_override"),
  isActive: boolean("is_active").notNull().default(true),
  maxConcurrentVisitors: integer("max_concurrent_visitors"),
  workingHoursOverride: jsonb("working_hours_override").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBranchSchema = createInsertSchema(branchesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branchesTable.$inferSelect;
