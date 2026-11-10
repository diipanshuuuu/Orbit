import { useGetZones, getGetZonesQueryKey } from "@workspace/api-client-react";
import { useNow } from "@/lib/time";
import { maskStaleZone } from "@/lib/freshness";

// Polls every 15 s while the tab is visible. Background polling is off and
// React Query refetches when the tab becomes visible again.
export function useZones() {
  const now = useNow();
  const query = useGetZones({
    query: {
      queryKey: getGetZonesQueryKey(),
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: "always",
      refetchOnReconnect: "always",
      staleTime: 5_000,
    },
  });
  return { ...query, data: query.data?.map((zone) => maskStaleZone(zone, now)) };
}
