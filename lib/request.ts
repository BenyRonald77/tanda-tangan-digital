import type { NextRequest } from "next/server";

/** IP klien dari header proxy, fallback "unknown". */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function userAgent(req: NextRequest): string {
  return (req.headers.get("user-agent") || "").slice(0, 500);
}
