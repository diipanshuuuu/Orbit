import "./_group.css";
import { ArrowLeft, EyeOff } from "lucide-react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

const units = ["W1", "W2", "W3"];

export function CurrentZone() {
  return (
    <main className="orbit-current mx-auto max-w-md px-4 pb-12">
      <nav className="flex items-center justify-between pt-5">
        <a className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span className="relative inline-flex h-7 w-7 items-center justify-center"><span className="absolute inset-0 rounded-full border-2 border-primary/40" /><span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-accent" /><span className="h-2.5 w-2.5 rounded-full bg-primary" /></span>Orbit
        </a>
      </nav>
      <a className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> All rooms</a>
      <div className="rise">
        <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Machines</p>
        <h1 className="text-4xl font-extrabold tracking-tight">Demo laundry</h1>
        <span className="mt-2 inline-flex rounded-full border bg-muted px-2.5 py-1 text-[11px] font-semibold">Demo data</span>
        <section className="mt-6 rounded-3xl border bg-card p-6">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-[hsl(var(--st-low)/.13)] px-6 py-3 text-2xl font-extrabold text-[hsl(var(--st-low))]"><span className="h-2.5 w-2.5 rounded-full bg-current" />Free now</span>
          <div className="mt-6 flex items-baseline gap-1.5"><span className="text-5xl font-extrabold leading-none tabular-nums">3</span><span className="text-sm text-muted-foreground">of 3 free</span></div>
          <div className="mt-5 border-t border-dashed pt-4 font-mono text-xs text-muted-foreground">Simulated daily schedule · India time</div>
        </section>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card/70 px-4 py-3">
          <div><p className="text-sm font-semibold">Is this right?</p><p className="text-xs text-muted-foreground">Your feedback is anonymous.</p></div>
          <div className="flex gap-2"><button className="h-11 w-11 rounded-full border"><ThumbsUp className="mx-auto h-4 w-4" /></button><button className="h-11 w-11 rounded-full border"><ThumbsDown className="mx-auto h-4 w-4" /></button></div>
        </div>
        <section className="mt-6">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Machines</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {units.map((label) => (
              <li key={label} className="min-w-0 rounded-2xl border bg-card p-3 sm:p-4">
                <article className="flex min-h-28 flex-col">
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
                  <span className="mt-2 text-lg font-bold text-[hsl(var(--st-low))]">Free</span>
                  <span className="mt-2 text-sm font-semibold">Ready now</span>
                </article>
                <div className="mt-3 border-t pt-3">
                  <p className="text-sm font-semibold">Is this unit status right?</p>
                  <p className="text-xs text-muted-foreground">Your feedback is anonymous.</p>
                  <div className="mt-2 flex gap-2"><button className="h-11 w-11 rounded-full border"><ThumbsUp className="mx-auto h-4 w-4" /></button><button className="h-11 w-11 rounded-full border"><ThumbsDown className="mx-auto h-4 w-4" /></button></div>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground"><EyeOff className="h-4 w-4 shrink-0" />This demo repeats a stored 24-hour schedule in India time. No camera or AI is used.</p>
      </div>
    </main>
  );
}
