import type { ReactNode } from "react";
import { Link } from "wouter";
import { Info } from "lucide-react";

export function Logo() {
  return (
    <span className="relative inline-flex h-7 w-7 items-center justify-center">
      <span className="absolute inset-0 rounded-full border-2 border-primary/40" />
      <span className="absolute inset-0 orbit-spin"><span className="absolute -top-0.5 left-1/2 -ml-1 h-2 w-2 rounded-full bg-accent" /></span>
      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="resident-app-shell">
      <div className="resident-width mx-auto min-h-[100dvh] px-4 pb-12 sm:px-6">
      <nav aria-label="Resident navigation" className="flex items-center justify-between pt-5">
        <Link href="/" data-testid="link-home" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
          <Logo /> Orbit
        </Link>
        <Link href="/how-it-works" data-testid="link-how-it-works" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/10 bg-card/75 px-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/25 hover:text-foreground">
          <Info className="h-4 w-4 text-primary" />
          <span>How it works</span>
        </Link>
      </nav>
      {children}
      </div>
    </div>
  );
}
