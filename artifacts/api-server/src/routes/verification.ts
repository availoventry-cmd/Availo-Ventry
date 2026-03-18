import { Router } from "express";
import { db, visitorsTable, otpSessionsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { generateId } from "../lib/id.js";
import { sendSmsOtp, sendWhatsappOtp, sendEmailOtp, generateOtp } from "../lib/authentica.js";

const router = Router();

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// POST /api/verification/send-otp
// Sends an OTP to the visitor's phone or email
router.post("/send-otp", async (req, res) => {
  try {
    const { phone, email, channel = "sms", name } = req.body;

    if (!phone && !email) {
      res.status(400).json({ error: "phone or email is required" });
      return;
    }
    if (!["sms", "whatsapp", "email"].includes(channel)) {
      res.status(400).json({ error: "channel must be sms, whatsapp, or email" });
      return;
    }
    if (channel === "email" && !email) {
      res.status(400).json({ error: "email is required for email channel" });
      return;
    }

    const otp = generateOtp();
    const sessionId = generateId();
    const expiresAt = addMinutes(new Date(), OTP_EXPIRY_MINUTES);

    await db.insert(otpSessionsTable).values({
      id: sessionId,
      phone: phone || null,
      email: email || null,
      otp,
      channel,
      attempts: 0,
      verified: false,
      expiresAt,
    });

    let result;
    if (channel === "email") {
      result = await sendEmailOtp(email, otp, name || "Visitor");
    } else if (channel === "whatsapp") {
      result = await sendWhatsappOtp(phone, otp);
    } else {
      result = await sendSmsOtp(phone, otp);
    }

    if (!result.success) {
      await db.delete(otpSessionsTable).where(eq(otpSessionsTable.id, sessionId));
      res.status(502).json({ error: "Failed to send OTP", details: result.errors || result.message });
      return;
    }

    res.json({
      success: true,
      sessionId,
      expiresAt,
      channel,
      message: `OTP sent via ${channel}`,
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/verification/verify-otp
// Verifies an OTP and optionally marks the visitor as verified
router.post("/verify-otp", async (req, res) => {
  try {
    const { sessionId, otp, visitorId } = req.body;

    if (!sessionId || !otp) {
      res.status(400).json({ error: "sessionId and otp are required" });
      return;
    }

    const sessions = await db.select().from(otpSessionsTable)
      .where(eq(otpSessionsTable.id, sessionId))
      .limit(1);

    const session = sessions[0];
    if (!session) {
      res.status(400).json({ error: "Invalid session", code: "SESSION_NOT_FOUND" });
      return;
    }

    if (session.verified) {
      res.status(400).json({ error: "OTP already used", code: "ALREADY_VERIFIED" });
      return;
    }

    if (new Date(session.expiresAt) < new Date()) {
      await db.delete(otpSessionsTable).where(eq(otpSessionsTable.id, sessionId));
      res.status(400).json({ error: "OTP has expired", code: "EXPIRED" });
      return;
    }

    if ((session.attempts || 0) >= MAX_ATTEMPTS) {
      res.status(429).json({ error: "Too many attempts — request a new OTP", code: "TOO_MANY_ATTEMPTS" });
      return;
    }

    if (session.otp !== otp.trim()) {
      await db.update(otpSessionsTable)
        .set({ attempts: (session.attempts || 0) + 1 })
        .where(eq(otpSessionsTable.id, sessionId));

      const remaining = MAX_ATTEMPTS - (session.attempts || 0) - 1;
      res.status(400).json({
        error: "Incorrect OTP",
        code: "WRONG_OTP",
        attemptsRemaining: remaining,
      });
      return;
    }

    await db.update(otpSessionsTable)
      .set({ verified: true })
      .where(eq(otpSessionsTable.id, sessionId));

    if (visitorId) {
      await db.update(visitorsTable)
        .set({
          verificationStatus: "verified_otp",
          otpVerifiedAt: new Date(),
          otpPhoneUsed: session.phone || undefined,
          lastVerificationMethod: "otp",
          lastVerifiedAt: new Date(),
        })
        .where(eq(visitorsTable.id, visitorId));
    }

    res.json({
      success: true,
      verified: true,
      phone: session.phone,
      email: session.email,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/verification/status (authenticated — check if Authentica is configured)
router.get("/status", requireAuth, async (_req, res) => {
  const isConfigured = !!process.env.AUTHENTICA_API_KEY;
  res.json({
    authentica: {
      configured: isConfigured,
      channels: isConfigured ? ["sms", "whatsapp", "email"] : [],
    },
  });
});

export default router;
