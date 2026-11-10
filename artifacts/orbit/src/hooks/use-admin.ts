import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdminDashboard,
  getGetAdminDashboardQueryKey,
  getGetZonesQueryKey,
  useCreateAdminZone,
  useUpdateAdminZone,
  useCreateAdminCamera,
} from "@workspace/api-client-react";
import { adminRequest } from "@/lib/admin-auth";

function useVisible() {
  const [v, setV] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const on = () => setV(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}

export function useAdminDashboard(passcode: string | null) {
  const visible = useVisible();
  return useGetAdminDashboard({
    query: {
      queryKey: getGetAdminDashboardQueryKey(),
      enabled: !!passcode,
      refetchInterval: visible ? 15000 : false,
      refetchIntervalInBackground: false,
      retry: false,
    },
    request: passcode ? adminRequest(passcode) : undefined,
  });
}

function useRefreshAfterSave() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: getGetAdminDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getGetZonesQueryKey() });
  };
}

export function useAdminMutations(passcode: string) {
  const refresh = useRefreshAfterSave();
  const request = adminRequest(passcode);
  const createZone = useCreateAdminZone({ request, mutation: { onSuccess: refresh } });
  const updateZone = useUpdateAdminZone({ request, mutation: { onSuccess: refresh } });
  const createCamera = useCreateAdminCamera({ request, mutation: { onSuccess: refresh } });
  return { createZone, updateZone, createCamera };
}
