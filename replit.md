# Orbit

Orbit is a mobile-first web app that shows hostel residents the live status of shared facilities ("zones"), such as a mess, study room or laundry. A camera (for now a phone or laptop browser tab, later CCTV) sends still frames, a vision model turns each frame into JSON, and residents check the status before they walk.

## Rules for Agent (follow on every request)
- One service: React + Vite + TypeScript + Tailwind UI, Express + TypeScript API, Replit PostgreSQL via Drizzle.
- Runs on Autoscale: stateless server, all state in Postgres, no background loops, no WebSockets.
- All model calls go through server/vision.ts analyzeFrame(). All status rules live in server/status.ts as pure, unit-tested functions.
- Never store frames except the single latest one per camera for the admin preview. Residents never see images.
- Mobile-first. No login for residents. Admin behind ADMIN_PASSCODE.
- Do only what the request asks. Do not refactor, restyle or add features that were not requested.
- Finish each request by running the unit tests and listing what changed.
- Keep this file. Add short notes below it, but never delete or rewrite these rules or the spec.

## First build: build only this slice

1. **Tables:** zones (slug, name, type "crowd" or "machines", layout_hint, low_max, high_min, typical_cycle_min, is_demo, checked_at), units (zone, label), cameras (zone, secret token, last_seen_at, last_analysed_at, allowance, allowance_at, latest_frame), readings (zone, captured_at, raw model JSON, people_count), and public status per zone and unit (state, pending_state, since, updated_at).

2. **Camera page /cam/:token.** Open the rear camera with getUserMedia. Keep the screen on with the Wake Lock API and ask for the lock again whenever the page becomes visible. Every 5 s compare a 64x36 grayscale thumbnail with the thumbnail of the last frame the server analysed. Send a JPEG (max 1024 px wide, quality 0.7) to POST /api/ingest in three cases: (a) the difference passes a threshold and no changed frame was sent in the last 60 s: send changed: true; (b) otherwise, when nothing was sent for 120 s: send changed: false as a heartbeat; (c) the server asked for a recheck: send the next frame 10 s later. Show counters (checked, uploaded, analysed) and the last server reply. Retry with backoff when offline, and restart the camera if its video track ends. The camera page can also use a video file instead of the live camera: let the user choose a file, play it muted on a loop, and treat its frames exactly like camera frames.

3. **POST /api/ingest.** Check the camera token and update last_seen_at. A pure, unit-tested function decides whether to analyse the frame: yes if changed is true, any unit in the zone has a pending_state, or the last analysis is more than 10 minutes old; but never within 10 s of the last analysis, and only if the camera's allowance is at least 1. The allowance refills evenly at MAX_AI_CALLS_PER_DAY (default 400) per 24 hours, holds at most a quarter of that, starts full, and each model call takes 1 from it. When analysing, call analyzeFrame; if it succeeds, save a reading and update the public status. Set the zone's checked_at to now after a successful analysis and whenever a frame arrives with changed: false. Reply with analysed (true only after a successful analysis), the status, and recheck: true while any unit has a pending_state. Never write frames to disk.

4. **server/vision.ts** exports analyzeFrame(image, zone) returning { ok, scene_ok, people_count, units: [{ label, state, timer_minutes, confidence, evidence }] }. Use Gemini through Replit AI Integrations, model from env VISION_MODEL (default a current Gemini Flash-Lite model), JSON output, lowest thinking level. Validate with zod. On any error return ok: false with "unknown" states; never crash the request. Use this prompt, filling in the zone fields:

   ```
   You are the sensor for a shared-facility status board. You receive one still frame from a fixed camera.
   Zone: {name}. Layout: {layout_hint}
   Units to report: {unit labels, or "none"}
   Return JSON only:
   - scene_ok: false if the view is blocked, too dark to judge, or the camera has clearly moved.
   - people_count: people visible, including partly visible ones.
   - units: one entry per listed unit with state ("free" | "in_use" | "unknown"), timer_minutes (the number on its display if you can read it clearly, otherwise null), confidence (0 to 1), evidence (up to 12 words on what you saw).
   Rules: report only what is visible. If a unit is hidden or unclear, answer "unknown" rather than guessing; a wrong "free" is the worst mistake. Do not describe or identify any person.
   ```

