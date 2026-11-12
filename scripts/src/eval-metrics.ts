export type ZoneType = "crowd" | "machines";
export type UnitState = "free" | "in_use" | "unknown";

export interface EvalExpectation {
  file: string;
  zone_type: ZoneType;
  people_count?: number;
  view_blocked?: boolean;
  units?: Record<string, UnitState>;
}

export interface EvalObservation {
  expected: EvalExpectation;
  predicted: {
    people_count: number | null;
    view_blocked: boolean | null;
    units: Record<string, UnitState>;
  };
  analysis_ok: boolean;
}

export interface Accuracy {
  correct: number;
  total: number;
  percent: number | null;
}

export interface EvalMetrics {
  peopleCountExact: Accuracy;
  peopleCountWithinOne: Accuracy;
  crowdLevel: Accuracy;
  blockedView: Accuracy;
  machineUnitState: Accuracy;
  machineUnitStateByLabel: Record<string, Accuracy>;
  saidFreeWasBusy: number;
  analysisFailures: number;
}

export function crowdLevel(peopleCount: number | null, lowMax = 1, highMin = 4): string | null {
  if (peopleCount === null) return null;
  if (peopleCount <= lowMax) return "low";
  if (peopleCount >= highMin) return "high";
  return "medium";
}

export function getImageMimeType(file: string): "image/jpeg" | "image/png" {
  return file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

export function resolveEvalModel(args: string[], configuredModel: string): { model: string; override: boolean } {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  if (normalizedArgs.length > 1) throw new Error("Usage: npm run eval [-- model-name]");
  const requested = normalizedArgs[0]?.trim();
  if (requested && /[\r\n]/.test(requested)) throw new Error("Model name must be a single line.");
  return { model: requested || configuredModel, override: Boolean(requested) };
}

function accuracy(correct: number, total: number): Accuracy {
  return { correct, total, percent: total === 0 ? null : Math.round((correct / total) * 1000) / 10 };
}

export function calculateMetrics(observations: EvalObservation[]): EvalMetrics {
  let exactCount = 0;
  let withinOneCount = 0;
  let crowdLevelCount = 0;
  let blockedViewCount = 0;
  let falseFreeCount = 0;
  let failureCount = 0;
  let peopleTotal = 0;
  let blockedTotal = 0;
  let crowdTotal = 0;
  let unitTotal = 0;
  let unitCorrect = 0;
  const unitsByLabel = new Map<string, { correct: number; total: number }>();

  for (const observation of observations) {
    const { expected, predicted } = observation;
    if (!observation.analysis_ok) failureCount += 1;

    if (expected.people_count !== undefined) {
      peopleTotal += 1;
      if (predicted.people_count === expected.people_count) exactCount += 1;
      if (predicted.people_count !== null && Math.abs(predicted.people_count - expected.people_count) <= 1) {
        withinOneCount += 1;
      }
      crowdTotal += 1;
      if (
        crowdLevel(expected.people_count, 1, 4) === crowdLevel(predicted.people_count, 1, 4)
      ) crowdLevelCount += 1;
    }

    if (expected.view_blocked !== undefined) {
      blockedTotal += 1;
      if (predicted.view_blocked === expected.view_blocked) blockedViewCount += 1;
    }

    if (expected.zone_type === "machines" && expected.units) {
      for (const [label, expectedState] of Object.entries(expected.units)) {
        const predictedState = predicted.units[label] ?? "unknown";
        unitTotal += 1;
        if (predictedState === expectedState) {
          unitCorrect += 1;
          const entry = unitsByLabel.get(label) ?? { correct: 0, total: 0 };
          entry.correct += 1;
          unitsByLabel.set(label, entry);
        } else {
          const entry = unitsByLabel.get(label) ?? { correct: 0, total: 0 };
          unitsByLabel.set(label, entry);
        }
        unitsByLabel.get(label)!.total += 1;
        if (expectedState === "in_use" && predictedState === "free") falseFreeCount += 1;
      }
    }
  }

  return {
    peopleCountExact: accuracy(exactCount, peopleTotal),
    peopleCountWithinOne: accuracy(withinOneCount, peopleTotal),
    crowdLevel: accuracy(crowdLevelCount, crowdTotal),
    blockedView: accuracy(blockedViewCount, blockedTotal),
    machineUnitState: accuracy(unitCorrect, unitTotal),
    machineUnitStateByLabel: Object.fromEntries(
      [...unitsByLabel.entries()].sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => [label, accuracy(value.correct, value.total)]),
    ),
    saidFreeWasBusy: falseFreeCount,
    analysisFailures: failureCount,
  };
}

export function formatAccuracy(value: Accuracy): string {
  return value.percent === null
    ? "N/A (0/0)"
    : `${value.percent.toFixed(1)}% (${value.correct}/${value.total})`;
}

function display(value: number | boolean | string | null | undefined): string {
  if (value === undefined) return "not labeled";
  if (value === null) return "unknown";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

export function buildReport(model: string, observations: EvalObservation[]): string {
  const metrics = calculateMetrics(observations);
  const lines = [
    "# Orbit vision evaluation",
    "",
    `- Model: \`${model}\``,
    `- Photos evaluated: ${observations.length}`,
    `- Analysis failures: ${metrics.analysisFailures}`,
    "",
    "## Accuracy",
    "",
    `- People count exact: ${formatAccuracy(metrics.peopleCountExact)}`,
    `- People count within ±1: ${formatAccuracy(metrics.peopleCountWithinOne)}`,
    `- Crowd level (low ≤1, medium 2–3, high ≥4): ${formatAccuracy(metrics.crowdLevel)}`,
    `- Blocked-view detection: ${formatAccuracy(metrics.blockedView)}`,
    `- Machine unit state: ${formatAccuracy(metrics.machineUnitState)}`,
    `- Said free, was busy (false-free count): ${metrics.saidFreeWasBusy}`,
  ];

  const unitLabels = Object.entries(metrics.machineUnitStateByLabel);
  if (unitLabels.length > 0) {
    lines.push("", "## Machine accuracy by unit label", "");
    for (const [label, value] of unitLabels) lines.push(`- ${label}: ${formatAccuracy(value)}`);
  }

  lines.push("", "## Per-photo results", "");
  if (observations.length === 0) {
    lines.push("No labeled evaluation photos were found, so no model calls were made.");
  } else {
    for (const observation of observations) {
      const { expected, predicted } = observation;
      const expectedUnits = Object.entries(expected.units ?? {}).map(([label, state]) => `${label}=${state}`);
      const predictedUnits = Object.entries(expected.units ?? {}).map(
        ([label]) => `${label}=${predicted.units[label] ?? "unknown"}`,
      );
      const expectedPeople = display(expected.people_count);
      const predictedPeople = display(predicted.people_count);
      const expectedBlocked = display(expected.view_blocked);
      const predictedBlocked = display(predicted.view_blocked);
      lines.push(
        `### ${expected.file}`,
        "",
        `- Type: ${expected.zone_type}`,
        `- People count: expected ${expectedPeople}; predicted ${predictedPeople}`,
        `- Crowd level: expected ${display(expected.people_count === undefined ? undefined : crowdLevel(expected.people_count))}; predicted ${display(crowdLevel(predicted.people_count))}`,
        `- View blocked: expected ${expectedBlocked}; predicted ${predictedBlocked}`,
        `- Units: expected ${expectedUnits.join(", ") || "not labeled"}; predicted ${predictedUnits.join(", ") || "not applicable"}`,
        `- Analysis: ${observation.analysis_ok ? "success" : "failed; prediction counted as unknown"}`,
        "",
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
