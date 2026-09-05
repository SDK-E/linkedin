import crypto from "node:crypto";

const memory = new Map<string, string>();
const redisUrl = process.env.KV_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN;
const encryptionKey = process.env.SESSION_ENCRYPTION_KEY;

function keyBytes() {
  if (!encryptionKey) return null;
  return crypto.createHash("sha256").update(encryptionKey).digest();
}

function encrypt(value: unknown) {
  const key = keyBytes();
  const plain = JSON.stringify(value);
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt<T>(value: string): T {
  const key = keyBytes();
  if (!value.startsWith("v1.")) return JSON.parse(value) as T;
  if (!key) throw new Error("SESSION_ENCRYPTION_KEY is required to decrypt stored sessions");
  const [, ivRaw, tagRaw, dataRaw] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as T;
}

async function redis(command: unknown[]) {
  if (!redisUrl || !redisToken) return null;
  const response = await fetch(redisUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Store ${response.status}: ${await response.text()}`);
  return (await response.json()) as { result: unknown };
}

export async function put<T>(key: string, value: T, ttlSeconds?: number) {
  const encoded = encrypt(value);
  if (redisUrl && redisToken) {
    await redis(ttlSeconds ? ["SET", key, encoded, "EX", ttlSeconds] : ["SET", key, encoded]);
    return;
  }
  memory.set(key, encoded);
}

export async function get<T>(key: string): Promise<T | null> {
  if (redisUrl && redisToken) {
    const response = await redis(["GET", key]);
    if (!response?.result) return null;
    return decrypt<T>(String(response.result));
  }
  const value = memory.get(key);
  return value ? decrypt<T>(value) : null;
}

export async function remove(key: string) {
  if (redisUrl && redisToken) {
    await redis(["DEL", key]);
    return;
  }
  memory.delete(key);
}
