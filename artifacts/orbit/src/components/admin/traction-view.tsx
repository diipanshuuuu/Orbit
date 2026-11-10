import { useEffect } from "react";
import { Download, RefreshCw, ThumbsUp, Users, Eye, MessageSquareText, ArrowUpRight } from "lucide-react";
import { getGetAdminTractionQueryKey, useGetAdminTraction } from "@workspace/api-client-react";
import type { AdminTraction } from "@workspace/api-client-react";
import { adminRequest, errorMessage, errorStatus } from "@/lib/admin-auth";
import { TractionChart } from "./traction-chart";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatRange(start: string, end: string) {
  const format = (value: string) => {
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  };
  return `${format(start)} – ${format(end)}`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadTractionCsv(data: AdminTraction) {
  const rows: Array<Array<string | number>> = [
    ["section", "date_or_source", "unique_devices", "views", "value"],
    ["summary", "all_time_total_views", "", data.total_views, ""],
    ["summary", "all_time_feedback_count", "", "", data.feedback_count],
    ["summary", "all_time_thumbs_up_rate", "", "", data.thumbs_up_rate === null ? "" : `${(data.thumbs_up_rate * 100).toFixed(1)}%`],
    ...data.daily.map((day) => ["daily_30_day_utc", day.day, day.unique_devices, day.views, ""]),
    ...data.sources.map((source) => ["source_all_time", source.source ?? "direct / untagged", "", source.views, ""]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "orbit-traction.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Metric({ label, value, caption, icon: Icon, testId }: {
  label: string;
  value: string;
  caption: string;
  icon: typeof Eye;
  testId: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums" data-testid={`${testId}-value`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}

function TractionSkeleton() {
  return (
    <section aria-label="Loading traction" className="mt-8 space-y-4" data-testid="loading-traction">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
      <div className="h-64 animate-pulse rounded-3xl bg-muted" />
    </section>
  );
}

export function TractionView({ passcode, onUnauthorized }: { passcode: string; onUnauthorized: () => void }) {
  const query = useGetAdminTraction({
    query: {
      queryKey: getGetAdminTractionQueryKey(),
      enabled: !!passcode,
      retry: false,
    },
    request: adminRequest(passcode),
  });
  const status = query.isError ? errorStatus(query.error) : null;

  useEffect(() => {
    if (status === 401) onUnauthorized();
  }, [status, onUnauthorized]);

  if (query.isLoading) return <TractionSkeleton />;
  if (query.isError && !query.data) {
    return (
      <section className="mt-8 rounded-3xl border bg-card p-6 text-center" data-testid="error-traction">
        <p className="font-semibold">Could not load traction.</p>
        <p className="mt-1 text-sm text-muted-foreground">{errorMessage(query.error)}</p>
        <button data-testid="button-retry-traction" onClick={() => query.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </section>
    );
  }

  const data = query.data;
  if (!data) return null;
  const isEmpty = data.total_views === 0 && data.feedback_count === 0 && data.sources.length === 0;

  return (
    <section className="mt-9 space-y-4" aria-labelledby="traction-heading" data-testid="section-traction">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Reach & response</p>
          <h2 id="traction-heading" className="text-2xl font-extrabold tracking-tight">Traction</h2>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="text-traction-range">Daily data · returned 30-day UTC range · {formatRange(data.range_start, data.range_end)}</p>
        </div>
        <button
          data-testid="button-download-traction-csv"
          onClick={() => downloadTractionCsv(data)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted sm:w-auto"
        >
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </header>

      {isEmpty && (
        <div className="rounded-2xl border border-dashed bg-muted/25 p-4 text-sm text-muted-foreground" data-testid="empty-traction">
          No traction recorded yet. Daily activity will appear here as residents visit zones.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Page views" value={formatNumber(data.total_views)} caption="All-time total" icon={Eye} testId="metric-total-views" />
        <Metric label="Feedback" value={formatNumber(data.feedback_count)} caption="All-time responses" icon={MessageSquareText} testId="metric-feedback-count" />
        <Metric label="Thumbs-up rate" value={data.thumbs_up_rate === null ? "—" : `${(data.thumbs_up_rate * 100).toFixed(1)}%`} caption="All-time feedback" icon={ThumbsUp} testId="metric-thumbs-up-rate" />
        <Metric label="Sources" value={formatNumber(data.sources.length)} caption="All-time source tags" icon={ArrowUpRight} testId="metric-source-count" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,.8fr)]">
        <article className="min-w-0 rounded-3xl border bg-card p-4 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">Unique devices</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Daily visitors across the returned 30-day UTC range</p>
            </div>
            <Users className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          </div>
          <TractionChart daily={data.daily} />
        </article>

        <article className="rounded-3xl border bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold">Views by source</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">All-time · tagged with ?src</p>
            </div>
            <Eye className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          </div>
          {data.sources.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed p-4 text-sm text-muted-foreground" data-testid="empty-traction-sources">No source-tagged views yet.</p>
          ) : (
            <ul className="mt-4 divide-y" data-testid="list-traction-sources">
              {data.sources.map((item, index) => (
                <li key={`${item.source ?? "direct"}-${index}`} data-testid={`row-traction-source-${index}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 truncate text-sm font-medium" data-testid={`text-traction-source-${index}`}>{item.source ?? "Direct / untagged"}</span>
                  <span className="shrink-0 font-mono text-sm tabular-nums" data-testid={`value-traction-source-${index}`}>{formatNumber(item.views)} <span className="font-sans text-xs text-muted-foreground">views</span></span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
