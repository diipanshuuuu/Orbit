import type { Zone } from "@workspace/api-client-react";
import { FeedbackRow } from "@/components/feedback-row";
import { machineTileStatus } from "@/lib/machine-tile";

export function MachineUnitGrid({ zone }: { zone: Zone }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="grid-machines">
      {zone.units.map((unit) => {
        const presentation = machineTileStatus(unit);
        const color = `hsl(var(${presentation.color}))`;
        return (
          <li
            key={unit.label}
            data-testid={"row-unit-" + unit.label}
            className="resident-card min-w-0 rounded-[1.35rem] border bg-card/90 p-3.5 sm:p-4"
            style={{ borderColor: `hsl(var(${presentation.color}) / 0.32)` }}
          >
            <article className="flex min-h-28 flex-col" aria-label={`${unit.label}: ${presentation.label}`}>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">{unit.label}</span>
              <span className="mt-2 text-xl font-extrabold leading-tight tracking-tight" style={{ color }}>
                {presentation.label}
              </span>
                <span className="mt-2 text-sm font-bold tabular-nums">
                {presentation.time}
              </span>
              {presentation.timeLabel && (
                <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {presentation.timeLabel}
                </span>
              )}
            </article>
            <div className="mt-3 border-t pt-3">
              <FeedbackRow zoneSlug={zone.slug} unitLabel={unit.label} status={unit.state} isDemo={zone.is_demo} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
