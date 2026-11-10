import type { ReactNode } from "react";
import { Link } from "wouter";

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
    <div className="min-h-[100dvh] mx-auto max-w-md px-4 pb-12">
      <nav className="flex items-center justify-between pt-5">
        <Link href="/" data-testid="link-home" className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
          <Logo /> Orbit
        </Link>
      </nav>
      {children}
    </div>
  );
}
