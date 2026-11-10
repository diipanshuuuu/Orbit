import "./_group.css";
import { ChevronRight, RefreshCw } from "lucide-react";

const zones = [
  { slug: "common-room", name: "Common room", type: "crowd", state: "offline", number: "–", measure: "no live data", checked: "Camera offline, never seen" },
  { slug: "demo-mess", name: "Demo mess", type: "crowd", state: "low", number: "0", measure: "people", checked: "Simulated daily schedule · India time", demo: true },
  { slug: "demo-laundry", name: "Demo laundry", type: "machines", state: "low", number: "3", measure: "of 3 free", checked: "Simulated daily schedule · India time", demo: true },
];
const colors: Record<string, string> = { low: "--st-low", medium: "--st-medium", high: "--st-high", offline: "--st-grey" };

export function CurrentHome() {
  return (
    <main className="orbit-current mx-auto max-w-md px-4 pb-12">
      <nav className="flex items-center justify-between pt-5">
        <a className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="relative inline-flex h-7 w-7 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-primary/40" />
            <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          Orbit
        </a>
      </nav>
      <header className="rise pt-8 pb-6">
        <h1 className="text-4xl font-extrabold leading-[0.95] tracking-tight">Before you walk,<br /><span className="text-primary">look here.</span></h1>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">Live counts from cameras in shared rooms. No faces, no photos, just numbers.</p>
      </header>
      <ul className="space-y-3">
        {zones.map((zone) => (
          <li key={zone.slug} className="rise">
            <a className="group relative block overflow-hidden rounded-3xl border bg-card p-5">
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: `hsl(var(${colors[zone.state]}))` }} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{zone.type === "machines" ? "Machines" : "Room"}</p>
                  <h2 className="mt-0.5 text-xl font-bold">{zone.name}</h2>
                  {zone.demo && <span className="mt-1.5 inline-flex rounded-full border bg-muted px-2.5 py-1 text-[11px] font-semibold">Demo data</span>}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <span className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-lg font-extrabold" style={{ background: `hsl(var(${colors[zone.state]}) / .13)`, color: `hsl(var(${colors[zone.state]}))` }}>
                  <span className="h-2.5 w-2.5 rounded-full bg-current" />{zone.state === "low" ? zone.type === "machines" ? "Free now" : "Quiet" : "Camera offline"}
                </span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-5xl font-extrabold leading-none tabular-nums">{zone.number}</span>
                  <span className="text-sm text-muted-foreground">{zone.measure}</span>
                </span>
              </div>
              <div className="mt-4 border-t border-dashed pt-3">
                <span className="font-mono text-xs text-muted-foreground">{zone.checked}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center font-mono text-[11px] text-muted-foreground">
        <RefreshCw className="h-3 w-3" /> updates every 15 s while open
      </p>
    </main>
  );
}
