import { NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

const store = new Map<string, { count: number; reset: number }>();

function getKey(ip: string, prefix: string) {
  return `${prefix}:${ip}`;
}

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, max, keyPrefix = "rl" } = config;

  return {
    check: (ip: string): { success: boolean; remaining: number; reset: number } => {
      const key = getKey(ip, keyPrefix);
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || entry.reset < now) {
        store.set(key, { count: 1, reset: now + windowMs });
        return { success: true, remaining: max - 1, reset: now + windowMs };
      }

      if (entry.count >= max) {
        return { success: false, remaining: 0, reset: entry.reset };
      }

      entry.count++;
      return { success: true, remaining: max - entry.count, reset: entry.reset };
    },
  };
}

// Rate limiters préfigurés
export const apiLimiter = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "api" });
export const aiLimiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "ai" });
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, keyPrefix: "auth" });

export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

export function rateLimitResponse(reset: number) {
  return NextResponse.json(
    { message: "Trop de requêtes — réessayez dans quelques instants." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        "X-RateLimit-Reset": String(reset),
      },
    }
  );
}
