export type UnitState = "free" | "in_use" | "unknown";
export interface UnitSnapshot {
  state: UnitState;
  pendingState: "free" | null;
  since: Date;
  updatedAt: Date;
  timerMinutes: number | null;
  confidence: number;
}
const MINUTE = 60_000;
export function refillAllowance(allowance: number, allowanceAt: Date, now: Date, daily: number): number {
  return Math.min(daily / 4, Math.max(0, allowance) + Math.max(0, now.getTime() - allowanceAt.getTime()) * daily / 86_400_000);
}
export function shouldAnalyse(input: {
  changed: boolean; pending: boolean; lastAnalysedAt: Date | null;
  lastAttemptedAt?: Date | null; allowance: number; now: Date;
}): boolean {
  const { now, lastAnalysedAt, lastAttemptedAt, allowance, changed, pending } = input;
  const latestAttempt = Math.max(lastAnalysedAt?.getTime() ?? -Infinity, lastAttemptedAt?.getTime() ?? -Infinity);
  if (allowance < 1 || now.getTime() - latestAttempt < 10_000) return false;
  return changed || pending || !lastAnalysedAt || now.getTime() - lastAnalysedAt.getTime() > 10 * MINUTE;
}
export function transitionUnit(previous: UnitSnapshot, reading: {
  state: UnitState; timer_minutes: number | null; confidence: number;
}, now: Date): UnitSnapshot {
  let state: UnitState = previous.state;
  let pendingState: "free" | null = null;
  if (reading.state === "free") {
    if (previous.state === "free" || previous.pendingState === "free") state = "free";
    else pendingState = "free";
  } else state = reading.state;
  return {
    state, pendingState,
    since: state === previous.state ? previous.since : now,
    updatedAt: now,
    timerMinutes: reading.state === "in_use" ? reading.timer_minutes : null,
    confidence: reading.confidence,
  };
}
export function crowdLevel(peopleCount: number | null, lowMax: number, highMin: number): "low" | "medium" | "high" | "unknown" {
  if (peopleCount === null) return "unknown";
  return peopleCount <= lowMax ? "low" : peopleCount >= highMin ? "high" : "medium";
}
export function freshness(lastSeenAt: Date | null, checkedAt: Date | null, now: Date): "live" | "offline" | "re-checking" {
  if (!lastSeenAt || now.getTime() - lastSeenAt.getTime() >= 5 * MINUTE) return "offline";
  if (!checkedAt || now.getTime() - checkedAt.getTime() >= 5 * MINUTE) return "re-checking";
  return "live";
}
export function remainingTime(unit: UnitSnapshot, typicalCycleMin: number, now: Date): {
  minutes_left: number | null; time_source: "display" | "estimated" | null;
} {
  if (unit.state !== "in_use") return { minutes_left: null, time_source: null };
  const display = unit.timerMinutes !== null && unit.confidence >= 0.8;
  const minutes = display
    ? unit.timerMinutes! - Math.max(0, now.getTime() - unit.updatedAt.getTime()) / MINUTE
    : typicalCycleMin - Math.max(0, now.getTime() - unit.since.getTime()) / MINUTE;
  return { minutes_left: Math.max(0, Math.ceil(minutes)), time_source: display ? "display" : "estimated" };
}
