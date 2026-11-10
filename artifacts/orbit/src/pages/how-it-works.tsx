import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Camera, CircleHelp, Database, EyeOff, Sparkles } from "lucide-react";
import { Shell } from "@/components/shell";

const steps = [
  {
    icon: Camera,
    number: "01",
    title: "A camera checks the room",
    detail: "A fixed camera sends an occasional still image—not a video stream.",
  },
  {
    icon: Sparkles,
    number: "02",
    title: "AI reads what is visible",
    detail: "It estimates the crowd or checks whether a shared machine is in use.",
  },
  {
    icon: CircleHelp,
    number: "03",
    title: "Orbit shows the status",
    detail: "You see a simple count or free/busy estimate before you make the walk.",
  },
];

export default function HowItWorks() {
  return (
    <Shell>
      <Link
        href="/"
        data-testid="link-back"
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All rooms
      </Link>

      <header className="rise pt-6 pb-7">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">A clear picture, not a live stream</p>
        <h1 className="mt-3 max-w-sm text-4xl font-extrabold leading-[1.02] tracking-tight">How Orbit works</h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
          Check shared spaces before heading over. Orbit turns occasional camera snapshots into a simple, useful status.
        </p>
      </header>

      <ol className="space-y-3" aria-label="How Orbit works">
        {steps.map(({ icon: Icon, number, title, detail }) => (
          <li key={number} data-testid={`card-how-step-${number}`} className="rounded-3xl border bg-card p-5">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-xs tracking-widest text-muted-foreground">STEP {number}</p>
                <h2 className="mt-1 text-xl font-bold leading-tight">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-8" aria-labelledby="privacy-heading">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-primary">Privacy, plainly</p>
        <h2 id="privacy-heading" className="mt-2 text-2xl font-extrabold tracking-tight">What we keep—and what we don’t</h2>
        <div className="mt-4 space-y-3">
          <article className="rounded-3xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Database className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold">We keep</h3>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
              <li>Room counts, machine status estimates, and when they were checked.</li>
              <li>Anonymous feedback and basic anonymous usage counts.</li>
              <li>Only the latest camera still for admin preview; it replaces the previous one.</li>
            </ul>
          </article>
          <article className="rounded-3xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--st-low)/.12)] text-[hsl(var(--st-low))]">
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold">We never</h3>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
              <li>Identify people or build face profiles.</li>
              <li>Keep a history of camera photos or video streams.</li>
              <li>Ask residents to create an account to check a status.</li>
            </ul>
          </article>
        </div>
      </section>

      <Link
        href="/"
        data-testid="link-check-status"
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-bold text-primary-foreground transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Check room status
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </Shell>
  );
}
