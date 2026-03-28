const AUTHENTICA_BASE = "https://api.authentica.sa/api/v2";

function getApiKey(): string {
  const key = process.env.AUTHENTICA_API_KEY;
  if (!key) throw new Error("AUTHENTICA_API_KEY environment variable is not set");
  return key;
}

export interface AuthenticaResult {
  success: boolean;
  data?: unknown;
  message?: string;
  errors?: Array<{ message: string }>;
}

export interface AuthenticaVerifyResult {
  status: boolean;
  message?: string;
  errors?: Array<{ message: string }>;
}

export async function sendOtp(params: {
  method: "sms" | "whatsapp" | "email";
  phone?: string;
  email?: string;
}): Promise<AuthenticaResult> {
  try {
    const body: Record<string, string> = { method: params.method };

    if (params.method === "email") {
      if (!params.email) return { success: false, message: "Email is required for email channel" };
      body.email = params.email;
    } else {
      if (!params.phone) return { success: false, message: "Phone is required for SMS/WhatsApp channel" };
      body.phone = params.phone;
    }

    const res = await fetch(`${AUTHENTICA_BASE}/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Authorization": getApiKey(),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as AuthenticaResult;
    console.log(`Authentica send-otp (${params.method}):`, data.success ? "OK" : data.message || "Failed");
    return data;
  } catch (err) {
    console.error("Authentica sendOtp error:", err);
    return { success: false, message: "Failed to send OTP" };
  }
}

export async function verifyOtp(params: {
  phone?: string;
  email?: string;
  otp: string;
}): Promise<AuthenticaVerifyResult> {
  try {
    const body: Record<string, string> = { otp: params.otp };
    if (params.phone) body.phone = params.phone;
    if (params.email) body.email = params.email;

    const res = await fetch(`${AUTHENTICA_BASE}/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Authorization": getApiKey(),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as AuthenticaVerifyResult;
    console.log("Authentica verify-otp:", data.status ? "Verified" : data.message || "Failed");
    return data;
  } catch (err) {
    console.error("Authentica verifyOtp error:", err);
    return { status: false, message: "Failed to verify OTP" };
  }
}

export async function getBalance(): Promise<{ success: boolean; balance?: number }> {
  try {
    const res = await fetch(`${AUTHENTICA_BASE}/balance`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Authorization": getApiKey(),
      },
    });
    const data = await res.json();
    return { success: data.success, balance: data.data?.balance };
  } catch (err) {
    console.error("Authentica getBalance error:", err);
    return { success: false };
  }
}

export function isConfigured(): boolean {
  return !!process.env.AUTHENTICA_API_KEY;
}
