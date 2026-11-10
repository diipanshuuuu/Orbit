import { Link, useParams } from "wouter";
import { ArrowLeft, EyeOff, RefreshCw } from "lucide-react";
import { useZones } from "@/hooks/use-zones";
import { useNow, ago } from "@/lib/time";
import { Shell } from "@/components/shell";
import { StatusPill, KeyNumber, Freshness, isLive, unitText } from "@/components/zone-status";

export default function ZonePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, isError, refetch } = useZones();
  const now = useNow();
  const zone = data?.find((z) => z.slug === slug);

  return (
    <Shell>
      <Link href="/" data-testid="link-back" className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
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
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{zone.type === "machines" ? "Machines" : "Room"}</p>
          <h1 data-testid="text-zone-name" className="text-4xl font-extrabold tracking-tight">{zone.name}</h1>

          <section className="mt-6 rounded-3xl border bg-card p-6">
            <StatusPill zone={zone} size="xl" />
            <div className="mt-6"><KeyNumber zone={zone} /></div>
            <div className="mt-5 pt-4 border-t border-dashed"><Freshness zone={zone} now={now} /></div>
          </section>

          {!isLive(zone) && (
            <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
              {zone.state === "offline"
                ? "We are not showing old numbers as live. Check again once the camera is back."
                : "The last reading is too old to trust. A fresh one is on the way."}
            </p>
          )}

          {isLive(zone) && zone.units.length > 0 && (
            <section className="mt-6">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Units</h2>
              <ul className="divide-y rounded-3xl border bg-card">
                {zone.units.map((u) => (
                  <li key={u.label} data-testid={"row-unit-" + u.label} className="flex items-center justify-between px-5 py-4">
                    <span className="font-bold text-lg">{u.label}</span>
                    <span className="text-right">
                      <span className="block font-semibold" style={{ color: "hsl(var(" + (u.state === "free" ? "--st-low" : u.state === "in_use" ? "--st-high" : "--st-grey") + "))" }}>
                        {unitText(u)}{u.pending_state ? " (confirming)" : ""}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {u.state === "in_use" && u.minutes_left != null
                          ? "~" + u.minutes_left + " min left, " + (u.time_source === "display" ? "read from display" : "estimated")
                          : u.since ? "since " + ago(u.since, now) : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
            <EyeOff className="h-4 w-4 shrink-0" />
            A camera sends still frames that are turned into counts. Residents never see images, and no one is identified.
          </p>
        </div>
      )}
    </Shell>
  );
}
