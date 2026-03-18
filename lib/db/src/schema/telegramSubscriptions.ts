import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const telegramSubscriptionsTable = pgTable("telegram_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  orgId: text("org_id"),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  notifyApprovals: boolean("notify_approvals").notNull().default(true),
  notifyCheckIns: boolean("notify_check_ins").notNull().default(true),
  notifyWalkIns: boolean("notify_walk_ins").notNull().default(true),
  notifyRejections: boolean("notify_rejections").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
