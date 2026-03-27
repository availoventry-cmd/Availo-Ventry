import { randomBytes } from "crypto";

export function generateId(): string {
  return randomBytes(12).toString("hex");
}

export function generateToken(length = 32): string {
  return randomBytes(length).toString("hex");
}

export function generateQrCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
