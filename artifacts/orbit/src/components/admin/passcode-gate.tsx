import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { getAdminDashboard, type AdminDashboard } from "@workspace/api-client-react";
import { adminRequest, errorMessage, errorStatus } from "@/lib/admin-auth";

export function PasscodeGate({ onUnlock, notice }: { onUnlock: (passcode: string, data: AdminDashboard) => void; notice?: string | null }) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const p = value.trim();
    if (!p) { setError("Enter the passcode."); return; }
    setPending(true); setError(null); setConfig(false);
    try {
      const data = await getAdminDashboard(adminRequest(p));
      setValue("");
      onUnlock(p, data);
    } catch (err) {
      setConfig(errorStatus(err) === 503);
      setError(errorStatus(err) === 401 ? "That passcode is not right." : errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 rounded-3xl border bg-card p-6 rise" data-testid="form-passcode">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="h-5 w-5" /></span>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter the admin passcode. This browser remembers it until you lock.</p>
      {notice && <p className="mt-3 text-sm rounded-xl bg-muted px-3 py-2" data-testid="text-notice">{notice}</p>}
      <input
        type="password"
        autoComplete="current-password"
        data-testid="input-passcode"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-5 w-full rounded-2xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
        placeholder="Passcode"
      />
      {error && (
        <p className={"mt-3 text-sm rounded-xl px-3 py-2 " + (config ? "bg-accent/15 text-foreground" : "text-destructive")} data-testid="text-passcode-error">{error}</p>
      )}
      <button type="submit" disabled={pending} data-testid="button-unlock" className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3 font-semibold disabled:opacity-60 active:scale-[0.98] transition-transform">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />} {pending ? "Checking" : "Unlock"}
      </button>
    </form>
  );
}
