import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key() {
  const raw = process.env.BUSIGO_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("BUSIGO_TOKEN_ENCRYPTION_KEY is not configured.");
  return createHash("sha256").update(raw).digest();
}
export function encryptSecret(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
export function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
