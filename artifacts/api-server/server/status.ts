import { z } from "zod";

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
export function freshness(lastSeenAt: Date | null, checkedAt: Date | null, now: Date, forceRecheck = false): "live" | "offline" | "re-checking" {
  if (!lastSeenAt || now.getTime() - lastSeenAt.getTime() >= 5 * MINUTE) return "offline";
  if (forceRecheck) return "re-checking";
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

const minute = z.number().int().min(0).max(1439);
const demoTimelineSchema = z.object({
  timezone: z.string().min(1),
  crowd: z.array(z.object({ minute, people: z.number().int().nonnegative() })),
  machines: z.array(z.object({
    label: z.string().min(1),
    cycles: z.array(z.object({ start: minute, end: z.number().int().min(1).max(1440) })
      .refine((cycle) => cycle.end > cycle.start, "Cycles must end after they start")),
  })),
});

// Pure, request-time projection: no camera freshness, status writes, or model calls.
export function demoStatus(zone: { type: "crowd" | "machines"; lowMax: number; highMin: number },
  timeline: unknown, labels: string[], now: Date) {
  const schedule = demoTimelineSchema.parse(timeline);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule.timezone, hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(now);
  const value = (key: string) => Number(parts.find((part) => part.type === key)?.value);
  const localMinute = value("hour") * 60 + value("minute") + value("second") / 60 + now.getUTCMilliseconds() / MINUTE;
  const at = (eventMinute: number) => new Date(now.getTime() - (localMinute - eventMinute) * MINUTE).toISOString();
  const currentUnits = labels.map((label) => {
    const cycles = schedule.machines.find((unit) => unit.label === label)?.cycles;
    if (!cycles) return {
      label, state: "unknown" as const, pending_state: null, since: null, updated_at: now.toISOString(),
      minutes_left: null, time_source: null,
    };
    const active = cycles.find((cycle) => localMinute >= cycle.start && localMinute < cycle.end);
    // Include yesterday's end so the free timestamp stays stable across midnight.
    const lastEnd = Math.max(...cycles.map((cycle) => cycle.end <= localMinute ? cycle.end : cycle.end - 1440));
    return {
      label, state: active ? "in_use" as const : "free" as const, pending_state: null,
      since: active ? at(active.start) : Number.isFinite(lastEnd) ? at(lastEnd) : null,
      updated_at: now.toISOString(), minutes_left: active ? Math.ceil(active.end - localMinute) : null,
      time_source: active ? "estimated" as const : null,
    };
  });
  const points = [...schedule.crowd].sort((a, b) => a.minute - b.minute);
  const currentCrowd = points.filter((point) => point.minute <= localMinute).at(-1) ?? points.at(-1);
  const people = zone.type === "crowd" ? currentCrowd?.people ?? null : null;
  const busy = currentUnits.filter((unit) => unit.state === "in_use").length;
  const state = zone.type === "crowd" ? crowdLevel(people, zone.lowMax, zone.highMin)
    : currentUnits.length === 0 || currentUnits.some((unit) => unit.state === "unknown") ? "unknown"
    : busy === 0 ? "low" : busy === currentUnits.length ? "high" : "medium";
  return {
    is_demo: true, state, people_count: people, checked_at: now.toISOString(),
    last_seen_at: null, units: zone.type === "machines" ? currentUnits : [],
  };
}
