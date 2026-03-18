import { randomBytes } from "crypto";

export function generateId(): string {
  return randomBytes(12).toString("hex");
}

export function generateToken(length = 32): string {
  return randomBytes(length).toString("hex");
}

export function generateQrCode(): string {
  return randomBytes(24).toString("base64url");
}
