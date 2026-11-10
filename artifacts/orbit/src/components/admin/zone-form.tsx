import { useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { AdminZoneInput } from "@workspace/api-client-react";

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const emptyZone: AdminZoneInput = {
  name: "", type: "crowd", layout_hint: "", low_max: 3, high_min: 10, typical_cycle_min: 45,
  active_start: null, active_end: null, units: [],
};

type Draft = { name: string; type: "crowd" | "machines"; layout_hint: string; low_max: string; high_min: string; typical_cycle_min: string; active_start: string; active_end: string; units: string[] };

function toDraft(z: AdminZoneInput): Draft {
  return { name: z.name, type: z.type, layout_hint: z.layout_hint, low_max: String(z.low_max), high_min: String(z.high_min), typical_cycle_min: String(z.typical_cycle_min), active_start: z.active_start ?? "", active_end: z.active_end ?? "", units: [...z.units] };
}

function validate(d: Draft): { errors: Record<string, string>; value?: AdminZoneInput } {
  const e: Record<string, string> = {};
  const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);
  const low = int(d.low_max), high = int(d.high_min), cyc = int(d.typical_cycle_min);
  if (!d.name.trim()) e.name = "Name is required.";
  else if (d.name.trim().length > 120) e.name = "Max 120 characters.";
  if (d.layout_hint.length > 2000) e.layout_hint = "Max 2000 characters.";
  if (isNaN(low) || low > 100000) e.low_max = "Whole number 0 to 100000.";
  if (isNaN(high) || high < 1 || high > 100000) e.high_min = "Whole number 1 to 100000.";
  if (!e.low_max && !e.high_min && high <= low) e.high_min = "Must be greater than low max.";
  if (isNaN(cyc) || cyc < 1 || cyc > 1440) e.typical_cycle_min = "Whole number 1 to 1440.";
  const s = d.active_start.trim(), en = d.active_end.trim();
  if (!!s !== !!en) e.active = "Set both start and end, or leave both empty.";
  else if (s && (!HHMM.test(s) || !HHMM.test(en))) e.active = "Use HH:mm, for example 07:30.";
  else if (s && s === en) e.active = "Start and end cannot be the same.";
  const units = d.units.map((u) => u.trim());
  if (units.some((u) => !u || u.length > 100)) e.units = "Each label needs 1 to 100 characters.";
  else if (new Set(units).size !== units.length) e.units = "Labels must be unique.";
  else if (units.length > 100) e.units = "Max 100 units.";
  if (Object.keys(e).length) return { errors: e };
  return { errors: e, value: { name: d.name.trim(), type: d.type, layout_hint: d.layout_hint.trim(), low_max: low, high_min: high, typical_cycle_min: cyc, active_start: s || null, active_end: en || null, units } };
}

