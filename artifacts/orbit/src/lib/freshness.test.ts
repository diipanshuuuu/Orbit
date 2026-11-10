import { describe, expect, it } from "vitest";
import { maskStaleZone } from "./freshness";
import type { Zone } from "@workspace/api-client-react";
const now = Date.parse("2026-11-11T12:00:00Z");
const isoAgo = (ms: number) => new Date(now - ms).toISOString();
const zone: Zone = {
  slug: "test", name: "Test", type: "crowd", is_demo: false, state: "low", people_count: 2,
  last_seen_at: isoAgo(10_000), checked_at: isoAgo(10_000),
  units: [{ label: "W1", state: "free", pending_state: null, since: isoAgo(10_000), updated_at: isoAgo(10_000), minutes_left: null, time_source: null }],
};
describe("cached status freshness", () => {
  it("keeps a fresh live result", () => { expect(maskStaleZone(zone, now)).toBe(zone); });
  it("hides cached numbers and free units after contact expires", () => {
    const result = maskStaleZone(zone, now + 300_000);
    expect(result.state).toBe("offline");
    expect(result.people_count).toBeNull();
    expect(result.units[0]?.state).toBe("unknown");
  });
  it("rechecks when contact is fresh but the check is stale", () => {
    expect(maskStaleZone({ ...zone, checked_at: isoAgo(300_000) }, now).state).toBe("re-checking");
  });
  it("does not require camera contact for fresh demo data", () => {
    const demo = { ...zone, is_demo: true, last_seen_at: null };
    expect(maskStaleZone(demo, now)).toBe(demo);
  });
  it("masks old cached demo data without calling the camera offline", () => {
    const result = maskStaleZone({ ...zone, is_demo: true, last_seen_at: null }, now + 300_000);
    expect(result.state).toBe("re-checking");
    expect(result.people_count).toBeNull();
    expect(result.units[0]?.state).toBe("unknown");
  });
});
