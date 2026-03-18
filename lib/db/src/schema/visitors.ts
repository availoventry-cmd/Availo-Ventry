import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const visitorsTable = pgTable("visitors", {
  id: text("id").primaryKey(),
  nationalIdNumber: text("national_id_number"),
  fullName: text("full_name").notNull(),
  fullNameAr: text("full_name_ar"),
  phone: text("phone"),
  email: text("email"),
  companyName: text("company_name"),
  photoUrl: text("photo_url"),
  isBlacklisted: boolean("is_blacklisted").notNull().default(false),
  blacklistReason: text("blacklist_reason"),
  verificationStatus: text("verification_status").notNull().default("pending"),
  nafathVerifiedAt: timestamp("nafath_verified_at"),
  nafathTransactionId: text("nafath_transaction_id"),
  nafathConfidenceLevel: text("nafath_confidence_level"),
  otpVerifiedAt: timestamp("otp_verified_at"),
  otpPhoneUsed: text("otp_phone_used"),
  lastVerificationMethod: text("last_verification_method"),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVisitorSchema = createInsertSchema(visitorsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitorsTable.$inferSelect;
