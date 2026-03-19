import { Router } from "express";
import { db, visitRequestsTable, visitorsTable, usersTable, branchesTable, organizationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireOrgAccess, requirePermission } from "../lib/auth.js";
import { generateId, generateQrCode, generateToken } from "../lib/id.js";
import { addHours } from "../lib/dateUtils.js";
import { notifyVisitApproved, notifyCheckIn, notifyRejection } from "../lib/notifyTelegram.js";
import { sendEmail, buildVisitApprovedEmail, getBaseUrl } from "../lib/email.js";

const router = Router({ mergeParams: true });

async function enrichRequest(req: typeof visitRequestsTable.$inferSelect) {
  const [visitor] = req.visitorId ? await db.select().from(visitorsTable).where(eq(visitorsTable.id, req.visitorId)).limit(1) : [null];
  const [host] = req.hostUserId ? await db.select().from(usersTable).where(eq(usersTable.id, req.hostUserId)).limit(1) : [null];
  const [branch] = req.branchId ? await db.select().from(branchesTable).where(eq(branchesTable.id, req.branchId)).limit(1) : [null];

  return {
    ...req,
    visitor: visitor ? {
      id: visitor.id, fullName: visitor.fullName, fullNameAr: visitor.fullNameAr,
      phone: visitor.phone, email: visitor.email, companyName: visitor.companyName,
      nationalIdNumber: visitor.nationalIdNumber, isBlacklisted: visitor.isBlacklisted,
      verificationStatus: visitor.verificationStatus, createdAt: visitor.createdAt,
    } : null,
    hostUser: host ? { id: host.id, name: host.name, email: host.email, role: host.role } : null,
    branch: branch ? { id: branch.id, name: branch.name, branchCode: branch.branchCode } : null,
  };
}

