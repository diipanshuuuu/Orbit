import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Eye, EyeOff, RefreshCw, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetAdminCameraFrame, getGetAdminCameraFrameQueryKey, type AdminCamera } from "@workspace/api-client-react";
import { adminRequest, cameraUrl, errorMessage, errorStatus } from "@/lib/admin-auth";
import { useToast } from "@/hooks/use-toast";

function ago(iso: string | null) {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return s + " s ago";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  return new Date(iso).toLocaleString();
}

function FramePreview({ id, passcode, onUnauthorized }: { id: number; passcode: string; onUnauthorized: () => void }) {
  const q = useGetAdminCameraFrame(id, { query: { queryKey: getGetAdminCameraFrameQueryKey(id), retry: false, staleTime: 0 }, request: adminRequest(passcode) });
  useEffect(() => {
    if (errorStatus(q.error) === 401) onUnauthorized();
  }, [q.error, onUnauthorized]);
  if (q.isLoading) return <div className="aspect-video rounded-2xl bg-muted animate-pulse" />;
  if (q.isError) return (
    <div className="rounded-2xl border p-4 text-sm">
      <p className="text-destructive">{errorMessage(q.error)}</p>
      <button data-testid={`button-retry-frame-${id}`} onClick={() => q.refetch()} className="mt-2 font-semibold text-primary">Retry</button>
    </div>
  );
  if (!q.data?.image) return <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No frame stored yet.</p>;
  return (
    <div className="space-y-2">
      <img data-testid={`img-frame-${id}`} src={"data:image/jpeg;base64," + q.data.image} alt="Latest camera frame" className="w-full rounded-2xl border" />
      <button data-testid={`button-refresh-frame-${id}`} disabled={q.isFetching} onClick={() => q.refetch()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary disabled:opacity-60">
        <RefreshCw className={"h-3.5 w-3.5 " + (q.isFetching ? "animate-spin" : "")} /> Refresh frame
      </button>
    </div>
  );
}

export function CameraCard({ cam, passcode, index, onUnauthorized }: { cam: AdminCamera; passcode: string; index: number; onUnauthorized: () => void }) {
  const url = cameraUrl(cam.path);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
      toast({ title: "Camera link copied" });
    } catch {
      toast({ title: "Copy failed", description: "Select the link text and copy it manually." });
    }
  }

  function togglePreview() {
    if (preview) qc.removeQueries({ queryKey: getGetAdminCameraFrameQueryKey(cam.id) });
    setPreview(!preview);
  }

  const stats: [string, string | number][] = [
    ["Frames today", cam.frames_received], ["Analysed today", cam.analysed], ["Allowance left", Math.floor(cam.allowance_left * 100) / 100],
  ];

  return (
    <div className="rounded-2xl border bg-background/60 p-4" data-testid={`card-camera-${cam.id}`}>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Camera {index + 1}</p>
        <span className="font-mono text-[11px] text-muted-foreground">#{cam.id}</span>
      </div>
      <div className="mt-3 flex gap-4 items-start">
        <div className="shrink-0 rounded-xl bg-[hsl(40_40%_99%)] p-2 border">
          <QRCodeSVG value={url} size={112} bgColor="transparent" fgColor="hsl(232 38% 16%)" data-testid={`qr-camera-${cam.id}`} />
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p><span className="text-muted-foreground">Last seen </span><span data-testid={`text-seen-${cam.id}`} className="font-semibold">{ago(cam.last_seen_at)}</span></p>
          <p><span className="text-muted-foreground">Last analysed </span><span data-testid={`text-analysed-${cam.id}`} className="font-semibold">{ago(cam.last_analysed_at)}</span></p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} data-testid={`input-camera-url-${cam.id}`} className="min-w-0 flex-1 rounded-xl border bg-card px-3 py-2 font-mono text-xs select-all" />
        <button data-testid={`button-copy-${cam.id}`} onClick={copy} className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-semibold">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-muted px-2.5 py-2">
            <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k}</dt>
            <dd className="text-lg font-extrabold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <button data-testid={`button-preview-${cam.id}`} onClick={togglePreview} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold">
          {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {preview ? "Hide frame" : "Show latest frame"}
        </button>
        {!cam.has_frame && !preview && <span className="ml-2 text-xs text-muted-foreground">No frame yet</span>}
        {preview && <div className="mt-3"><FramePreview id={cam.id} passcode={passcode} onUnauthorized={onUnauthorized} /></div>}
      </div>
    </div>
  );
}
