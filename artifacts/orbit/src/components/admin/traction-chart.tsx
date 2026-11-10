import type { AdminDailyUsage } from "@workspace/api-client-react";

function shortDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? day
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function TractionChart({ daily }: { daily: AdminDailyUsage[] }) {
  if (daily.length === 0) {
    return (
      <div data-testid="empty-daily-traction" className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed bg-muted/30 px-5 text-center text-sm text-muted-foreground">
        No daily activity in the returned 30-day UTC range.
      </div>
    );
  }

  const width = 720;
  const height = 220;
  const pad = { top: 18, right: 14, bottom: 38, left: 38 };
  const maxValue = Math.max(1, ...daily.map((row) => row.unique_devices));
  const x = (index: number) =>
    pad.left + (daily.length < 2 ? (width - pad.left - pad.right) / 2 : (index / (daily.length - 1)) * (width - pad.left - pad.right));
  const y = (value: number) => height - pad.bottom - (value / maxValue) * (height - pad.top - pad.bottom);
  const points = daily.map((row, index) => `${x(index)},${y(row.unique_devices)}`);
  const line = points.join(" ");
  const area = `${x(0)},${height - pad.bottom} ${line} ${x(daily.length - 1)},${height - pad.bottom}`;
  const labelIndexes = Array.from(new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]));

  return (
    <div className="w-full overflow-hidden" data-testid="chart-daily-unique-devices">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Unique devices per day, UTC" className="h-auto w-full">
        {[0, 0.5, 1].map((fraction) => {
          const value = Math.round(maxValue * fraction);
          const lineY = y(value);
          return (
            <g key={fraction}>
              <line x1={pad.left} x2={width - pad.right} y1={lineY} y2={lineY} stroke="hsl(var(--border))" strokeDasharray="3 5" />
              <text x={pad.left - 10} y={lineY + 4} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="var(--app-font-mono)">{value}</text>
            </g>
          );
        })}
        <polygon points={area} fill="hsl(var(--primary) / .10)" />
        <polyline points={line} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {daily.map((row, index) => (
          <circle key={`${row.day}-${index}`} cx={x(index)} cy={y(row.unique_devices)} r={daily.length > 18 ? 2.3 : 3.5} fill="hsl(var(--primary))">
            <title>{`${row.day}: ${row.unique_devices} unique devices`}</title>
          </circle>
        ))}
        {labelIndexes.map((index) => (
          <text key={index} x={x(index)} y={height - 10} textAnchor={index === 0 ? "start" : index === daily.length - 1 ? "end" : "middle"} fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="var(--app-font-mono)">
            {shortDay(daily[index].day)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Unique devices</span>
        <span>By UTC day</span>
      </div>
    </div>
  );
}
