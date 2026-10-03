import crypto from "crypto";

function secret(): string {
  return process.env.FILE_TOKEN_SECRET || "dev-secret-jangan-dipakai-produksi";
}

/** Token HMAC bertanda untuk unduhan file versi: `${exp}.${sig}` */
export function signDownloadToken(versionId: number, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${versionId}.${exp}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyDownloadToken(versionId: number, token: string | null): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = parseInt(expStr, 10);
  if (!exp || Number.isNaN(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const payload = `${versionId}.${exp}`;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export const newSignerToken = () => crypto.randomBytes(24).toString("hex");
