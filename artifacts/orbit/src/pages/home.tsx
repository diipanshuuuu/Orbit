import { Link } from "wouter";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useZones } from "@/hooks/use-zones";
import { useNow } from "@/lib/time";
import { StatusPill, KeyNumber, Freshness, zoneTone, toneVar } from "@/components/zone-status";
import { Shell } from "@/components/shell";

export default function Home() {
  const { data, isLoading, isError, refetch, isFetching } = useZones();
  const now = useNow();

  return (
    <Shell>
      <header className="pt-8 pb-6 rise">
        <h1 className="text-4xl font-extrabold tracking-tight leading-[0.95]">Before you walk,<br /><span className="text-primary">look here.</span></h1>
        <p className="mt-3 text-muted-foreground text-sm max-w-xs">Live counts from cameras in shared rooms. No faces, no photos, just numbers.</p>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-3xl bg-muted animate-pulse" />)}
        </div>
      )}

      {isError && (
        <div className="rounded-3xl border bg-card p-6 text-center rise">
          <p className="font-semibold">Could not reach Orbit.</p>
          <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
          <button data-testid="button-retry" onClick={() => refetch()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 font-semibold active:scale-95 transition-transform">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-3xl border border-dashed p-8 text-center rise">
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
              className="group relative block overflow-hidden rounded-3xl border bg-card p-5 transition-transform active:scale-[0.985]"
            >
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: "hsl(var(" + toneVar(zoneTone(z)) + "))" }} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{z.type === "machines" ? "Machines" : "Room"}</p>
                  <h2 className="text-xl font-bold mt-0.5">{z.name}</h2>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
                <StatusPill zone={z} />
                <KeyNumber zone={z} />
              </div>
              <div className="mt-4 pt-3 border-t border-dashed"><Freshness zone={z} now={now} /></div>
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
