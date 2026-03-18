import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + password).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const inputHash = createHash("sha256").update(salt + password).digest("hex");
  const inputBuffer = Buffer.from(inputHash, "hex");
  const storedBuffer = Buffer.from(hash, "hex");
  if (inputBuffer.length !== storedBuffer.length) return false;
  return timingSafeEqual(inputBuffer, storedBuffer);
}
