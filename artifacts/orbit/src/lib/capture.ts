export const THUMB_W = 64;
export const THUMB_H = 36;
export const DIFF_THRESHOLD = 12 / 255;

export function makeThumb(video: HTMLVideoElement, canvas: HTMLCanvasElement): Uint8Array | null {
  if (!video.videoWidth || video.readyState < 2) return null;
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
  const px = ctx.getImageData(0, 0, THUMB_W, THUMB_H).data;
  const out = new Uint8Array(THUMB_W * THUMB_H);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
  }
  return out;
}

export function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length / 255;
}

// Returns base64 JPEG without the data URL prefix. Kept in memory only.
export function encodeJpeg(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const w = Math.min(1024, vw);
  const h = Math.round((vh / vw) * w);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const url = canvas.toDataURL("image/jpeg", 0.7);
  const idx = url.indexOf(",");
  return idx >= 0 ? url.slice(idx + 1) : null;
}
