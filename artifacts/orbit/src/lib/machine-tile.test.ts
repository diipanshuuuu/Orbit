import { describe, expect, it } from "vitest";
import type { UnitStatus } from "@workspace/api-client-react";
import { machineTileStatus } from "./machine-tile";

const unit = (state: UnitStatus["state"], minutes_left: number | null, time_source: UnitStatus["time_source"]): UnitStatus => ({
  label: "W1", state, minutes_left, time_source, pending_state: null, since: null, updated_at: null,
});

describe("machine tile labels", () => {
  it("shows ready free units in green without inventing a timer", () => {
    expect(machineTileStatus(unit("free", null, null))).toEqual({
      label: "Free", color: "--st-low", time: "Ready now", timeLabel: null,
    });
  });
  it("shows unknown units in grey and never labels them free", () => {
    const tile = machineTileStatus(unit("unknown", null, null));
    expect(tile).toEqual({ label: "Unknown", color: "--st-grey", time: "No reliable estimate", timeLabel: null });
    expect(tile.label).not.toBe("Free");
  });
  it("labels display-derived remaining minutes", () => {
    expect(machineTileStatus(unit("in_use", 12, "display"))).toEqual({
      label: "In use", color: "--st-high", time: "12 min left", timeLabel: "Read from display",
    });
  });
  it("labels estimated remaining minutes", () => {
    expect(machineTileStatus(unit("in_use", 4, "estimated"))).toEqual({
      label: "In use", color: "--st-high", time: "4 min left", timeLabel: "Estimated",
    });
  });
  it("does not invent remaining minutes when unavailable", () => {
    expect(machineTileStatus(unit("in_use", null, null))).toEqual({
      label: "In use", color: "--st-high", time: "Remaining time unavailable", timeLabel: null,
    });
  });
});
