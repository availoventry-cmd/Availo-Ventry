import { pgTable, text, boolean, integer, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orgTypeEnum = pgEnum("org_type", ["government", "enterprise", "smb"]);
export const orgStatusEnum = pgEnum("org_status", ["active", "suspended", "pending_setup", "deactivated"]);
export const subscriptionTierEnum = pgEnum("subscription_tier", ["starter", "professional", "enterprise", "government"]);
export const verificationPolicyEnum = pgEnum("verification_policy", [
  "none", "otp_only", "nafath_only", "otp_or_nafath", "nafath_required_otp_fallback"
]);

export const organizationsTable = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  logo: text("logo"),
  address: text("address"),
  type: orgTypeEnum("type").notNull(),
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("starter"),
  publicBookingSlug: text("public_booking_slug").unique(),
  status: orgStatusEnum("status").notNull().default("pending_setup"),
  verificationPolicy: verificationPolicyEnum("verification_policy").notNull().default("none"),
  nafathEnabled: boolean("nafath_enabled").notNull().default(false),
  otpEnabled: boolean("otp_enabled").notNull().default(true),
  verificationBypassForTrusted: boolean("verification_bypass_for_trusted").notNull().default(false),
  maxUsers: integer("max_users").notNull().default(20),
  maxBranches: integer("max_branches").notNull().default(5),
  telegramChatId: text("telegram_chat_id"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  contractStartDate: text("contract_start_date"),
  contractEndDate: text("contract_end_date"),
  suspensionReason: text("suspension_reason"),
  setupWizardCompleted: boolean("setup_wizard_completed").notNull().default(false),
  settings: jsonb("settings").$type<Record<string, unknown>>(),
  createdById: text("created_by_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  activatedAt: timestamp("activated_at"),
  suspendedAt: timestamp("suspended_at"),
  deactivatedAt: timestamp("deactivated_at"),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
