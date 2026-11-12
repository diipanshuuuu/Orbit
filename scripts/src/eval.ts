import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildReport,
  getImageMimeType,
  resolveEvalModel,
  type EvalExpectation,
  type EvalObservation,
  type UnitState,
} from "./eval-metrics";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "../..");
const evalDir = path.join(workspaceRoot, "eval");
const imageExtensions = new Set([".jpg", ".jpeg", ".png"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseLabels(value: unknown): EvalExpectation[] {
  if (!Array.isArray(value)) throw new Error("labels.json must contain an array.");
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Label ${index + 1} must be an object.`);
    const { file, zone_type: zoneType, people_count: peopleCount, view_blocked: viewBlocked, units: rawUnits } = item;
    if (typeof file !== "string" || !file.trim()) throw new Error(`Label ${index + 1} requires a file path.`);
    if (zoneType !== "crowd" && zoneType !== "machines") {
      throw new Error(`Label ${index + 1} zone_type must be "crowd" or "machines".`);
    }
    if (peopleCount !== undefined && (
      typeof peopleCount !== "number" || !Number.isInteger(peopleCount) || peopleCount < 0
    )) {
      throw new Error(`Label ${index + 1} people_count must be a nonnegative integer.`);
    }
    if (viewBlocked !== undefined && typeof viewBlocked !== "boolean") {
      throw new Error(`Label ${index + 1} view_blocked must be true or false.`);
    }

    let units: Record<string, UnitState> | undefined;
    if (rawUnits !== undefined) {
      if (!isRecord(rawUnits)) throw new Error(`Label ${index + 1} units must be an object.`);
      units = {};
      for (const [label, state] of Object.entries(rawUnits)) {
        if (state !== "free" && state !== "in_use" && state !== "unknown") {
          throw new Error(`Label ${index + 1} has an invalid state for unit ${label}.`);
        }
        units[label] = state;
      }
    }
    if (zoneType === "crowd" && peopleCount === undefined) {
      throw new Error(`Crowd label ${index + 1} requires people_count.`);
    }
    if (zoneType === "machines" && (!units || Object.keys(units).length === 0)) {
      throw new Error(`Machine label ${index + 1} requires at least one unit state.`);
    }

    return {
      file: file.trim(),
      zone_type: zoneType,
      ...(peopleCount === undefined ? {} : { people_count: peopleCount }),
      ...(viewBlocked === undefined ? {} : { view_blocked: viewBlocked }),
      ...(units === undefined ? {} : { units }),
    };
  });
}

async function findImages(directory: string, base = directory): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findImages(fullPath, base));
    } else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(path.relative(base, fullPath).split(path.sep).join("/"));
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function assertSafeRelativeImagePath(file: string): void {
  const normalized = path.normalize(file);
  const resolved = path.resolve(evalDir, normalized);
  if (
    path.isAbsolute(file)
    || normalized === ".."
    || normalized.startsWith(`..${path.sep}`)
    || !resolved.startsWith(`${evalDir}${path.sep}`)
    || !imageExtensions.has(path.extname(file).toLowerCase())
  ) {
    throw new Error(`Invalid evaluation image path in labels.json: ${file}`);
  }
}

async function main() {
  const { model, override } = resolveEvalModel(
    process.argv.slice(2),
    process.env.VISION_MODEL || "gemini-3.8-flash",
  );
  if (override) process.env.VISION_MODEL = model;

  const labelsPath = path.join(evalDir, "labels.json");
  const labelsText = await fs.readFile(labelsPath, "utf8");
  const labels = parseLabels(JSON.parse(labelsText) as unknown);
  const imageFiles = await findImages(evalDir);
  const labelsByFile = new Map<string, EvalExpectation>();

  for (const label of labels) {
    assertSafeRelativeImagePath(label.file);
    if (labelsByFile.has(label.file)) throw new Error(`Duplicate label for ${label.file}.`);
    labelsByFile.set(label.file, label);
  }
  const unlabelled = imageFiles.filter((file) => !labelsByFile.has(file));
  const missingImages = [...labelsByFile.keys()].filter((file) => !imageFiles.includes(file));
  if (unlabelled.length || missingImages.length) {
    const details = [
      unlabelled.length ? `Images missing labels: ${unlabelled.join(", ")}` : "",
      missingImages.length ? `Labels missing image files: ${missingImages.join(", ")}` : "",
    ].filter(Boolean).join("\n");
    throw new Error(details);
  }

  const analyzerPath = path.join(workspaceRoot, "artifacts/api-server/server/vision.ts");
  const { analyzeFrame } = await import(pathToFileURL(analyzerPath).href);
  const observations: EvalObservation[] = [];

  for (const file of imageFiles) {
    const expected = labelsByFile.get(file)!;
    const bytes = await fs.readFile(path.join(evalDir, file));
    const zone = {
      name: expected.zone_type === "crowd" ? "Evaluation crowd scene" : "Evaluation machine scene",
      layoutHint: "No additional layout details supplied; report only what is visible.",
      units: Object.keys(expected.units ?? {}).map((label) => ({ label })),
    };
    const result = await analyzeFrame(bytes.toString("base64"), zone, getImageMimeType(file));
    const predictedUnits: Record<string, UnitState> = {};
    for (const unit of result.units) predictedUnits[unit.label] = unit.state;
    const observation: EvalObservation = {
      expected,
      predicted: {
        people_count: result.ok ? result.people_count : null,
        view_blocked: result.ok ? !result.scene_ok : null,
        units: predictedUnits,
      },
      analysis_ok: result.ok,
    };
    observations.push(observation);

    const countExpected = expected.people_count === undefined ? "not labeled" : String(expected.people_count);
    const countPredicted = observation.predicted.people_count === null ? "unknown" : String(observation.predicted.people_count);
    const expectedUnits = Object.entries(expected.units ?? {}).map(([label, state]) => `${label}=${state}`).join(", ") || "not labeled";
    const predictedUnitsText = Object.entries(expected.units ?? {}).map(
      ([label]) => `${label}=${predictedUnits[label] ?? "unknown"}`,
    ).join(", ") || "not applicable";
    console.log(
      `${file} | expected count=${countExpected}, blocked=${expected.view_blocked ?? "not labeled"}, units=${expectedUnits}`
      + ` | predicted count=${countPredicted}, blocked=${observation.predicted.view_blocked ?? "unknown"}, units=${predictedUnitsText}`,
    );
  }

  const report = buildReport(model, observations);
  const reportPath = path.join(evalDir, "report.md");
  await fs.writeFile(reportPath, report, "utf8");
  console.log(`\nModel: ${model}`);
  console.log(report.split("## Accuracy")[1]?.split("## Per-photo results")[0]?.trim() ?? "No accuracy metrics.");
  if (observations.length === 0) console.log("No labeled evaluation photos were found; no model calls were made.");
  console.log(`Saved results to ${path.relative(workspaceRoot, reportPath)}.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown evaluation error.";
  console.error(`Evaluation stopped: ${message}`);
  process.exitCode = 1;
});
