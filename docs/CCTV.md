# CCTV bridge

The bridge runs on a laptop, captures one JPEG frame from an RTSP camera or an
HTTP MJPEG/snapshot URL with `ffmpeg`, and sends it to Orbit. It keeps the frame
in memory and does not write images to disk. Node.js 18 or newer is required.

## Install ffmpeg

**macOS** (with Homebrew):

```sh
brew install ffmpeg
```

**Windows** (with WinGet):

```powershell
winget install --id Gyan.FFmpeg.Shared --exact
```

Open a new terminal after installation and check that `ffmpeg -version` works.

## Run on a laptop

From the Orbit project directory, set:

- `ORBIT_URL`: the base URL of your published Orbit app, without `/api/ingest`.
- `CAMERA_TOKEN`: the camera token shown in Orbit admin for that camera.
- `RTSP_URL`: the camera stream URL. RTSP, HTTP MJPEG, and HTTP snapshot URLs are supported.
- `INTERVAL_SECONDS`: optional capture interval; defaults to `60`.

Exact macOS/Linux example:

```sh
ORBIT_URL="https://your-orbit-domain" \
CAMERA_TOKEN="your-camera-token" \
RTSP_URL="rtsp://username:password@192.168.1.50:554/stream1" \
INTERVAL_SECONDS=60 \
node scripts/cctv-bridge.mjs
```

PowerShell example:

```powershell
$env:ORBIT_URL = "https://your-orbit-domain"
$env:CAMERA_TOKEN = "your-camera-token"
$env:RTSP_URL = "rtsp://username:password@192.168.1.50:554/stream1"
$env:INTERVAL_SECONDS = "60"
node .\scripts\cctv-bridge.mjs
```

The script captures immediately, then repeats at the configured interval. Each
successful request prints the time, HTTP status, `analysed` value, and zone
state. Failed captures or requests print a short error and retry on the next
interval. It never prints the camera token, stream URL, or image.

## Test with Android IP Webcam

1. Install **IP Webcam** on an Android phone and connect the phone and laptop to
   the same private Wi-Fi network.
2. Start the IP Webcam server in the app and note the address and port it shows,
   for example `192.168.1.50:8080`.
3. Use the snapshot URL `http://192.168.1.50:8080/shot.jpg`, or the MJPEG stream
   URL `http://192.168.1.50:8080/video`, as `RTSP_URL`.
4. Set `ORBIT_URL` and the camera's `CAMERA_TOKEN` as shown above, then run the
   bridge. Confirm the terminal prints an HTTP status and zone state.

Do not expose the phone's camera port to the public internet. For another RTSP
camera, use its RTSP stream URL in `RTSP_URL` and keep the laptop and camera on
networks that can reach each other.
