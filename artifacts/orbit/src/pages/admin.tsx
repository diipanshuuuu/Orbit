import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, RefreshCw } from "lucide-react";
import { getGetAdminDashboardQueryKey, type AdminDashboard, type AdminZoneInput } from "@workspace/api-client-react";
import { Shell } from "@/components/shell";
import { PasscodeGate } from "@/components/admin/passcode-gate";
import { ZoneForm, emptyZone } from "@/components/admin/zone-form";
import { ZonePanel } from "@/components/admin/zone-panel";
import { useAdminDashboard, useAdminMutations } from "@/hooks/use-admin";
import { errorMessage, errorStatus, forgetPasscode, readPasscode, rememberPasscode } from "@/lib/admin-auth";
import { useToast } from "@/hooks/use-toast";

function useAdminHead() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Orbit admin";
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.title = prev; meta.remove(); };
  }, []);
}

function NewZone({ passcode, onUnauthorized }: { passcode: string; onUnauthorized: () => void }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { createZone } = useAdminMutations(passcode);
  const { toast } = useToast();
  function submit(v: AdminZoneInput) {
    createZone.mutate({ data: v }, {
      onSuccess: () => { toast({ title: "Zone created", description: v.name + ". Now create its camera." }); setOpen(false); setFormKey((k) => k + 1); },
      onError: (err) => { if (errorStatus(err) === 401) onUnauthorized(); else toast({ title: "Could not create zone", description: errorMessage(err), variant: "destructive" }); },
    });
  }
  if (!open) return (
    <button data-testid="button-new-zone" onClick={() => setOpen(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3 font-semibold active:scale-[0.98] transition-transform">
      <Plus className="h-4 w-4" /> New zone
    </button>
  );
  return (
    <section className="rounded-3xl border bg-card p-5 rise">
      <h2 className="text-lg font-bold mb-4">New zone</h2>
      <ZoneForm key={formKey} idPrefix="new" initial={emptyZone} submitLabel="Create zone" pending={createZone.isPending} onSubmit={submit} onCancel={() => setOpen(false)} />
    </section>
  );
}

function Dashboard({ passcode, onUnauthorized, onConfigError }: { passcode: string; onUnauthorized: () => void; onConfigError: () => void }) {
  const q = useAdminDashboard(passcode);
  const status = q.isError ? errorStatus(q.error) : null;
  useEffect(() => {
    if (status === 401) onUnauthorized();
    if (status === 503) onConfigError();
  }, [status, onUnauthorized, onConfigError]);

  if (q.isLoading) return <div className="space-y-3 mt-4">{[0, 1].map((i) => <div key={i} className="h-64 rounded-3xl bg-muted animate-pulse" />)}</div>;
  if (q.isError && !q.data) return (
    <div className="mt-4 rounded-3xl border bg-card p-6 text-center">
      <p className="font-semibold">Could not load admin.</p>
      <p className="text-sm text-muted-foreground mt-1">{errorMessage(q.error)}</p>
      <button data-testid="button-retry-admin" onClick={() => q.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 font-semibold"><RefreshCw className="h-4 w-4" /> Retry</button>
    </div>
  );
  const data = q.data;
  if (!data) return null;
  return (
    <div className="mt-4 space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground" data-testid="text-day">
        Counters for {data.day} (UTC). Tracking started when admin was installed.
      </p>
      <NewZone passcode={passcode} onUnauthorized={onUnauthorized} />
      {data.zones.length === 0 && <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">No zones yet. Create the first one above.</p>}
      {data.zones.map((z) => <ZonePanel key={z.id} zone={z} passcode={passcode} onUnauthorized={onUnauthorized} />)}
    </div>
  );
}

export default function AdminPage() {
  useAdminHead();
  const qc = useQueryClient();
  const [passcode, setPasscode] = useState<string | null>(() => readPasscode());
  const [notice, setNotice] = useState<string | null>(null);

  const clearAll = useCallback(() => {
    forgetPasscode();
    qc.cancelQueries({ queryKey: getGetAdminDashboardQueryKey() });
    qc.removeQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && (query.queryKey[0] as string).startsWith("/api/admin") });
    setPasscode(null);
  }, [qc]);

  const onUnauthorized = useCallback(() => { clearAll(); setNotice("Your saved passcode no longer works. Enter the current one."); }, [clearAll]);
  const onConfigError = useCallback(() => { clearAll(); setNotice("Admin is not configured on the server (ADMIN_PASSCODE missing)."); }, [clearAll]);
  const lock = () => { clearAll(); setNotice("Locked. The passcode was removed from this browser."); };

  function unlock(p: string, data: AdminDashboard) {
    rememberPasscode(p);
    qc.setQueryData(getGetAdminDashboardQueryKey(), data);
    setNotice(null);
    setPasscode(p);
  }

  return (
    <Shell>
      {!passcode ? (
        <PasscodeGate onUnlock={unlock} notice={notice} />
      ) : (
        <>
          <header className="pt-8 flex items-end justify-between gap-3 rise">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Admin</p>
              <h1 className="text-3xl font-extrabold tracking-tight leading-none">Zones and cameras</h1>
            </div>
            <button data-testid="button-lock" onClick={lock} className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold"><Lock className="h-3.5 w-3.5" /> Lock</button>
          </header>
          <Dashboard passcode={passcode} onUnauthorized={onUnauthorized} onConfigError={onConfigError} />
        </>
      )}
    </Shell>
  );
}
