import { describe, expect, it } from "vitest";
import { demoStatus } from "./status";
import { demoCrowdTimeline, demoMachinesTimeline } from "./demo-timelines";

const crowd = { type: "crowd" as const, lowMax: 5, highMin: 15 };
const machines = { ...crowd, type: "machines" as const };
const labels = ["W1", "W2", "W3"];
const at = (time: string, day = "2026-11-11") => new Date(`${day}T${time}+05:30`);
const laundry = (time: string) => demoStatus(machines, demoMachinesTimeline, labels, at(time));

describe("stored crowd demo timeline", () => {
  it.each(["07:30:00", "12:00:00", "19:00:00"])("is busy at meal time %s", (time) => {
    expect(demoStatus(crowd, demoCrowdTimeline, [], at(time)).state).toBe("high");
  });
  it.each(["00:00:00", "02:00:00", "23:59:59"])("is quiet at night %s", (time) => {
    const status = demoStatus(crowd, demoCrowdTimeline, [], at(time));
    expect(status.state).toBe("low");
    expect(status.people_count).toBeLessThanOrEqual(5);
    expect(status.last_seen_at).toBeNull();
    expect(status.is_demo).toBe(true);
  });
  it("changes exactly at timeline boundaries", () => {
    expect(demoStatus(crowd, demoCrowdTimeline, [], at("09:29:59")).people_count).toBe(18);
    expect(demoStatus(crowd, demoCrowdTimeline, [], at("09:30:00")).people_count).toBe(4);
  });
  it("uses the stored timezone, not server UTC", () => {
    expect(demoStatus(crowd, demoCrowdTimeline, [], new Date("2026-11-11T06:30:00Z")).people_count).toBe(22);
  });
  it("repeats the same schedule on the next day", () => {
    const today = demoStatus(crowd, demoCrowdTimeline, [], at("12:15:00"));
    const tomorrow = demoStatus(crowd, demoCrowdTimeline, [], at("12:15:00", "2026-11-12"));
    expect(tomorrow.people_count).toBe(today.people_count);
    expect(tomorrow.state).toBe(today.state);
  });
  it("wraps to the previous day's final point before the first entry", () => {
    const timeline = { ...demoCrowdTimeline, crowd: [{ minute: 60, people: 20 }, { minute: 1380, people: 1 }] };
    expect(demoStatus(crowd, timeline, [], at("00:30:00")).people_count).toBe(1);
  });
});

describe("stored machines demo timeline", () => {
  it("starts cycles and counts down from their actual start", () => {
    const status = laundry("07:00:00");
    expect(status.state).toBe("medium");
    expect(status.units.map((unit) => unit.state)).toEqual(["in_use", "free", "free"]);
    expect(status.units[0]).toMatchObject({
      minutes_left: 45, time_source: "estimated", pending_state: null, since: at("07:00:00").toISOString(),
    });
    expect(laundry("07:44:59").units[0]?.minutes_left).toBe(1);
  });
  it("has all machines busy during overlapping cycles", () => {
    const status = laundry("07:30:00");
    expect(status.state).toBe("high");
    expect(status.units.map((unit) => unit.minutes_left)).toEqual([15, 30, 45]);
    expect(status.people_count).toBeNull();
  });
  it("ends a cycle exactly at its boundary, without camera confirmation", () => {
    expect(laundry("07:45:00").units[0]).toMatchObject({
      state: "free", pending_state: null, minutes_left: null, time_source: null,
      since: at("07:45:00").toISOString(),
    });
    expect(laundry("08:15:00").state).toBe("low");
  });
  it("is free overnight, with a stable timestamp across midnight", () => {
    const unit = laundry("00:00:00").units[0];
    expect(unit?.state).toBe("free");
    expect(unit?.since).toBe(at("21:45:00", "2026-11-10").toISOString());
  });
  it("never invents free status for a unit missing from the stored timeline", () => {
    const status = demoStatus(machines, demoMachinesTimeline, ["W4"], at("07:00:00"));
    expect(status.units[0]?.state).toBe("unknown");
    expect(status.state).toBe("unknown");
  });
  it("is deterministic across days and has no pending camera recheck", () => {
    const tomorrow = demoStatus(machines, demoMachinesTimeline, labels, at("07:30:00", "2026-11-12"));
    expect(tomorrow.units.map((unit) => [unit.state, unit.minutes_left, unit.pending_state]))
      .toEqual(laundry("07:30:00").units.map((unit) => [unit.state, unit.minutes_left, unit.pending_state]));
  });
  it("rejects malformed stored schedules rather than silently substituting live data", () => {
    expect(() => demoStatus(machines, null, labels, at("07:30:00"))).toThrow();
    const invalid = { ...demoMachinesTimeline, machines: [{ label: "W1", cycles: [{ start: 60, end: 30 }] }] };
    expect(() => demoStatus(machines, invalid, labels, at("07:30:00"))).toThrow();
  });
});
