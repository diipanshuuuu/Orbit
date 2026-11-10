import type { AdminReading } from "@workspace/api-client-react";

export function ReadingsList({ readings, zoneId }: { readings: AdminReading[]; zoneId: number }) {
  const latest = readings.slice(0, 20);
  return (
    <details className="group rounded-2xl border bg-background/60" data-testid={`readings-${zoneId}`}>
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-sm font-semibold">
        Latest readings <span className="font-mono text-xs text-muted-foreground">{latest.length} / 20</span>
      </summary>
      <div className="px-4 pb-4 space-y-2">
        {latest.length === 0 && <p className="text-sm text-muted-foreground">No readings yet. They appear after the first analysed frame.</p>}
        {latest.map((r) => (
          <details key={r.id} className="rounded-xl bg-muted" data-testid={`reading-${r.id}`}>
            <summary className="cursor-pointer px-3 py-2 font-mono text-xs">{new Date(r.captured_at).toLocaleString()}</summary>
            <pre className="overflow-x-auto px-3 pb-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all">{JSON.stringify(r.raw, null, 2)}</pre>
          </details>
        ))}
      </div>
    </details>
  );
}
