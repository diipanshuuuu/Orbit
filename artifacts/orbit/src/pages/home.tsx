import { Link } from "wouter";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useZones } from "@/hooks/use-zones";
import { useNow } from "@/lib/time";
import { DemoBadge, StatusPill, KeyNumber, Freshness, zoneTone, toneVar } from "@/components/zone-status";
import { Shell } from "@/components/shell";

export default function Home() {
  const { data, isLoading, isError, refetch, isFetching } = useZones();
  const now = useNow();

  return (
    <Shell>
      <header className="pt-9 pb-7 rise">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[.22em] text-primary">A quick check for shared spaces</p>
        <h1 className="text-[2.65rem] font-extrabold tracking-[-.055em] leading-[.94] sm:text-5xl">Before you walk,<br /><span className="text-primary">look here.</span></h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted-foreground">Live counts for shared rooms and machines. Residents never see camera images, and no one is identified.</p>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-[1.6rem] border border-foreground/5 bg-card/65 animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="resident-card rounded-[1.6rem] border bg-card p-6 text-center rise">
          <p className="font-semibold">Could not reach Orbit.</p>
          <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
          <button data-testid="button-retry" onClick={() => refetch()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 font-semibold active:scale-95 transition-transform">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-[1.6rem] border border-dashed border-foreground/20 bg-card/40 p-8 text-center rise">
          <p className="font-semibold">No rooms are being watched yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Once a camera is set up, its room appears here.</p>
        </div>
      )}

      <ul className="space-y-3">
        {data?.map((z, i) => (
          <li key={z.slug} className="rise" style={{ animationDelay: i * 60 + "ms" }}>
            <Link
              href={"/z/" + z.slug}
              data-testid={"card-zone-" + z.slug}
              className="resident-card group relative block min-h-44 overflow-hidden rounded-[1.6rem] border bg-card/90 p-5 pl-6 transition-[transform,border-color,box-shadow] hover:border-primary/25 hover:shadow-md active:scale-[0.985] focus-visible:outline-none"
            >
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: "hsl(var(" + toneVar(zoneTone(z)) + "))" }} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{z.type === "machines" ? "Machines" : "Room"}</p>
                  <h2 className="text-[1.35rem] font-bold tracking-tight mt-1">{z.name}</h2>
                  {z.is_demo && <div className="mt-1.5"><DemoBadge /></div>}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="mt-5 flex items-end justify-between gap-3 flex-wrap">
                <StatusPill zone={z} />
                <KeyNumber zone={z} />
              </div>
              <div className="mt-4 border-t border-dashed border-foreground/15 pt-3"><Freshness zone={z} now={now} /></div>
            </Link>
          </li>
        ))}
      </ul>

      {data && (
        <p className="mt-6 text-center font-mono text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <span className={isFetching ? "inline-block orbit-spin" : "inline-block"}><RefreshCw className="h-3 w-3" /></span>
          updates every 15 s while open
        </p>
      )}
    </Shell>
  );
}
