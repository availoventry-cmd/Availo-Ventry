import { Router } from "express";
import { db, visitorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendOtp, verifyOtp, isConfigured, getBalance } from "../lib/authentica.js";
import crypto from "crypto";

const router = Router();

interface OtpChallenge {
  phone?: string;
  email?: string;
  method: string;
  visitorId?: string;
  loginToken?: string;
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
}

const otpChallenges = new Map<string, OtpChallenge>();

const sendRateLimits = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_SENDS = 3;
const MAX_VERIFY_ATTEMPTS = 5;

function checkSendRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = sendRateLimits.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    sendRateLimits.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_SENDS) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = new Date();
  for (const [key, val] of otpChallenges) {
    if (val.expiresAt < now) otpChallenges.delete(key);
  }
  const nowMs = Date.now();
  for (const [key, val] of sendRateLimits) {
    if (nowMs - val.windowStart > RATE_LIMIT_WINDOW_MS * 2) sendRateLimits.delete(key);
  }
}, 60_000);

router.post("/send-otp", async (req, res) => {
  try {
    const { method = "sms", phone, email, loginToken, visitorId } = req.body;

    if (!["sms", "whatsapp", "email"].includes(method)) {
      res.status(400).json({ error: "method must be sms, whatsapp, or email" });
      return;
    }

    let resolvedPhone = phone;
    let resolvedEmail = email;
    if (loginToken) {
      const { pendingLogins } = await import("./auth-pending.js");
      const pending = pendingLogins.get(loginToken);
      if (!pending || pending.expiresAt < new Date()) {
        res.status(400).json({ error: "Login session expired" });
        return;
      }
      resolvedPhone = pending.phone;
      resolvedEmail = pending.email;
    }

    if (method === "email" && !resolvedEmail) {
      res.status(400).json({ error: "Email is required for email channel" });
      return;
    }
    if ((method === "sms" || method === "whatsapp") && !resolvedPhone) {
      res.status(400).json({ error: "Phone is required for SMS/WhatsApp channel" });
      return;
    }

    const rateLimitKey = resolvedPhone || resolvedEmail || "unknown";
    if (!checkSendRateLimit(rateLimitKey)) {
      res.status(429).json({ error: "Too many OTP requests. Please wait before trying again." });
      return;
    }

    const result = await sendOtp({
      method: method as "sms" | "whatsapp" | "email",
      phone: resolvedPhone,
      email: resolvedEmail,
    });

    if (!result.success) {
      res.status(502).json({ error: "Failed to send OTP", details: result.errors || result.message });
      return;
    }

    const challengeId = crypto.randomBytes(16).toString("hex");
    otpChallenges.set(challengeId, {
      phone: resolvedPhone || undefined,
      email: resolvedEmail || undefined,
      method,
      visitorId: visitorId || undefined,
      loginToken: loginToken || undefined,
      attempts: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    res.json({
      success: true,
      challengeId,
      method,
      phone: resolvedPhone || null,
      email: resolvedEmail || null,
      message: `OTP sent via ${method}`,
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { challengeId, phone, email, otp } = req.body;

    if (!otp) {
      res.status(400).json({ error: "OTP is required" });
      return;
    }

    if (challengeId) {
      const challenge = otpChallenges.get(challengeId);
      if (!challenge) {
        res.status(400).json({ error: "Invalid or expired challenge" });
        return;
      }
      if (challenge.expiresAt < new Date()) {
        otpChallenges.delete(challengeId);
        res.status(400).json({ error: "Challenge expired" });
        return;
      }
      if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
        otpChallenges.delete(challengeId);
        res.status(429).json({ error: "Too many attempts. Please request a new code." });
        return;
      }
      challenge.attempts++;

      const result = await verifyOtp({
        phone: challenge.phone,
        email: challenge.email,
        otp: otp.trim(),
      });

      if (!result.status) {
        res.status(400).json({
          error: "OTP verification failed",
          message: result.message || "Invalid or expired OTP",
          attemptsRemaining: MAX_VERIFY_ATTEMPTS - challenge.attempts,
        });
        return;
      }

      otpChallenges.delete(challengeId);

      if (challenge.visitorId) {
        await db.update(visitorsTable).set({
          verificationStatus: "verified_otp",
          otpVerifiedAt: new Date(),
          otpPhoneUsed: challenge.phone || undefined,
          lastVerificationMethod: "otp",
          lastVerifiedAt: new Date(),
        }).where(eq(visitorsTable.id, challenge.visitorId));
      }

      res.json({
        success: true,
        verified: true,
        phone: challenge.phone || null,
        email: challenge.email || null,
      });
      return;
    }

    if (!phone && !email) {
      res.status(400).json({ error: "Phone or email is required" });
      return;
    }

    const result = await verifyOtp({ phone, email, otp: otp.trim() });

    if (!result.status) {
      res.status(400).json({
        error: "OTP verification failed",
        message: result.message || "Invalid or expired OTP",
      });
      return;
    }

    res.json({
      success: true,
      verified: true,
      phone: phone || null,
      email: email || null,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/status", async (_req, res) => {
  const configured = isConfigured();
  let balance = null;
  if (configured) {
    const balanceResult = await getBalance();
    if (balanceResult.success) balance = balanceResult.balance;
  }
  res.json({
    authentica: {
      configured,
      channels: configured ? ["sms", "whatsapp", "email"] : [],
      balance,
    },
  });
});

export default router;
