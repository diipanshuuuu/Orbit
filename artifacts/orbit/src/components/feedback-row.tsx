import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { getGetAdminDashboardQueryKey, getGetZonesQueryKey, useSubmitFeedback, type FeedbackInput } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getFeedbackDeviceId } from "@/lib/feedback-device";

export function FeedbackRow({
  zoneSlug,
  status,
  unitLabel = null,
  isDemo = false,
}: {
  zoneSlug: string;
  status: FeedbackInput["status_shown"];
  unitLabel?: string | null;
  isDemo?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saved, setSaved] = useState<"up" | "down" | null>(null);
  const submit = useSubmitFeedback({
    mutation: {
      onSuccess: (_data, variables) => {
        setSaved(variables.data.vote);
        void queryClient.invalidateQueries({ queryKey: getGetZonesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() });
      },
      onError: () => toast({
        title: "Feedback could not be saved",
        description: "Check your connection and try again.",
        variant: "destructive",
      }),
    },
  });

  function vote(value: "up" | "down") {
    if (submit.isPending) return;
    try {
      submit.mutate({
        data: {
          zone_slug: zoneSlug,
          unit_label: unitLabel,
          vote: value,
          status_shown: status,
          device_id: getFeedbackDeviceId(),
        },
      });
    } catch {
      toast({
        title: "Feedback could not be saved",
        description: "This browser could not save the anonymous feedback ID.",
        variant: "destructive",
      });
    }
  }

  const subject = unitLabel ? `${unitLabel} status` : "room status";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card/70 px-4 py-3" data-testid={`feedback-row-${zoneSlug}-${unitLabel ?? "zone"}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{unitLabel ? "Is this unit status right?" : "Is this right?"}</p>
        {saved ? (
          <p className="text-xs text-muted-foreground" role="status">
            {saved === "down" ? isDemo ? "Thanks — demo feedback saved. This schedule is simulated." : "Thanks — the camera will re-check this room." : "Thanks for confirming."}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Your feedback is anonymous.</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          data-testid={`button-feedback-up-${zoneSlug}-${unitLabel ?? "zone"}`}
          aria-label={`Yes, ${subject} is right`}
          disabled={submit.isPending}
          onClick={() => vote("up")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border text-[hsl(var(--st-low))] transition-colors hover:bg-muted disabled:opacity-50"
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid={`button-feedback-down-${zoneSlug}-${unitLabel ?? "zone"}`}
          aria-label={`No, ${subject} is wrong`}
          disabled={submit.isPending}
          onClick={() => vote("down")}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border text-[hsl(var(--st-high))] transition-colors hover:bg-muted disabled:opacity-50"
        >
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
