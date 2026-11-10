import type { Zone } from "@workspace/api-client-react";

// Cached successful responses must age out even if later polls fail.
export function maskStaleZone(zone: Zone, now: number): Zone {
  const seen = zone.last_seen_at ? Date.parse(zone.last_seen_at) : 0;
  const checked = zone.checked_at ? Date.parse(zone.checked_at) : 0;
  const state = !seen || now - seen >= 300_000 ? "offline"
    : !checked || now - checked >= 300_000 ? "re-checking" : zone.state;
  if (state !== "offline" && state !== "re-checking") return zone;
  return {
    ...zone, state, people_count: null,
    units: zone.units.map((u) => ({
      ...u, state: "unknown", pending_state: null, since: null, updated_at: null,
      minutes_left: null, time_source: null,
    })),
  };
}
