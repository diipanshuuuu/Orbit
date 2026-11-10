import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { AdminFeedback } from "@workspace/api-client-react";

export function FeedbackList({
  feedback,
  count,
  agreementRate,
  zoneId,
}: {
  feedback: AdminFeedback[];
  count: number;
  agreementRate: number | null;
  zoneId: number;
}) {
  return (
    <details className="group rounded-2xl border bg-background/60" data-testid={`feedback-${zoneId}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
        <span>Resident feedback <span className="font-mono text-xs text-muted-foreground">{count}</span></span>
        <span className="font-mono text-xs text-muted-foreground">
          {agreementRate === null ? "No votes" : `${Math.round(agreementRate * 100)}% agree`}
        </span>
      </summary>
      <div className="space-y-2 px-4 pb-4">
        {feedback.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback yet for this zone.</p>
        ) : feedback.map((entry) => (
          <div key={entry.id} data-testid={`feedback-entry-${entry.id}`} className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5">
            {entry.vote === "up"
              ? <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--st-low))]" aria-label="Thumbs up" />
              : <ThumbsDown className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--st-high))]" aria-label="Thumbs down" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {entry.unit_label ? `${entry.unit_label} · ` : ""}{entry.status_shown.replace("_", " ")}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleString()} · device {entry.device_id.slice(0, 8)}
              </p>
            </div>
          </div>
        ))}
        {count > feedback.length && <p className="text-xs text-muted-foreground">Showing the latest {feedback.length} of {count} votes.</p>}
      </div>
    </details>
  );
}
