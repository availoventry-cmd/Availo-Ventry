import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blacklistTable = pgTable("blacklist", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  reason: text("reason").notNull(),
  blacklistedById: text("blacklisted_by_id").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBlacklistSchema = createInsertSchema(blacklistTable).omit({
  createdAt: true,
});
export type InsertBlacklist = z.infer<typeof insertBlacklistSchema>;
export type Blacklist = typeof blacklistTable.$inferSelect;