const inputCls = "w-full rounded-xl border bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring";

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function ZoneForm({ initial, existingUnits, submitLabel, pending, onSubmit, onCancel, idPrefix }: {
  initial: AdminZoneInput; existingUnits?: string[]; submitLabel: string; pending: boolean;
  onSubmit: (v: AdminZoneInput) => void; onCancel?: () => void; idPrefix: string;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [unitInput, setUnitInput] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const removed = (existingUnits ?? []).filter((u) => !d.units.includes(u));

  function addUnit() {
    const u = unitInput.trim();
    if (!u) return;
    if (d.units.includes(u)) { setErrors((p) => ({ ...p, units: "Label already added." })); return; }
    set("units", [...d.units, u]); setUnitInput(""); setErrors((p) => ({ ...p, units: "" }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const r = validate(d);
    setErrors(r.errors);
    if (r.value) onSubmit(r.value);
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid={"form-zone-" + idPrefix}>
      <Field label="Name" error={errors.name}>
        <input data-testid={`input-name-${idPrefix}`} className={inputCls} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Laundry, 2nd floor" />
      </Field>
      <div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Type</span>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["crowd", "machines"] as const).map((t) => (
            <button type="button" key={t} data-testid={`button-type-${t}-${idPrefix}`} onClick={() => set("type", t)}
              className={"rounded-xl border py-2.5 text-sm font-semibold transition-colors " + (d.type === t ? "bg-primary text-primary-foreground border-primary" : "bg-background")}>
              {t === "crowd" ? "Crowd" : "Machines"}
            </button>
          ))}
        </div>
      </div>
      <Field label="Layout hint" error={errors.layout_hint} hint="What the camera sees, for the AI. Example: washers W1 to W4 left to right.">
        <textarea data-testid={`input-layout-${idPrefix}`} rows={3} className={inputCls} value={d.layout_hint} onChange={(e) => set("layout_hint", e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Low max" error={errors.low_max}><input inputMode="numeric" data-testid={`input-low-${idPrefix}`} className={inputCls} value={d.low_max} onChange={(e) => set("low_max", e.target.value)} /></Field>
        <Field label="High min" error={errors.high_min}><input inputMode="numeric" data-testid={`input-high-${idPrefix}`} className={inputCls} value={d.high_min} onChange={(e) => set("high_min", e.target.value)} /></Field>
        <Field label="Cycle min" error={errors.typical_cycle_min}><input inputMode="numeric" data-testid={`input-cycle-${idPrefix}`} className={inputCls} value={d.typical_cycle_min} onChange={(e) => set("typical_cycle_min", e.target.value)} /></Field>
      </div>
      <div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Active hours (optional)</span>
        <div className="mt-1 flex items-center gap-2">
          <input type="time" data-testid={`input-start-${idPrefix}`} className={inputCls} value={d.active_start} onChange={(e) => set("active_start", e.target.value)} />
          <span className="text-muted-foreground text-sm">to</span>
          <input type="time" data-testid={`input-end-${idPrefix}`} className={inputCls} value={d.active_end} onChange={(e) => set("active_end", e.target.value)} />
        </div>
        {(d.active_start || d.active_end) && (
          <button type="button" data-testid={`button-clear-hours-${idPrefix}`} onClick={() => setD((p) => ({ ...p, active_start: "", active_end: "" }))} className="mt-1 text-xs font-semibold text-primary">Clear hours</button>
        )}
        <span className="mt-1 block text-xs text-muted-foreground">Daily, end may be past midnight (22:00 to 06:00). Saved for scheduling only; not enforced yet.</span>
        {errors.active && <span className="mt-1 block text-xs text-destructive">{errors.active}</span>}
      </div>
      <div>
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Units</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {d.units.length === 0 && <span className="text-xs text-muted-foreground">No units. Crowd rooms usually have none.</span>}
          {d.units.map((u) => (
            <span key={u} className="inline-flex items-center gap-1 rounded-full bg-secondary pl-3 pr-1 py-1 font-mono text-xs">
              {u}
              <button type="button" aria-label={"Remove " + u} data-testid={`button-remove-unit-${idPrefix}-${u}`} onClick={() => set("units", d.units.filter((x) => x !== u))} className="rounded-full p-1 hover:bg-background"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input data-testid={`input-unit-${idPrefix}`} className={inputCls} value={unitInput} placeholder="W1" onChange={(e) => setUnitInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUnit(); } }} />
          <button type="button" data-testid={`button-add-unit-${idPrefix}`} onClick={addUnit} className="shrink-0 inline-flex items-center gap-1 rounded-xl border px-3 text-sm font-semibold"><Plus className="h-4 w-4" /> Add</button>
        </div>
        {errors.units && <span className="mt-1 block text-xs text-destructive">{errors.units}</span>}
        {removed.length > 0 && (
          <p className="mt-2 rounded-xl bg-accent/15 px-3 py-2 text-xs" data-testid={`text-removed-units-${idPrefix}`}>
            Saving removes {removed.join(", ")} and its stored current status. Renaming a label counts as remove plus add.
          </p>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={pending} data-testid={`button-save-${idPrefix}`} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-60 active:scale-[0.98] transition-transform">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? "Saving" : submitLabel}
        </button>
        {onCancel && <button type="button" disabled={pending} data-testid={`button-cancel-${idPrefix}`} onClick={onCancel} className="rounded-full border px-5 font-semibold">Cancel</button>}
      </div>
    </form>
  );
}
