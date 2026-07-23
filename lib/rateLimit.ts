import {
  getDemoRateLimitMax,
  getDemoRateLimitWindowMs,
  isDemoMode,
  isDemoRateLimitEnabled,
} from "@/lib/demoMode";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    cfIp?.trim() ||
    "unknown";

  return ip.slice(0, 120);
}

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 500) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function consumeDemoRateLimit(request: Request, scope: string) {
  if (!isDemoMode() || !isDemoRateLimitEnabled()) return null;

  const now = Date.now();
  const limit = getDemoRateLimitMax();
  const windowMs = getDemoRateLimitWindowMs();
  const key = `${scope}:${getClientKey(request)}`;
  const existing = buckets.get(key);

  cleanupExpiredBuckets(now);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );

    return Response.json(
      {
        message: `The demo request limit has been reached. Please try again in ${Math.ceil(
          retryAfterSeconds / 60,
        )} minute(s).`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  existing.count += 1;
  return null;
}
