export function normalizeExpireAt(expireAt?: number | string) {
  const numeric = Number(expireAt ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return Date.now() + 60 * 60 * 1000;
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

export function isTokenExpiringSoon(expireAt: number | null | undefined, thresholdMs = 5 * 60 * 1000) {
  if (!expireAt) return true;
  return expireAt - Date.now() <= thresholdMs;
}
