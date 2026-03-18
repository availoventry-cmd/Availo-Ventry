import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "expired", "revoked"]);

export const invitationsTable = pgTable("invitations", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  branchId: text("branch_id"),
  invitedById: text("invited_by_id").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  role: text("role").notNull(),
  department: text("department"),
  jobTitle: text("job_title"),
  invitationToken: text("invitation_token").notNull().unique(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  status: invitationStatusEnum("status").notNull().default("pending"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  revokedById: text("revoked_by_id"),
  resendCount: integer("resend_count").notNull().default(0),
  lastResentAt: timestamp("last_resent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInvitationSchema = createInsertSchema(invitationsTable).omit({
  createdAt: true,
  sentAt: true,
  resendCount: true,
});
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitationsTable.$inferSelect;
