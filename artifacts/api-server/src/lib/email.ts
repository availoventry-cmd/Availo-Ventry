import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  try {
    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      console.warn("SMTP not configured — email not sent. Set SMTP_EMAIL and SMTP_PASSWORD in Secrets.");
      return false;
    }
    await transporter.sendMail({
      from: `"Availo Ventry" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(),
      headers: {
        "X-Priority": "1",
        "X-Mailer": "Availo Ventry Platform",
        "List-Unsubscribe": `<mailto:${process.env.SMTP_EMAIL}?subject=unsubscribe>`,
      },
    });
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

function getBaseUrl(req: any): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") {
    const domains = process.env.REPLIT_DOMAINS;
    if (domains) {
      const first = domains.split(",")[0]?.trim();
      if (first) return `https://${first}`;
    }
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (req?.headers) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) return `${proto}://${host}`;
  }
  return "";
}

export { getBaseUrl };

export function buildInvitationEmail({
  recipientName, organizationName, role, invitationLink, expiresInDays,
}: {
  recipientName: string; organizationName: string; role: string; invitationLink: string; expiresInDays: number;
}): string {
  return `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Availo Ventry</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Smart Visitor Management Platform</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Hello ${recipientName},</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            You have been invited to join <strong>${organizationName}</strong> as <strong style="text-transform: capitalize;">${role.replace(/_/g, " ")}</strong> on the Availo Ventry platform.
          </p>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
            Click the button below to set your password and activate your account:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${invitationLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 20px 0 0;">
            This link expires in ${expiresInDays} days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
        <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Availo Ventry &mdash; Powered by T2</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildPasswordResetEmail({
  recipientName, resetLink, expiresInMinutes,
}: {
  recipientName: string; resetLink: string; expiresInMinutes: number;
}): string {
  return `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #1e3a5f, #2563eb); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Availo Ventry</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Password Reset Request</p>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Hello ${recipientName},</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 20px 0 0;">
            This link expires in ${expiresInMinutes} minutes. If you didn't request a password reset, ignore this email &mdash; your password will remain unchanged.
          </p>
        </div>
        <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Availo Ventry &mdash; Powered by T2</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildVisitApprovedEmail({
  visitorName, organizationName, scheduledDate, scheduledTime, passLink, qrCode,
}: {
  visitorName: string; organizationName: string; scheduledDate: string; scheduledTime?: string; passLink: string; qrCode?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Visit Approved</h1>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Hello ${visitorName},</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Your visit to <strong>${organizationName}</strong> has been approved.
          </p>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 0 0 20px;">
            <p style="margin: 0 0 4px; color: #166534; font-weight: 600;">Scheduled Date: ${scheduledDate}</p>
            ${scheduledTime ? `<p style="margin: 0; color: #166534;">Time: ${scheduledTime}</p>` : ""}
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${passLink}" style="display: inline-block; background: #059669; color: #ffffff; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
              View Entry Pass &amp; QR Code
            </a>
          </div>
          ${qrCode ? `
          <div style="text-align: center; margin: 20px 0 0;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCode)}" alt="QR Code" style="width: 180px; height: 180px; border-radius: 12px; border: 2px solid #e2e8f0;" />
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; text-align: center; margin: 16px 0 0;">
            <p style="margin: 0 0 4px; color: #94a3b8; font-size: 12px;">Manual Entry Code</p>
            <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; color: #1e293b; letter-spacing: 2px;">${qrCode}</p>
          </div>
          ` : ""}
        </div>
        <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Availo Ventry &mdash; Powered by T2</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function buildVisitRejectedEmail({
  visitorName, organizationName, rejectionReason,
}: {
  visitorName: string; organizationName: string; rejectionReason?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html dir="ltr" lang="en">
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 40px 20px;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Visit Request Update</h1>
        </div>
        <div style="padding: 32px;">
          <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 20px;">Hello ${visitorName},</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
            Unfortunately, your visit request to <strong>${organizationName}</strong> could not be approved at this time.
          </p>
          ${rejectionReason ? `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 0 0 20px;">
            <p style="margin: 0; color: #991b1b; font-weight: 600;">Reason: ${rejectionReason}</p>
          </div>
          ` : ""}
          <p style="color: #475569; line-height: 1.6; margin: 0;">
            You may submit a new request or contact the organization directly for more information.
          </p>
        </div>
        <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Availo Ventry &mdash; Powered by T2</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
