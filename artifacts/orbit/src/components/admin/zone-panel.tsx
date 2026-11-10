import { useState } from "react";
import { Link } from "wouter";
import { Pencil, Plus, Loader2 } from "lucide-react";
import type { AdminZone, AdminZoneInput } from "@workspace/api-client-react";
import { ZoneForm } from "./zone-form";
import { CameraCard } from "./camera-card";
import { ReadingsList } from "./readings-list";
import { FeedbackList } from "./feedback-list";
import { useAdminMutations } from "@/hooks/use-admin";
import { errorMessage, errorStatus } from "@/lib/admin-auth";
import { useToast } from "@/hooks/use-toast";

export function ZonePanel({ zone, passcode, onUnauthorized }: { zone: AdminZone; passcode: string; onUnauthorized: () => void }) {
  const [editing, setEditing] = useState(false);
  const { updateZone, createCamera } = useAdminMutations(passcode);
  const { toast } = useToast();

  function fail(err: unknown) {
    if (errorStatus(err) === 401) { onUnauthorized(); return; }
    toast({ title: "Could not save", description: errorMessage(err), variant: "destructive" });
  }

  function save(v: AdminZoneInput) {
    updateZone.mutate({ id: zone.id, data: v }, {
      onSuccess: () => { setEditing(false); toast({ title: "Zone saved", description: v.name }); },
      onError: fail,
    });
  }

  function addCamera() {
    if (createCamera.isPending) return;
    createCamera.mutate({ id: zone.id }, {
      onSuccess: () => toast({ title: "Camera created", description: "Scan its QR code with the phone that will watch " + zone.name + "." }),
      onError: fail,
    });
  }

  const input: AdminZoneInput = { name: zone.name, type: zone.type, layout_hint: zone.layout_hint, low_max: zone.low_max, high_min: zone.high_min, typical_cycle_min: zone.typical_cycle_min, active_start: zone.active_start, active_end: zone.active_end, units: zone.units };

  return (
    <section className="relative overflow-hidden rounded-3xl border bg-card p-5 rise" data-testid={`panel-zone-${zone.id}`}>
      <span className="absolute inset-y-0 left-0 w-1.5 bg-primary/70" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{zone.type === "machines" ? "Machines" : "Room"}</p>
          <h2 className="text-xl font-bold mt-0.5 truncate" data-testid={`text-zone-name-${zone.id}`}>{zone.name}</h2>
          <Link href={"/z/" + zone.slug} className="font-mono text-xs text-primary" data-testid={`link-zone-${zone.id}`}>/z/{zone.slug}</Link>
        </div>
        {!editing && (
          <button data-testid={`button-edit-${zone.id}`} onClick={() => setEditing(true)} className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold"><Pencil className="h-3.5 w-3.5" /> Edit</button>
        )}
      </div>

      {editing ? (
        <div className="mt-4"><ZoneForm idPrefix={String(zone.id)} initial={input} existingUnits={zone.units} submitLabel="Save zone" pending={updateZone.isPending} onSubmit={save} onCancel={() => setEditing(false)} /></div>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><dt className="text-muted-foreground text-xs">Crowd levels</dt><dd className="font-semibold">low to {zone.low_max}, high from {zone.high_min}</dd></div>
          <div><dt className="text-muted-foreground text-xs">Cycle</dt><dd className="font-semibold">{zone.typical_cycle_min} min</dd></div>
          <div><dt className="text-muted-foreground text-xs">Active hours</dt><dd className="font-semibold">{zone.active_start && zone.active_end ? zone.active_start + " to " + zone.active_end : "Always"}</dd></div>
          <div><dt className="text-muted-foreground text-xs">Units</dt><dd className="font-semibold font-mono text-xs pt-0.5">{zone.units.length ? zone.units.join(", ") : "none"}</dd></div>
          {zone.layout_hint && <div className="col-span-2"><dt className="text-muted-foreground text-xs">Layout hint</dt><dd className="text-sm">{zone.layout_hint}</dd></div>}
        </dl>
      )}

      <div className="mt-5 space-y-3">
        {zone.cameras.length === 0 && <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No camera yet. Create one, then open its link on a spare phone.</p>}
        {zone.cameras.map((c, i) => <CameraCard key={c.id} cam={c} index={i} passcode={passcode} onUnauthorized={onUnauthorized} />)}
        <button data-testid={`button-add-camera-${zone.id}`} onClick={addCamera} disabled={createCamera.isPending} className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-dashed py-2.5 text-sm font-semibold text-primary disabled:opacity-60">
          {createCamera.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {createCamera.isPending ? "Creating" : "Create camera"}
        </button>
        <ReadingsList readings={zone.readings} zoneId={zone.id} />
        <FeedbackList feedback={zone.feedback} count={zone.feedback_count} agreementRate={zone.agreement_rate} zoneId={zone.id} />
      </div>
    </section>
  );
}
