import type { UnitStatus } from "@workspace/api-client-react";

export function machineTileStatus(unit: UnitStatus) {
  if (unit.state === "free") {
    return { label: "Free", color: "--st-low", time: "Ready now", timeLabel: null };
  }
  if (unit.state === "unknown") {
    return { label: "Unknown", color: "--st-grey", time: "No reliable estimate", timeLabel: null };
  }
  return {
    label: "In use",
    color: "--st-high",
    time: unit.minutes_left === null ? "Remaining time unavailable" : `${unit.minutes_left} min left`,
    timeLabel: unit.minutes_left === null ? null : unit.time_source === "display" ? "Read from display" : "Estimated",
  };
}
