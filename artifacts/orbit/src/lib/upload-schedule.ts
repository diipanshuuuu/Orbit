export interface UploadSchedule {
  now: number;
  everSent: boolean;
  differs: boolean;
  lastSentAt: number;
  lastChangedSentAt: number;
  recheckAt: number | null;
  retryAt: number;
  failures: number;
}
// Returns the changed flag to send, or null when there is no upload due.
// Retries and rechecks bypass heartbeat spacing, never changed-frame spacing.
export function uploadDue(s: UploadSchedule): boolean | null {
  if (s.retryAt && s.now < s.retryAt) return null;
  if (!s.everSent) return true;
  const changed = s.differs && s.now - s.lastChangedSentAt >= 60_000;
  if (s.failures > 0 && s.retryAt && s.now >= s.retryAt) return changed;
  if (s.recheckAt !== null && s.now >= s.recheckAt) return changed;
  if (changed) return true;
  if (s.now - s.lastSentAt >= 120_000) return false;
  return null;
}
