type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

const attempts = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  key: string,
  windowMs: number,
  maxAttempts: number
): RateLimitResult {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= maxAttempts) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  attempts.set(key, entry);
  return { ok: true };
}
