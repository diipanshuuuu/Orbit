import { useCallback, useEffect, useRef, useState } from "react";
import { ingestFrame, type IngestReply } from "@workspace/api-client-react";
import { makeThumb, meanAbsDiff, encodeJpeg, DIFF_THRESHOLD } from "@/lib/capture";
import { uploadDue } from "@/lib/upload-schedule";

const TICK_MS = 5_000;
const RECHECK_DELAY = 10_000;
const BACKOFF_BASE = 5_000;
const BACKOFF_MAX = 120_000;

export type Source = { kind: "camera" } | { kind: "file"; file: File };

export interface FeedStats {
  checked: number;
  uploaded: number;
  analysed: number;
  lastDiff: number | null;
  lastReply: IngestReply | null;
  lastReplyAt: number | null;
  lastError: string | null;
  retryAt: number | null;
  sending: boolean;
  wakeLock: "on" | "off" | "unsupported";
  mediaError: string | null;
  mediaReady: boolean;
}

const initial: FeedStats = {
  checked: 0, uploaded: 0, analysed: 0, lastDiff: null, lastReply: null, lastReplyAt: null,
  lastError: null, retryAt: null, sending: false, wakeLock: "off", mediaError: null, mediaReady: false,
};

export function useCameraFeed(token: string, source: Source | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stats, setStats] = useState<FeedStats>(initial);
  const patch = useCallback((p: Partial<FeedStats> | ((s: FeedStats) => Partial<FeedStats>)) => {
    setStats((s) => ({ ...s, ...(typeof p === "function" ? p(s) : p) }));
  }, []);

  // ---- media source ----
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let objectUrl: string | null = null;
    let restartTimer: number | undefined;
    const video = videoRef.current;
    if (!video) return;
    patch({ mediaReady: false, mediaError: null });

    const stopStream = () => {
      stream?.getTracks().forEach((t) => { t.onended = null; t.stop(); });
      stream = null;
    };

    const startCamera = async () => {
      stopStream();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        s.getVideoTracks().forEach((t) => {
          t.onended = () => {
            if (cancelled) return;
            patch({ mediaReady: false, mediaError: "Camera stopped. Restarting..." });
            restartTimer = window.setTimeout(startCamera, 2_000);
          };
        });
        video.srcObject = s;
        video.muted = true;
        await video.play().catch(() => undefined);
        if (!cancelled) patch({ mediaReady: true, mediaError: null });
      } catch (e) {
        if (cancelled) return;
        patch({ mediaReady: false, mediaError: e instanceof Error ? e.message : "Could not open camera" });
        restartTimer = window.setTimeout(startCamera, 10_000);
      }
    };

    if (source.kind === "camera") {
      if (!navigator.mediaDevices?.getUserMedia) patch({ mediaError: "This browser cannot open the camera. Use a video file instead." });
      else void startCamera();
    } else {
      objectUrl = URL.createObjectURL(source.file);
      video.srcObject = null;
      video.src = objectUrl;
      video.loop = true;
      video.muted = true;
      video.play().then(() => { if (!cancelled) patch({ mediaReady: true }); })
        .catch(() => { if (!cancelled) patch({ mediaError: "Could not play this file." }); });
    }

    return () => {
      cancelled = true;
      window.clearTimeout(restartTimer);
      stopStream();
      video.pause();
      video.srcObject = null;
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, patch]);

  // ---- wake lock ----
  useEffect(() => {
    if (!source) return;
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock;
    if (!wl) { patch({ wakeLock: "unsupported" }); return; }
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || disposed) return;
      if (sentinel && !sentinel.released) return;
      try {
        const s = await wl.request("screen");
        if (disposed) { void s.release(); return; }
        sentinel = s;
        patch({ wakeLock: "on" });
        s.addEventListener("release", () => { if (!disposed) patch({ wakeLock: "off" }); });
      } catch { patch({ wakeLock: "off" }); }
    };
    const onVis = () => { if (document.visibilityState === "visible") void acquire(); };
    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release().catch(() => undefined);
    };
  }, [source, patch]);

  // ---- capture / upload loop ----
  useEffect(() => {
    if (!source) return;
    const video = videoRef.current;
    if (!video) return;
    const thumbCanvas = document.createElement("canvas");
    const jpegCanvas = document.createElement("canvas");
    let disposed = false;
    let busy = false;
    let baseline: Uint8Array | null = null;
    let everSent = false;
    let lastChangedSentAt = 0;
    let lastSentAt = 0;
    let recheckAt: number | null = null;
    let failures = 0;
    let retryAt = 0;
    let tickTimer: number | undefined;
    let recheckTimer: number | undefined;
    const ctrl = new AbortController();

    const send = async (thumb: Uint8Array, changed: boolean) => {
      const image = encodeJpeg(video, jpegCanvas);
      if (!image) return;
      // Count attempts at dispatch, not at acknowledgement: the server might
      // receive a frame even when its reply is lost.
      everSent = true;
      lastSentAt = Date.now();
      if (changed) lastChangedSentAt = lastSentAt;
      patch((s) => ({ uploaded: s.uploaded + 1, sending: true }));
      try {
        const reply = await ingestFrame({ token, image, changed }, { signal: ctrl.signal });
        if (disposed) return;
        failures = 0; retryAt = 0;
        const t = Date.now();
        if (reply.analysed) baseline = thumb; // exact submitted thumbnail
        if (reply.recheck) {
          recheckAt = t + RECHECK_DELAY;
          window.clearTimeout(recheckTimer);
          recheckTimer = window.setTimeout(() => void tick(), RECHECK_DELAY);
        } else recheckAt = null;
        patch((s) => ({
          analysed: s.analysed + (reply.analysed ? 1 : 0), lastReply: reply, lastReplyAt: t,
          lastError: null, retryAt: null, sending: false,
        }));
      } catch (e) {
        if (disposed) return;
        failures++;
        const wait = Math.min(BACKOFF_MAX, BACKOFF_BASE * 2 ** (failures - 1));
        retryAt = Date.now() + wait;
        window.clearTimeout(recheckTimer);
        recheckTimer = window.setTimeout(() => void tick(), wait);
        patch({ lastError: e instanceof Error ? e.message : "Upload failed", retryAt, sending: false });
      }
    };

    const tick = async () => {
      if (disposed || busy) return;
      if (source.kind === "camera" && !(video.srcObject as MediaStream | null)?.getVideoTracks().some((t) => t.readyState === "live")) return;
      busy = true;
      try {
        const thumb = makeThumb(video, thumbCanvas);
        if (!thumb) return;
        const diff = baseline ? meanAbsDiff(thumb, baseline) : null;
        patch((s) => ({ checked: s.checked + 1, lastDiff: diff }));
        const now = Date.now();
        if (retryAt && now < retryAt) return;
        if (!navigator.onLine && failures > 0) return;
        const differs = diff === null || diff > DIFF_THRESHOLD;
        const changed = uploadDue({
          now, everSent, differs, lastSentAt, lastChangedSentAt, recheckAt, retryAt, failures,
        });
        if (changed === null) return;
        if (recheckAt !== null && now >= recheckAt) recheckAt = null;
        await send(thumb, changed);
      } finally {
        busy = false;
      }
    };

    const loop = () => {
      void tick();
      tickTimer = window.setTimeout(loop, TICK_MS);
    };
    loop();

    const onOnline = () => { retryAt = failures > 0 ? Date.now() : 0; void tick(); };
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      ctrl.abort();
      window.clearTimeout(tickTimer);
      window.clearTimeout(recheckTimer);
      window.removeEventListener("online", onOnline);
    };
  }, [source, token, patch]);

  const reset = useCallback(() => setStats(initial), []);
  return { videoRef, stats, reset };
}
