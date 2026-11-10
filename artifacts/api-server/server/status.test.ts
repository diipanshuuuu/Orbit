import { describe, expect, it } from "vitest";
import { crowdLevel, freshness, refillAllowance, remainingTime, shouldAnalyse, transitionUnit, type UnitSnapshot } from "./status";

const now = new Date("2026-11-11T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);
const busy: UnitSnapshot = {
  state: "in_use", pendingState: null, since: ago(600), updatedAt: ago(60), timerMinutes: null, confidence: 0.9,
};
const reading = (state: "free" | "in_use" | "unknown") => ({ state, timer_minutes: null, confidence: 0.9 });
describe("unit confirmation", () => {
  it("marks in_use immediately", () => {
    expect(transitionUnit({ ...busy, state: "unknown" }, reading("in_use"), now).state).toBe("in_use");
  });
  it("keeps in_use on the first free reading", () => {
    const result = transitionUnit(busy, reading("free"), now);
    expect(result.state).toBe("in_use");
    expect(result.pendingState).toBe("free");
    expect(result.since).toEqual(busy.since);
  });
  it("confirms free only on the next agreeing reading", () => {
    const first = transitionUnit(busy, reading("free"), ago(10));
    const second = transitionUnit(first, reading("free"), now);
    expect(second.state).toBe("free");
    expect(second.pendingState).toBeNull();
    expect(second.since).toEqual(now);
  });
  it.each(["unknown", "in_use"] as const)("clears pending on %s", (state) => {
    expect(transitionUnit({ ...busy, pendingState: "free" }, reading(state), now).pendingState).toBeNull();
  });
  it("does not carry free confirmation across an unknown reading", () => {
    const first = transitionUnit(busy, reading("free"), ago(20));
    const obscured = transitionUnit(first, reading("unknown"), ago(10));
    const next = transitionUnit(obscured, reading("free"), now);
    expect(next.state).toBe("unknown");
    expect(next.pendingState).toBe("free");
  });
  it("keeps a confirmed free state", () => {
    expect(transitionUnit({ ...busy, state: "free" }, reading("free"), now).state).toBe("free");
  });
  it("preserves start time on repeated in_use", () => {
    expect(transitionUnit(busy, reading("in_use"), now).since).toEqual(busy.since);
  });
});
describe("crowd and freshness", () => {
  it.each([[0, "low"], [5, "low"], [6, "medium"], [14, "medium"], [15, "high"], [25, "high"], [null, "unknown"]] as const)(
    "classifies count %s as %s", (count, expected) => { expect(crowdLevel(count, 5, 15)).toBe(expected); },
  );
  it("is offline with no camera contact", () => { expect(freshness(null, now, now)).toBe("offline"); });
  it("is offline at five minutes", () => { expect(freshness(ago(300), now, now)).toBe("offline"); });
  it("prefers offline over re-checking", () => { expect(freshness(ago(301), ago(900), now)).toBe("offline"); });
  it("rechecks missing analysis", () => { expect(freshness(now, null, now)).toBe("re-checking"); });
  it("rechecks after five minutes", () => { expect(freshness(now, ago(300), now)).toBe("re-checking"); });
  it("is live within the freshness window", () => { expect(freshness(ago(120), ago(299), now)).toBe("live"); });
});
describe("analysis allowance", () => {
  it("caps the default bucket at 50", () => { expect(refillAllowance(50, ago(10000), now, 200)).toBe(50); });
  it("refills evenly at 200 per day", () => { expect(refillAllowance(0, ago(432), now, 200)).toBeCloseTo(1); });
  it("does not refill backwards in time", () => { expect(refillAllowance(2, new Date(now.getTime() + 1000), now, 200)).toBe(2); });
  const eligible = { changed: false, pending: false, lastAnalysedAt: ago(100), allowance: 1, now };
  it("analyses a changed frame", () => { expect(shouldAnalyse({ ...eligible, changed: true })).toBe(true); });
  it("analyses a pending unit", () => { expect(shouldAnalyse({ ...eligible, pending: true })).toBe(true); });
  it("analyses the first frame", () => { expect(shouldAnalyse({ ...eligible, lastAnalysedAt: null })).toBe(true); });
  it("analyses after more than ten minutes", () => { expect(shouldAnalyse({ ...eligible, lastAnalysedAt: ago(601) })).toBe(true); });
  it("does not analyse at exactly ten minutes without another reason", () => { expect(shouldAnalyse({ ...eligible, lastAnalysedAt: ago(600) })).toBe(false); });
  it("does not analyse an unchanged recent frame", () => { expect(shouldAnalyse(eligible)).toBe(false); });
  it("requires at least one token", () => { expect(shouldAnalyse({ ...eligible, changed: true, allowance: 0.999 })).toBe(false); });
  it("honors cooldown even when pending", () => { expect(shouldAnalyse({ ...eligible, pending: true, lastAnalysedAt: ago(9.999) })).toBe(false); });
  it("permits a recheck at ten seconds", () => { expect(shouldAnalyse({ ...eligible, pending: true, lastAnalysedAt: ago(10) })).toBe(true); });
  it("cooldown also applies after model failures", () => { expect(shouldAnalyse({ ...eligible, changed: true, lastAttemptedAt: ago(2) })).toBe(false); });
});
describe("remaining minutes", () => {
  it("estimates from the in_use start", () => { expect(remainingTime(busy, 45, now)).toEqual({ minutes_left: 35, time_source: "estimated" }); });
  it("uses a confident display and its observation time", () => {
    expect(remainingTime({ ...busy, timerMinutes: 20, confidence: 0.8 }, 45, now)).toEqual({ minutes_left: 19, time_source: "display" });
  });
  it("does not trust a low-confidence timer", () => { expect(remainingTime({ ...busy, timerMinutes: 2, confidence: 0.79 }, 45, now).minutes_left).toBe(35); });
  it("clamps an expired cycle to zero", () => { expect(remainingTime(busy, 5, now).minutes_left).toBe(0); });
  it.each(["free", "unknown"] as const)("has no estimate for %s", (state) => {
    expect(remainingTime({ ...busy, state }, 45, now)).toEqual({ minutes_left: null, time_source: null });
  });
});
