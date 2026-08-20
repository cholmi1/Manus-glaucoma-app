export const MAGIC_LINK_COOLDOWN_MS = 60_000;
export const EMAIL_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;

export function remainingMagicLinkCooldown(lastAttemptAt: number, now = Date.now()) {
  return Math.max(0, MAGIC_LINK_COOLDOWN_MS - (now - lastAttemptAt));
}

export function formatRemainingMinutes(milliseconds: number) {
  return Math.max(1, Math.ceil(milliseconds / 60_000));
}