5. **server/status.ts:** pure functions with Vitest tests. A unit becomes "in_use" after one reading. A "free" reading first sets pending_state, and the unit becomes "free" only if the next reading agrees; any other reading clears pending_state. Crowd level comes from people_count and the zone thresholds. A zone is "offline" when its camera has not been seen for 5 minutes, and "re-checking" when the camera is seen but checked_at is more than 5 minutes old. Minutes left = typical_cycle_min minus minutes since the unit became in_use; use timer_minutes instead when confidence is 0.8 or higher.

6. **Resident pages:** / lists zones as cards (large status pill, key number, and "checked 20 s ago" from checked_at); /z/:slug shows detail. Poll GET /api/zones every 15 s while the tab is visible. An offline zone says "Camera offline, last seen 12 min ago" and a re-checking zone says "Re-checking"; neither shows old data as live.

**Not now:** login, alerts, admin UI, charts, video streaming. On first start with an empty database, create one sample crowd zone named "Common room" and one camera, and print the full camera URL in the logs.

## Later requests (do not build until asked, one at a time)

**2. Admin page.** /admin behind ADMIN_PASSCODE (from Secrets; ask once per browser, remember it in localStorage). Create and edit zones (name, type, layout_hint, low_max, high_min, typical_cycle_min, active hours) and their units. Create a camera for a zone and show its /cam/ link as a QR code and a copy button. Show the camera's latest frame, last_seen_at, the last 20 readings with their raw JSON, and today's counters (frames received, analysed, allowance left).
Done when: a new zone and camera can be set up on the deployed app in two minutes, from a phone.

**3. Feedback.** On every zone page, an "Is this right?" row with thumbs-up and thumbs-down. Save each tap to a feedback table (zone, unit if any, vote, the status shown, time, anonymous device id). A thumbs-down sets the zone to "re-checking" and makes the next frame from its camera be analysed even if nothing changed. Admin shows the feedback list and the agreement rate (thumbs-up share) per zone.
Done when: a thumbs-down on a phone appears in admin and triggers a fresh reading.

**4. Usage log.** Create an anonymous device id in localStorage on first visit. Log page views, the ?src= value from QR links, and button taps to an events table. Admin "Traction" tab: unique devices per day, total views, views per src, feedback count, thumbs-up rate, and a CSV download.
Done when: the numbers move when a second phone opens the app.

**5. Machines view.** On a "machines" zone page, a grid of tiles, one per unit (W1, W2, ...), each showing free / in use / unknown and minutes left, labelled "estimated" or "read from display". Unknown units are grey, never shown as free.
Done when: starting a machine flips its tile within two minutes.

**6. Eval.** `npm run eval` runs analyzeFrame over every image in eval/ using eval/labels.json ({ file, zone, people_count, units: { label: state } }). Print accuracy for people_count (within ±1), crowd level, and each unit state, plus the count of "said free, was busy". Accept a model name argument. Save the results to eval/report.md.
Done when: it prints one accuracy line per model.

**7. Demo zone.** Zones with is_demo = true never use a camera or AI. Their status comes from a stored 24-hour timeline worked out from the current time (busy at meal times, quiet at night; for machines, cycles that start and end). Show a "Demo data" badge on the card and the zone page. Seed one demo crowd zone and one demo machines zone.
Done when: the demo zones change through the day with no camera and no AI calls.

**8. Visual pass.** Polish only the home, zone and machines screens: large readable status pills (green free/low, amber medium, red busy/high, grey offline/unknown), big tap targets, readable at arm's length on a small phone. Add a short "How it works" page (camera → AI → status, what we store, what we never store), a web app manifest, icons and a theme colour so "Add to Home Screen" looks like an app.
Done when: a teammate can read the status from arm's length on a small phone.

**9. Notify me when free.** On a zone or unit, a "Notify me when free" button. First: while the page is open, play a chime and vibrate when that unit turns free or the crowd drops to low. Then: Web Push with a service worker and VAPID keys from Secrets; the ingest handler sends the push when the status changes. On iPhone, show a hint that alerts need Add to Home Screen.
Done when: an alert reaches a locked Android phone.

**10. CCTV bridge.** scripts/rtsp-bridge.sh: a loop that uses ffmpeg to grab one frame from RTSP_URL every 60 s and posts it to /api/ingest with CAMERA_TOKEN. When a frame arrives without a changed value, the server makes the same 64x36 thumbnail comparison itself to decide whether it changed. Add a README section on running it.
Done when: it runs on a laptop against a test stream (an IP-camera app on a spare phone).

## Approved First build overrides
- Use gemini-3.8-flash for now and keep it configurable through VISION_MODEL.
- Set MAX_AI_CALLS_PER_DAY to 200 by default.