// GET /api/organizations/:orgId/visit-requests
router.get("/", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { status, type, branchId, dateFrom, dateTo, search, page = "1", limit = "20" } = req.query;
    const user = req.user!;

    let requests = await db.select().from(visitRequestsTable)
      .where(eq(visitRequestsTable.orgId, orgId))
      .orderBy(sql`${visitRequestsTable.createdAt} DESC`);

    if (user.role === "host_employee") {
      requests = requests.filter(r => r.hostUserId === user.id);
    }
    if (user.role === "receptionist") {
      const today = new Date().toISOString().split("T")[0];
      requests = requests.filter(r => r.scheduledDate === today && (user.branchId ? r.branchId === user.branchId : true));
    }
    if (user.role === "visitor_manager" && user.branchId) {
      requests = requests.filter(r => r.branchId === user.branchId);
    }

    if (status) requests = requests.filter(r => r.status === status);
    if (type) requests = requests.filter(r => r.type === type);
    if (branchId) requests = requests.filter(r => r.branchId === (branchId as string));
    if (dateFrom) requests = requests.filter(r => r.scheduledDate >= (dateFrom as string));
    if (dateTo) requests = requests.filter(r => r.scheduledDate <= (dateTo as string));

    const p = parseInt(page as string);
    const l = parseInt(limit as string);

    if (search && (search as string).trim()) {
      const s = (search as string).toLowerCase().trim();
      const allEnriched = await Promise.all(requests.map(enrichRequest));
      const matched = allEnriched.filter(r =>
        r.visitor?.fullName?.toLowerCase().includes(s) ||
        r.visitor?.phone?.includes(s) ||
        r.visitor?.email?.toLowerCase().includes(s) ||
        r.purpose?.toLowerCase().includes(s)
      );
      const total = matched.length;
      const paginated = matched.slice((p - 1) * l, p * l);
      res.json({ data: paginated, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
      return;
    }

    const total = requests.length;
    const paginated = requests.slice((p - 1) * l, p * l);
    const enriched = await Promise.all(paginated.map(enrichRequest));
    res.json({ data: enriched, meta: { total, page: p, limit: l, totalPages: Math.ceil(total / l) } });
  } catch (err) {
    console.error("List visit requests error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/visit-requests
router.post("/", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId } = req.params;
    const user = req.user!;
    const {
      branchId, visitorName, visitorNameAr, visitorNationalId,
      visitorPhone, visitorEmail, visitorCompany,
      purpose, purposeAr, scheduledDate, scheduledTimeFrom, scheduledTimeTo, notes,
    } = req.body;

    if (!branchId || !visitorName || !purpose || !scheduledDate) {
      res.status(400).json({ error: "Branch, visitor name, purpose, and date are required" });
      return;
    }

    // Create or find visitor (only match if same name to avoid merging different people)
    let visitor: typeof visitorsTable.$inferSelect | null = null;
    if (visitorPhone || visitorNationalId) {
      const candidates = await db.select().from(visitorsTable)
        .where(visitorPhone
          ? eq(visitorsTable.phone, visitorPhone)
          : eq(visitorsTable.nationalIdNumber, visitorNationalId!));
      visitor = candidates.find(v => v.fullName.toLowerCase().trim() === visitorName.toLowerCase().trim()) || null;
    }

    if (!visitor) {
      const visitorId = generateId();
      await db.insert(visitorsTable).values({
        id: visitorId,
        fullName: visitorName,
        fullNameAr: visitorNameAr,
        nationalIdNumber: visitorNationalId,
        phone: visitorPhone,
        email: visitorEmail,
        companyName: visitorCompany,
        isBlacklisted: false,
        verificationStatus: "pending",
      });
      const newVisitors = await db.select().from(visitorsTable).where(eq(visitorsTable.id, visitorId)).limit(1);
      visitor = newVisitors[0];
    } else {
      const visitorUpdates: Record<string, unknown> = { updatedAt: new Date() };
      if (visitorEmail && !visitor.email) visitorUpdates.email = visitorEmail;
      if (visitorPhone && !visitor.phone) visitorUpdates.phone = visitorPhone;
      if (visitorNationalId && !visitor.nationalIdNumber) visitorUpdates.nationalIdNumber = visitorNationalId;
      if (visitorCompany && !visitor.companyName) visitorUpdates.companyName = visitorCompany;

      if (Object.keys(visitorUpdates).length > 1) {
        await db.update(visitorsTable).set(visitorUpdates as any)
          .where(eq(visitorsTable.id, visitor.id));
      }
    }

    const requestId = generateId();
    const qrCode = generateQrCode();
    const trackingToken = generateToken(16);

    await db.insert(visitRequestsTable).values({
      id: requestId,
      orgId,
      branchId,
      visitorId: visitor.id,
      hostUserId: user.role === "host_employee" ? user.id : null,
      purpose,
      purposeAr,
      type: "pre_registered",
      status: "pending",
      scheduledDate,
      scheduledTimeFrom,
      scheduledTimeTo,
      qrCode,
      qrExpiresAt: addHours(new Date(scheduledDate), 24),
      trackingToken,
      notes,
    });

    const requests = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, requestId)).limit(1);
    const enriched = await enrichRequest(requests[0]);
    res.status(201).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/organizations/:orgId/visit-requests/:requestId
router.get("/:requestId", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId, requestId } = req.params;
    const requests = await db.select().from(visitRequestsTable)
      .where(and(eq(visitRequestsTable.id, requestId), eq(visitRequestsTable.orgId, orgId)))
      .limit(1);
    if (!requests[0]) {
      res.status(404).json({ error: "Visit request not found" });
      return;
    }
    const enriched = await enrichRequest(requests[0]);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/visit-requests/:requestId/approve
router.patch("/:requestId/approve", requireAuth, requireOrgAccess, requirePermission("visit_requests.approve"), async (req, res) => {
  try {
    const { orgId, requestId } = req.params;

    const currentReq = await db.select().from(visitRequestsTable)
      .where(and(eq(visitRequestsTable.id, requestId), eq(visitRequestsTable.orgId, orgId)))
      .limit(1);

    if (!currentReq[0]) {
      res.status(404).json({ error: "Visit request not found" });
      return;
    }

    const qrCode = currentReq[0].qrCode || generateQrCode();
    const trackingToken = currentReq[0].trackingToken || generateToken(16);

    await db.update(visitRequestsTable).set({
      status: "approved",
      approvedById: req.user!.id,
      approvedAt: new Date(),
      approvalMethod: "web",
      notes: req.body.notes || currentReq[0].notes || null,
      qrCode,
      qrExpiresAt: addHours(new Date(), 24),
      trackingToken,
    }).where(and(eq(visitRequestsTable.id, requestId), eq(visitRequestsTable.orgId, orgId)));
    const updated = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, requestId)).limit(1);
    const enriched = await enrichRequest(updated[0]);
    res.json(enriched);

    // Fire-and-forget email notification
    if (enriched.visitor?.email) {
      const [visitOrg] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
      const baseUrl = getBaseUrl(req);
      const passLink = `${baseUrl}/public/pass/${enriched.trackingToken}`;
      sendEmail({
        to: enriched.visitor.email,
        subject: `Your visit to ${visitOrg?.name || "the organization"} has been approved`,
        html: buildVisitApprovedEmail({
          visitorName: enriched.visitor.fullName,
          organizationName: visitOrg?.name || "the organization",
          scheduledDate: enriched.scheduledDate,
          scheduledTime: enriched.scheduledTimeFrom || undefined,
          passLink,
          qrCode: enriched.qrCode || undefined,
        }),
      }).catch(console.error);
    }

    // Fire-and-forget Telegram notification
    if (enriched.visitor) {
      notifyVisitApproved({
        visitorName: enriched.visitor.fullName,
        purpose: enriched.purpose,
        scheduledDate: enriched.scheduledDate,
        scheduledTimeFrom: enriched.scheduledTimeFrom,
        qrCode: enriched.qrCode,
        trackingToken: enriched.trackingToken,
        hostUserId: enriched.hostUserId,
        orgId,
      }).catch(console.error);
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/visit-requests/:requestId/reject
router.patch("/:requestId/reject", requireAuth, requireOrgAccess, requirePermission("visit_requests.approve"), async (req, res) => {
  try {
    const { orgId, requestId } = req.params;
    await db.update(visitRequestsTable).set({
      status: "rejected",
      approvedById: req.user!.id,
      approvedAt: new Date(),
      rejectionReason: req.body.rejectionReason || null,
      notes: req.body.notes || null,
    }).where(and(eq(visitRequestsTable.id, requestId), eq(visitRequestsTable.orgId, orgId)));
    const updated = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, requestId)).limit(1);
    const enriched = await enrichRequest(updated[0]);
    res.json(enriched);

    if (enriched.visitor) {
      notifyRejection({
        visitorName: enriched.visitor.fullName,
        purpose: enriched.purpose,
        rejectionReason: enriched.rejectionReason,
        hostUserId: enriched.hostUserId,
        orgId,
      }).catch(console.error);
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/visit-requests/:requestId/cancel
router.patch("/:requestId/cancel", requireAuth, requireOrgAccess, async (req, res) => {
  try {
    const { orgId, requestId } = req.params;
    const requests = await db.select().from(visitRequestsTable)
      .where(and(eq(visitRequestsTable.id, requestId), eq(visitRequestsTable.orgId, orgId)))
      .limit(1);
    if (!requests[0]) {
      res.status(404).json({ error: "Visit request not found" });
      return;
    }
    // Host employees can only cancel their own
    if (req.user!.role === "host_employee" && requests[0].hostUserId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.update(visitRequestsTable).set({ status: "cancelled" })
      .where(and(eq(visitRequestsTable.id, requestId), eq(visitRequestsTable.orgId, orgId)));
    const updated = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, requestId)).limit(1);
    const enriched = await enrichRequest(updated[0]);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/visit-requests/:requestId/check-in
router.patch("/:requestId/check-in", requireAuth, requireOrgAccess, requirePermission("visit_requests.check_in"), async (req, res) => {
  try {
    const { orgId, requestId } = req.params;
    const checkInTime = new Date();
    await db.update(visitRequestsTable).set({
      status: "checked_in",
      checkInTime,
      checkedInById: req.user!.id,
    }).where(and(eq(visitRequestsTable.id, requestId), eq(visitRequestsTable.orgId, orgId)));
    const updated = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, requestId)).limit(1);
    const enriched = await enrichRequest(updated[0]);
    res.json(enriched);

    if (enriched.visitor && enriched.branch) {
      notifyCheckIn({
        visitorName: enriched.visitor.fullName,
        purpose: enriched.purpose,
        branchName: enriched.branch.name,
        checkInTime: checkInTime.toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" }),
        hostUserId: enriched.hostUserId,
        hostName: enriched.hostUser?.name,
        orgId,
      }).catch(console.error);
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/organizations/:orgId/visit-requests/:requestId/check-out
router.patch("/:requestId/check-out", requireAuth, requireOrgAccess, requirePermission("visit_requests.check_in", "visit_requests.check_out"), async (req, res) => {
  try {
    const { orgId, requestId } = req.params;
    await db.update(visitRequestsTable).set({
      status: "checked_out",
      checkOutTime: new Date(),
    }).where(and(eq(visitRequestsTable.id, requestId), eq(visitRequestsTable.orgId, orgId)));
    const updated = await db.select().from(visitRequestsTable).where(eq(visitRequestsTable.id, requestId)).limit(1);
    const enriched = await enrichRequest(updated[0]);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/visit-requests/scan-qr
router.post("/scan-qr", requireAuth, requireOrgAccess, requirePermission("visit_requests.check_in", "visit_requests.check_out"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { qrCode } = req.body;
    if (!qrCode) {
      res.status(400).json({ error: "QR code is required" });
      return;
    }

    const requests = await db.select().from(visitRequestsTable)
      .where(and(eq(visitRequestsTable.qrCode, qrCode), eq(visitRequestsTable.orgId, orgId)))
      .limit(1);
    if (!requests[0]) {
      res.status(404).json({ error: "Invalid QR code" });
      return;
    }

    const request = requests[0];
    if (request.status === "cancelled" || request.status === "expired" || request.status === "rejected") {
      res.status(400).json({ error: `Visit request is ${request.status}` });
      return;
    }

    const enriched = await enrichRequest(request);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/visit-requests/batch-approve
router.post("/batch-approve", requireAuth, requireOrgAccess, requirePermission("visit_requests.approve"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { requestIds } = req.body;

    const results = await Promise.all(requestIds.map(async (id: string) => {
      try {
        await db.update(visitRequestsTable).set({
          status: "approved",
          approvedById: req.user!.id,
          approvedAt: new Date(),
          approvalMethod: "web",
        }).where(and(eq(visitRequestsTable.id, id), eq(visitRequestsTable.orgId, orgId)));
        return { requestId: id, success: true };
      } catch {
        return { requestId: id, success: false, error: "Failed to approve" };
      }
    }));

    const processed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    res.json({ processed, failed, results });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/organizations/:orgId/visit-requests/batch-reject
router.post("/batch-reject", requireAuth, requireOrgAccess, requirePermission("visit_requests.approve"), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { requestIds, notes } = req.body;

    const results = await Promise.all(requestIds.map(async (id: string) => {
      try {
        await db.update(visitRequestsTable).set({
          status: "rejected",
          approvedById: req.user!.id,
          approvedAt: new Date(),
          notes: notes || null,
        }).where(and(eq(visitRequestsTable.id, id), eq(visitRequestsTable.orgId, orgId)));
        return { requestId: id, success: true };
      } catch {
        return { requestId: id, success: false, error: "Failed to reject" };
      }
    }));

    const processed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    res.json({ processed, failed, results });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
