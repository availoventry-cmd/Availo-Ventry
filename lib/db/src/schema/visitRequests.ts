import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const visitRequestStatusEnum = pgEnum("visit_request_status", [
  "pending", "approved", "rejected", "checked_in", "checked_out", "expired", "cancelled"
]);
export const visitRequestTypeEnum = pgEnum("visit_request_type", ["pre_registered", "walk_in"]);

export const visitRequestsTable = pgTable("visit_requests", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  branchId: text("branch_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  hostUserId: text("host_user_id"),
  purpose: text("purpose").notNull(),
  purposeAr: text("purpose_ar"),
  type: visitRequestTypeEnum("type").notNull().default("walk_in"),
  status: visitRequestStatusEnum("status").notNull().default("pending"),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTimeFrom: text("scheduled_time_from"),
  scheduledTimeTo: text("scheduled_time_to"),
  qrCode: text("qr_code").unique(),
  qrExpiresAt: timestamp("qr_expires_at"),
  trackingToken: text("tracking_token").unique(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  checkedInById: text("checked_in_by_id"),
  approvalMethod: text("approval_method"),
  approvedById: text("approved_by_id"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVisitRequestSchema = createInsertSchema(visitRequestsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertVisitRequest = z.infer<typeof insertVisitRequestSchema>;
export type VisitRequest = typeof visitRequestsTable.$inferSelect;
