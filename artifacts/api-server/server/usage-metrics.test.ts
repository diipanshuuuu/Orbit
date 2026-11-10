import { describe, expect, it } from "vitest";
import { completeDailyCounts } from "./usage-metrics";

describe("daily usage series", () => {
  it("fills missing UTC days with zeros and preserves recorded counts", () => {
    expect(completeDailyCounts("2026-11-09", [
      { day: "2026-11-10", unique_devices: 2, views: 5 },
    ], 3)).toEqual([
      { day: "2026-11-09", unique_devices: 0, views: 0 },
      { day: "2026-11-10", unique_devices: 2, views: 5 },
      { day: "2026-11-11", unique_devices: 0, views: 0 },
    ]);
  });
});
