import type { Zone, UnitStatus } from "@workspace/api-client-react";
import { ago } from "@/lib/time";
import { cn } from "@/lib/utils";

export type Tone = "low" | "medium" | "high" | "grey";

export function DemoBadge() {
  return <span className="inline-flex min-h-6 items-center rounded-full border border-foreground/10 bg-muted/80 px-2.5 py-1 text-[10px] font-bold tracking-wide text-muted-foreground" data-testid="badge-demo">Demo data</span>;
}

export function isLive(zone: Zone) {
  return zone.state !== "offline" && zone.state !== "re-checking";
}

export function zoneTone(zone: Zone): Tone {
  if (zone.state === "low") return "low";
  if (zone.state === "medium") return "medium";
  if (zone.state === "high") return "high";
  return "grey";
}

export function zoneLabel(zone: Zone): string {
  switch (zone.state) {
    case "low": return zone.type === "machines" ? "Free now" : "Quiet";
    case "medium": return "Getting busy";
    case "high": return zone.type === "machines" ? "All busy" : "Packed";
    case "offline": return "Camera offline";
    case "re-checking": return "Re-checking";
    default: return "Unclear";
  }
}

export function toneVar(t: Tone) {
  return t === "grey" ? "--st-grey" : "--st-" + t;
}

export function StatusPill({ zone, size = "lg" }: { zone: Zone; size?: "lg" | "xl" }) {
  const tone = zoneTone(zone);
  const v = toneVar(tone);
  const live = isLive(zone) && zone.state !== "unknown";
  return (
    <span
      data-testid={"status-pill-" + zone.slug}
      className={cn(
        "inline-flex min-h-11 items-center gap-3 rounded-full font-extrabold tracking-tight",
        size === "xl" ? "px-5 py-3 text-xl sm:px-6 sm:text-2xl" : "px-4 py-2 text-base sm:text-lg",
      )}
      style={{ background: "hsl(var(" + v + ") / 0.13)", color: "hsl(var(" + v + "))" }}
    >
      <span className={cn("relative h-3 w-3 shrink-0 rounded-full bg-current", live && "ping")} />
      {zoneLabel(zone)}
    </span>
  );
}

export function KeyNumber({ zone }: { zone: Zone }) {
  if (!isLive(zone)) {
    return <span className="text-muted-foreground font-mono text-sm">no live data</span>;
  }
  if (zone.type === "machines") {
    const free = zone.units.filter((u) => u.state === "free").length;
    return (
      <span data-testid={"text-key-" + zone.slug} className="flex items-baseline gap-2">
        <span className="text-5xl font-extrabold tabular-nums leading-none tracking-[-.06em]">{free}</span>
        <span className="text-sm font-semibold text-muted-foreground">of {zone.units.length} free</span>
      </span>
    );
  }
  return (
    <span data-testid={"text-key-" + zone.slug} className="flex items-baseline gap-2">
      <span className="text-5xl font-extrabold tabular-nums leading-none tracking-[-.06em]">{zone.people_count ?? "–"}</span>
      <span className="text-sm font-semibold text-muted-foreground">{zone.people_count === 1 ? "person" : "people"}</span>
    </span>
  );
}

export function Freshness({ zone, now }: { zone: Zone; now: number }) {
  if (zone.is_demo) {
    return <span data-testid={"text-fresh-" + zone.slug} className="font-mono text-xs text-muted-foreground">
      {zone.state === "re-checking" ? "Demo schedule unavailable — reconnect to update" : "Simulated daily schedule · India time"}
    </span>;
  }
  if (zone.state === "offline") {
    const seen = ago(zone.last_seen_at, now);
    return (
      <span data-testid={"text-fresh-" + zone.slug} className="font-mono text-xs text-muted-foreground">
        Camera offline{seen ? ", last seen " + seen : ", never seen"}
      </span>
    );
  }
  if (zone.state === "re-checking") {
    return (
      <span data-testid={"text-fresh-" + zone.slug} className="font-mono text-xs text-muted-foreground">
        Re-checking. Last good check {ago(zone.checked_at, now) ?? "unknown"}
      </span>
    );
  }
  const c = ago(zone.checked_at, now);
  return (
    <span data-testid={"text-fresh-" + zone.slug} className="font-mono text-xs text-muted-foreground">
      {c ? "checked " + c : "not checked yet"}
    </span>
  );
}

export function unitText(u: UnitStatus) {
  if (u.state === "free") return "Free";
  if (u.state === "in_use") return "In use";
  return "Unknown";
}
