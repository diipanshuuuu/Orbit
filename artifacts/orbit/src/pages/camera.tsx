import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Camera, FileVideo, Square, Sun, SunDim, WifiOff } from "lucide-react";
import { useCameraFeed, type Source } from "@/hooks/use-camera-feed";
import { useNow, ago } from "@/lib/time";
import { Logo } from "@/components/shell";
import { zoneLabel } from "@/components/zone-status";

export default function CameraPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [source, setSource] = useState<Source | null>(null);
  const { videoRef, stats, reset } = useCameraFeed(token, source);
  const fileRef = useRef<HTMLInputElement>(null);
  const now = useNow();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  const stop = () => { setSource(null); reset(); };
  const reply = stats.lastReply;
  const retryIn = stats.retryAt ? Math.max(0, Math.ceil((stats.retryAt - now) / 1000)) : null;

  return (
    <div className="min-h-[100dvh] bg-[hsl(232_38%_12%)] text-[hsl(40_33%_94%)]">
      <div className="mx-auto max-w-md px-4 pb-10">
        <header className="flex items-center justify-between pt-5">
          <span className="flex items-center gap-2 font-extrabold text-lg"><Logo /> Orbit camera</span>
          {!online && <span className="flex items-center gap-1 font-mono text-xs text-[hsl(var(--st-medium))]"><WifiOff className="h-3.5 w-3.5" /> offline</span>}
        </header>

        <div className="relative mt-5 aspect-video overflow-hidden rounded-3xl bg-black/40 ring-1 ring-white/10">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" data-testid="video-feed" />
          {!source && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-6">
              <p className="font-bold text-lg">Point this phone at the room</p>
              <p className="text-sm opacity-60">Frames go to the server for counting and are never saved on this device.</p>
            </div>
          )}
          {source && stats.mediaReady && (
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 font-mono text-[11px]">
              <span className="relative h-2 w-2 rounded-full bg-[hsl(var(--st-high))] text-[hsl(var(--st-high))] ping" />
              {stats.sending ? "sending" : "watching"}
            </span>
          )}
        </div>

        {stats.mediaError && <p data-testid="text-media-error" className="mt-3 rounded-2xl bg-white/5 px-4 py-3 text-sm">{stats.mediaError}</p>}

        {!source ? (
          <div className="mt-5 grid gap-3">
            <button data-testid="button-start-camera" onClick={() => setSource({ kind: "camera" })}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[hsl(16_88%_58%)] py-4 text-lg font-bold text-[hsl(232_38%_12%)] active:scale-[0.98] transition-transform">
              <Camera className="h-5 w-5" /> Start rear camera
            </button>
            <button data-testid="button-pick-file" onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 py-4 font-semibold active:scale-[0.98] transition-transform">
              <FileVideo className="h-5 w-5" /> Use a video file
            </button>
            <input ref={fileRef} type="file" accept="video/*" className="hidden" data-testid="input-file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setSource({ kind: "file", file: f }); e.target.value = ""; }} />
          </div>
        ) : (
          <button data-testid="button-stop" onClick={stop}
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl border border-white/15 py-3.5 font-semibold active:scale-[0.98] transition-transform">
            <Square className="h-4 w-4" /> Stop {source.kind === "file" ? "video" : "camera"}
          </button>
        )}

        <dl className="mt-6 grid grid-cols-3 gap-2">
          {([["checked", stats.checked], ["uploaded", stats.uploaded], ["analysed", stats.analysed]] as const).map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/5 p-3">
              <dt className="font-mono text-[10px] uppercase tracking-widest opacity-60">{k}</dt>
              <dd data-testid={"text-count-" + k} className="text-3xl font-extrabold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-4 rounded-2xl bg-white/5 p-4 font-mono text-xs space-y-1.5">
          <Row k="change" v={stats.lastDiff == null ? "baseline pending" : (stats.lastDiff * 255).toFixed(1) + " / 255 (threshold 12)"} />
          <Row k="screen lock" v={stats.wakeLock === "on" ? "kept awake" : stats.wakeLock === "unsupported" ? "not supported, keep screen on manually" : "off"}
            icon={stats.wakeLock === "on" ? <Sun className="h-3.5 w-3.5" /> : <SunDim className="h-3.5 w-3.5" />} />
          {stats.lastError && <Row k="error" v={stats.lastError + (retryIn != null ? ", retry in " + retryIn + " s" : "")} warn />}
          <div className="pt-2 mt-2 border-t border-white/10">
            <p className="uppercase tracking-widest opacity-60 text-[10px] mb-1.5">last server reply</p>
            {reply ? (
              <div data-testid="text-last-reply" className="space-y-1.5">
                <Row k="when" v={ago(new Date(stats.lastReplyAt ?? now).toISOString(), now) ?? ""} />
                <Row k="analysed" v={reply.analysed ? "yes" : "no"} />
                <Row k="zone" v={reply.status.name + ": " + zoneLabel(reply.status) + (reply.status.people_count != null ? ", " + reply.status.people_count + " people" : "")} />
                <Row k="recheck" v={reply.recheck ? "next frame in 10 s" : "no"} />
                <Row k="last analysis" v={ago(reply.last_analysed_at, now) ?? "never"} />
              </div>
            ) : <p className="opacity-60">nothing yet</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v, warn, icon }: { k: string; v: string; warn?: boolean; icon?: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="opacity-60">{k}</span>
      <span className={"text-right flex items-center gap-1 " + (warn ? "text-[hsl(var(--st-medium))]" : "")}>{icon}{v}</span>
    </div>
  );
}
