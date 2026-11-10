import { useEffect } from "react";
import { useLocation } from "wouter";
import { useLogUsageEvent } from "@workspace/api-client-react";
import { getOrCreateAnonymousDeviceId } from "@/lib/anonymous-device";

function residentPath(location: string): string | null {
  const path = location.split("?")[0] ?? "";
  if (path === "/") return path;
  return /^\/z\/[A-Za-z0-9-]+$/.test(path) ? path : null;
}

function sourceFromUrl(): string | null {
  const source = new URLSearchParams(window.location.search).get("src");
  return source?.slice(0, 128) || null;
}

export function UsageTracker() {
  const [location] = useLocation();
  const eventMutation = useLogUsageEvent({
    mutation: {
      onError: (error) => {
        const status = typeof error === "object" && error !== null && "status" in error
          ? (error as { status?: unknown }).status
          : null;
        console.warn("Orbit usage event could not be saved", { status: typeof status === "number" ? status : null });
      },
    },
  });

  useEffect(() => {
    const path = residentPath(location);
    try {
      const deviceId = getOrCreateAnonymousDeviceId();
      if (!path) return;
      eventMutation.mutate({
        data: {
          device_id: deviceId,
          event_type: "page_view",
          path,
          source: sourceFromUrl(),
          action: null,
        },
      });
    } catch {
      console.warn("Orbit usage tracking is unavailable in this browser.");
    }
  }, [location, eventMutation.mutate]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const path = residentPath(window.location.pathname);
      if (!path) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button) return;
      const action = (button.getAttribute("aria-label") || button.textContent || "")
        .replace(/\s+/g, " ").trim().slice(0, 120);
      if (!action) return;
      try {
        eventMutation.mutate({
          data: {
            device_id: getOrCreateAnonymousDeviceId(),
            event_type: "button_tap",
            path,
            source: sourceFromUrl(),
            action,
          },
        });
      } catch {
        console.warn("Orbit usage tracking is unavailable in this browser.");
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [eventMutation.mutate]);

  return null;
}
