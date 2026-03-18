const AUTHENTICA_BASE = "https://api.authentica.sa/api/v2";

function getApiKey(): string {
  const key = process.env.AUTHENTICA_API_KEY;
  if (!key) throw new Error("AUTHENTICA_API_KEY environment variable is not set");
  return key;
}

function getSenderName(): string {
  return process.env.AUTHENTICA_SENDER_NAME || "Ventry";
}

export interface AuthenticaResult {
  success: boolean;
  message?: string;
  errors?: Array<{ message: string }>;
}

export interface AuthenticaVerifyResult {
  success: boolean;
  valid?: boolean;
  message?: string;
  errors?: Array<{ message: string }>;
}

export async function sendSmsOtp(phone: string, otp: string): Promise<AuthenticaResult> {
  const message = `Your Ventry verification code is: ${otp}. It expires in 10 minutes. Do not share it with anyone.`;

  try {
    const res = await fetch(`${AUTHENTICA_BASE}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Authorization": getApiKey(),
      },
      body: JSON.stringify({
        phone,
        message,
        sender_name: getSenderName(),
      }),
    });

    const data = await res.json() as AuthenticaResult;
    return data;
  } catch (err) {
    console.error("Authentica sendSmsOtp error:", err);
    return { success: false, message: "Failed to send OTP" };
  }
}

export async function sendWhatsappOtp(phone: string, otp: string): Promise<AuthenticaResult> {
  const message = `Your Ventry verification code is: *${otp}*\nIt expires in 10 minutes.`;

  try {
    const res = await fetch(`${AUTHENTICA_BASE}/send-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Authorization": getApiKey(),
      },
      body: JSON.stringify({
        phone,
        message,
      }),
    });

    const data = await res.json() as AuthenticaResult;
    return data;
  } catch (err) {
    console.error("Authentica sendWhatsappOtp error:", err);
    return { success: false, message: "Failed to send OTP via WhatsApp" };
  }
}

export async function sendEmailOtp(email: string, otp: string, name: string): Promise<AuthenticaResult> {
  try {
    const res = await fetch(`${AUTHENTICA_BASE}/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Authorization": getApiKey(),
      },
      body: JSON.stringify({
        email,
        subject: "Ventry Visitor Verification Code",
        message: `Hello ${name},\n\nYour Ventry verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      }),
    });

    const data = await res.json() as AuthenticaResult;
    return data;
  } catch (err) {
    console.error("Authentica sendEmailOtp error:", err);
    return { success: false, message: "Failed to send OTP via Email" };
  }
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
