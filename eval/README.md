# Vision evaluation

Put evaluation photos in this directory and add one matching entry for every
`.jpg`, `.jpeg`, or `.png` file to `labels.json`. The runner also searches
subdirectories; use paths relative to this directory and forward slashes.

Run the configured model:

```sh
npm run eval
```

Override `VISION_MODEL` for one run:

```sh
npm run eval -- gemini-3.8-flash
```

Each entry must have a `file` and `zone_type`. Crowd photos require an integer
`people_count`; `view_blocked` is optional. Machine photos require a `units`
object mapping each unit label to `free`, `in_use`, or `unknown`.

Example `labels.json`:

```json
[
  {
    "file": "photo01.jpg",
    "zone_type": "crowd",
    "people_count": 3,
    "view_blocked": false
  },
  {
    "file": "machines/photo02.png",
    "zone_type": "machines",
    "view_blocked": false,
    "units": {
      "W1": "in_use",
      "W2": "free"
    }
  },
  {
    "file": "photo03.jpg",
    "zone_type": "crowd",
    "people_count": 0,
    "view_blocked": true
  }
]
```

The runner reads these images and labels, calls the same `analyzeFrame()` used
by the API, prints expected and predicted values, and writes aggregate and
per-photo results to `report.md`. It does not write to the database, the live
app, or the image files. Reports contain expected labels and predictions;
model evidence and image data are not printed or saved.
