import { Link, useParams } from "wouter";
import { ArrowLeft, EyeOff, RefreshCw } from "lucide-react";
import { useZones } from "@/hooks/use-zones";
import { useNow, ago } from "@/lib/time";
import { Shell } from "@/components/shell";
import { DemoBadge, StatusPill, KeyNumber, Freshness, isLive, unitText } from "@/components/zone-status";
import { FeedbackRow } from "@/components/feedback-row";
import { MachineUnitGrid } from "@/components/machine-unit-grid";

export default function ZonePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError, refetch } = useZones();
  const now = useNow();
  const zone = data?.find((z) => z.slug === slug);

  return (
    <Shell>
      <Link href="/" data-testid="link-back" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All rooms
      </Link>

      {isLoading && <div className="mt-6 h-72 rounded-3xl bg-muted animate-pulse" />}

      {isError && (
        <div className="mt-6 rounded-3xl border bg-card p-6 text-center">
          <p className="font-semibold">Could not load this room.</p>
          <button data-testid="button-retry" onClick={() => refetch()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 font-semibold active:scale-95 transition-transform">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {data && !zone && (
        <div className="mt-6 rounded-3xl border border-dashed p-8 text-center">
          <p className="font-semibold">This room is not on Orbit.</p>
          <Link href="/" className="mt-3 inline-block text-primary font-semibold">See all rooms</Link>
        </div>
      )}

      {zone && (
        <div className="rise">
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">{zone.type === "machines" ? "Machines" : "Room"}</p>
          <h1 data-testid="text-zone-name" className="text-[2.65rem] font-extrabold tracking-[-.055em] leading-none">{zone.name}</h1>
          {zone.is_demo && <div className="mt-2"><DemoBadge /></div>}

          <section className="resident-card mt-6 rounded-[1.7rem] border bg-card/90 p-5 sm:p-6">
            <StatusPill zone={zone} size="xl" />
            <div className="mt-6"><KeyNumber zone={zone} /></div>
            <div className="mt-5 pt-4 border-t border-dashed"><Freshness zone={zone} now={now} /></div>
          </section>

          {!isLive(zone) && (
            <p className="mt-4 rounded-2xl border border-foreground/10 bg-muted/70 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
              {zone.is_demo ? "The demo schedule could not be refreshed. Reconnect to update it."
                : zone.state === "offline"
                ? "We are not showing old numbers as live. Check again once the camera is back."
                : "The last reading is too old to trust. A fresh one is on the way."}
            </p>
          )}

          <div className="mt-4">
            <FeedbackRow zoneSlug={zone.slug} status={zone.state} isDemo={zone.is_demo} />
          </div>

          {isLive(zone) && zone.units.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">
                {zone.type === "machines" ? "Machines" : "Units"}
              </h2>
              {zone.type === "machines" ? (
                <MachineUnitGrid zone={zone} />
              ) : (
                <ul className="divide-y divide-foreground/10 rounded-[1.5rem] border bg-card/90">
                  {zone.units.map((u) => (
                    <li key={u.label} data-testid={"row-unit-" + u.label} className="px-4 py-4 sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-lg">{u.label}</span>
                        <span className="text-right">
                          <span className="block text-base font-bold" style={{ color: "hsl(var(" + (u.state === "free" ? "--st-low" : u.state === "in_use" ? "--st-high" : "--st-grey") + "))" }}>
                            {unitText(u)}{u.pending_state ? " (confirming)" : ""}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {u.state === "in_use" && u.minutes_left != null
                              ? "~" + u.minutes_left + " min left, " + (u.time_source === "display" ? "read from display" : "estimated")
                              : u.since ? "since " + ago(u.since, now) : ""}
                          </span>
                        </span>
                      </div>
                      <div className="mt-3">
                        <FeedbackRow zoneSlug={zone.slug} unitLabel={u.label} status={u.state} isDemo={zone.is_demo} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <p className="mt-8 flex items-start gap-2 rounded-2xl border border-foreground/10 bg-card/50 p-4 text-xs leading-relaxed text-muted-foreground">
            <EyeOff className="h-4 w-4 shrink-0" />
            {zone.is_demo
              ? "This demo repeats a stored 24-hour schedule in India time. No camera or AI is used."
              : "A camera sends still frames that are turned into counts. Residents never see images, and no one is identified."}
          </p>
        </div>
      )}
    </Shell>
  );
}
