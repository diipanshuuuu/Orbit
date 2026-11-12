#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";

const DEFAULT_INTERVAL_SECONDS = 60;
const FFMPEG_TIMEOUT_MS = 30_000;
const MAX_FRAME_BYTES = 16 * 1024 * 1024;

class BridgeError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function readConfig() {
  const missing = ["ORBIT_URL", "CAMERA_TOKEN", "RTSP_URL"]
    .filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    return null;
  }

  let ingestUrl;
  let streamUrl;
  try {
    const orbitUrl = new URL(process.env.ORBIT_URL.trim());
    if (!["http:", "https:"].includes(orbitUrl.protocol) || orbitUrl.search || orbitUrl.hash) {
      throw new Error();
    }
    ingestUrl = `${orbitUrl.toString().replace(/\/+$/, "")}/api/ingest`;

    streamUrl = new URL(process.env.RTSP_URL.trim()).toString();
    if (!["rtsp:", "http:", "https:"].includes(new URL(streamUrl).protocol)) {
      throw new Error();
    }
  } catch {
    console.error("ORBIT_URL must be an HTTP(S) base URL and RTSP_URL must be an RTSP or HTTP(S) stream URL.");
    return null;
  }

  const intervalValue = process.env.INTERVAL_SECONDS;
  const intervalSeconds = intervalValue === undefined
    ? DEFAULT_INTERVAL_SECONDS
    : Number(intervalValue);
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 1) {
    console.error("INTERVAL_SECONDS must be a positive whole number.");
    return null;
  }

  const ffmpeg = spawnSync("ffmpeg", ["-version"], {
    stdio: "ignore",
    timeout: 5_000,
  });
  if (ffmpeg.error || ffmpeg.status !== 0) {
    console.error("ffmpeg was not found or could not be started. Install ffmpeg and ensure it is on PATH.");
    return null;
  }

  return {
    ingestUrl,
    cameraToken: process.env.CAMERA_TOKEN.trim(),
    streamUrl,
    intervalMs: intervalSeconds * 1_000,
  };
}

function timestamp() {
  return new Date().toISOString();
}

function captureJpeg(streamUrl) {
  const args = [
    "-nostdin",
    "-hide_banner",
    "-loglevel", "error",
    "-rw_timeout", "10000000",
  ];
  if (streamUrl.startsWith("rtsp://")) args.push("-rtsp_transport", "tcp");
  args.push(
    "-i", streamUrl,
    "-frames:v", "1",
    "-vf", "scale='min(1024,iw)':-2",
    "-q:v", "2",
    "-f", "image2pipe",
    "-vcodec", "mjpeg",
    "pipe:1",
  );

  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let tooLarge = false;
    let byteCount = 0;
    const chunks = [];
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "ignore"] });
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(value);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, FFMPEG_TIMEOUT_MS);

    child.once("error", () => finish(new BridgeError("ffmpeg")));
    child.stdout.on("data", (chunk) => {
      byteCount += chunk.length;
      if (byteCount > MAX_FRAME_BYTES) {
        tooLarge = true;
        child.kill("SIGKILL");
        return;
      }
      chunks.push(chunk);
    });
    child.once("close", (code) => {
      if (timedOut) return finish(new BridgeError("ffmpeg-timeout"));
      if (tooLarge) return finish(new BridgeError("frame-too-large"));
      if (code !== 0) return finish(new BridgeError("ffmpeg"));

      const jpeg = Buffer.concat(chunks);
      if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg.at(-2) !== 0xff || jpeg.at(-1) !== 0xd9) {
        return finish(new BridgeError("invalid-jpeg"));
      }
      finish(null, jpeg);
    });
  });
}

function safeZoneState(payload) {
  const state = payload?.status?.state;
  if (typeof state !== "string") return "unknown";
  return state.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "unknown";
}

async function sendFrame(config) {
  let jpeg;
  try {
    jpeg = await captureJpeg(config.streamUrl);
  } catch (error) {
    const reason = error instanceof BridgeError ? error.code : "ffmpeg";
    console.log(`${timestamp()} ERROR ${reason}; retrying next interval`);
    return;
  }

  let response;
  try {
    response = await fetch(config.ingestUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: config.cameraToken,
        image: jpeg.toString("base64"),
        changed: true,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    console.log(`${timestamp()} ERROR network; retrying next interval`);
    return;
  }

  if (response.status !== 200) {
    await response.body?.cancel().catch(() => {});
    console.log(`${timestamp()} HTTP ${response.status}; retrying next interval`);
    return;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    console.log(`${timestamp()} HTTP 200 invalid response; retrying next interval`);
    return;
  }

  const analysed = typeof payload?.analysed === "boolean" ? String(payload.analysed) : "unknown";
  console.log(`${timestamp()} HTTP 200 analysed=${analysed} zone=${safeZoneState(payload)}`);
}

async function main() {
  const config = readConfig();
  if (!config) {
    process.exitCode = 1;
    return;
  }

  while (true) {
    const startedAt = Date.now();
    await sendFrame(config);
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, config.intervalMs - (Date.now() - startedAt))));
  }
}

main().catch(() => {
  console.error(`${timestamp()} ERROR unexpected bridge failure; retrying next interval`);
  setTimeout(() => main().catch(() => {}), DEFAULT_INTERVAL_SECONDS * 1_000);
});
