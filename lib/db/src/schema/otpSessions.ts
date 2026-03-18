import { pgTable, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const otpSessionsTable = pgTable("otp_sessions", {
  id: text("id").primaryKey(),
  phone: text("phone"),
  email: text("email"),
  otp: text("otp").notNull(),
  channel: text("channel").notNull().default("sms"),
  attempts: integer("attempts").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
