import { Router } from "express";
import { db, organizationsTable, branchesTable, visitRequestsTable, visitorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { generateId, generateQrCode, generateToken } from "../lib/id.js";
import { addHours } from "../lib/dateUtils.js";

const router = Router();

// GET /api/public/orgs/:slug
router.get("/orgs/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const orgs = await db.select().from(organizationsTable)
      .where(and(eq(organizationsTable.publicBookingSlug, slug), eq(organizationsTable.status, "active")))
      .limit(1);
    if (!orgs[0]) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const org = orgs[0];
    const branches = await db.select().from(branchesTable)
      .where(and(eq(branchesTable.orgId, org.id), eq(branchesTable.isActive, true)));

    res.json({
      id: org.id,
      name: org.name,
      nameAr: org.nameAr,
      logo: org.logo,
      address: org.address,
      branches: branches.map(b => ({ id: b.id, name: b.name, nameAr: b.nameAr })),
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/public/orgs/:slug/book
router.post("/orgs/:slug/book", async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      visitorName, visitorNameAr, nationalId, phone, email, companyName,
      branchId, purpose, scheduledDate, scheduledTimeFrom, notes,
    } = req.body;

    if (!visitorName || !phone || !branchId || !purpose || !scheduledDate) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const orgs = await db.select().from(organizationsTable)
      .where(and(eq(organizationsTable.publicBookingSlug, slug), eq(organizationsTable.status, "active")))
      .limit(1);
    if (!orgs[0]) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    // Find or create visitor
    let visitor = phone
      ? (await db.select().from(visitorsTable).where(eq(visitorsTable.phone, phone)).limit(1))[0]
      : null;

    if (!visitor) {
      const visitorId = generateId();
      await db.insert(visitorsTable).values({
        id: visitorId,
        fullName: visitorName,
        fullNameAr: visitorNameAr,
        nationalIdNumber: nationalId,
        phone,
        email,
        companyName,
        isBlacklisted: false,
        verificationStatus: "pending",
      });
      const newVisitors = await db.select().from(visitorsTable).where(eq(visitorsTable.id, visitorId)).limit(1);
      visitor = newVisitors[0];
    }

    const requestId = generateId();
    const trackingToken = generateToken(16);

    // Check if auto-approve is enabled
    const org = orgs[0];
    const autoApprove = (org.settings as Record<string, unknown>)?.auto_approve === true;
    const status = autoApprove ? "approved" : "pending";
    const qrCode = autoApprove ? generateQrCode() : null;

    await db.insert(visitRequestsTable).values({
      id: requestId,
      orgId: org.id,
      branchId,
      visitorId: visitor.id,
      purpose,
      type: "walk_in",
      status,
      scheduledDate,
      scheduledTimeFrom,
      qrCode,
      qrExpiresAt: qrCode ? addHours(new Date(scheduledDate), 24) : null,
      trackingToken,
      notes,
    });

    const message = autoApprove
      ? "Your visit request has been automatically approved! Check your QR pass via the link sent."
      : "Your visit request has been submitted and is pending approval. You will be notified once approved.";

    res.status(201).json({
      id: requestId,
      status,
      message,
      trackingToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/public/pass/:token
router.get("/pass/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const requests = await db.select().from(visitRequestsTable)
      .where(eq(visitRequestsTable.trackingToken, token))
      .limit(1);
    if (!requests[0]) {
      res.status(404).json({ error: "Pass not found" });
      return;
    }

    const request = requests[0];
    const [visitor] = await db.select().from(visitorsTable).where(eq(visitorsTable.id, request.visitorId)).limit(1);
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, request.orgId)).limit(1);
    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, request.branchId)).limit(1);

    let hostName = null;
    if (request.hostUserId) {
      const { usersTable } = await import("@workspace/db");
      const [host] = await db.select().from(usersTable).where(eq(usersTable.id, request.hostUserId)).limit(1);
      hostName = host?.name || null;
    }

    res.json({
      requestId: request.id,
      visitorName: visitor?.fullName || "",
      hostName,
      orgName: org?.name || "",
      orgLogo: org?.logo || null,
      branchName: branch?.name || "",
      scheduledDate: request.scheduledDate,
      scheduledTimeFrom: request.scheduledTimeFrom,
      scheduledTimeTo: request.scheduledTimeTo,
      status: request.status,
      qrCodeData: request.status === "approved" ? request.qrCode : null,
      purpose: request.purpose,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
