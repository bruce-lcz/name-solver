import { canonicalConstraintHash, type ConstraintV1 } from "../../../../packages/domain/src/index.ts";

interface CacheEntry<T> { expiresAt: number; value: T }
const responseCache = new Map<string, CacheEntry<unknown>>();
const rateWindows = new Map<string, { resetAt: number; count: number }>();

export function readCache<T>(constraints: ConstraintV1): T | undefined {
  const key = canonicalConstraintHash(constraints);
  const entry = responseCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) { responseCache.delete(key); return undefined; }
  return entry.value as T;
}

export function writeCache<T>(constraints: ConstraintV1, value: T, ttlMs = 60_000): void {
  responseCache.set(canonicalConstraintHash(constraints), { value, expiresAt: Date.now() + ttlMs });
}

export function allowRequest(identity: string, maxRequests = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = rateWindows.get(identity);
  if (!current || current.resetAt <= now) { rateWindows.set(identity, { count: 1, resetAt: now + windowMs }); return true; }
  if (current.count >= maxRequests) return false;
  current.count += 1;
  return true;
}

export function audit(event: string, payload: Record<string, unknown>): void {
  console.info(JSON.stringify({ event, at: new Date().toISOString(), ...payload }));
}
