import { describe, expect, it } from "vitest";
import {
  buildReport,
  calculateMetrics,
  crowdLevel,
  formatAccuracy,
  getImageMimeType,
  resolveEvalModel,
  type EvalObservation,
} from "./eval-metrics";

describe("evaluation metrics", () => {
  it("uses the agreed crowd thresholds", () => {
    expect(crowdLevel(0)).toBe("low");
    expect(crowdLevel(1)).toBe("low");
    expect(crowdLevel(2)).toBe("medium");
    expect(crowdLevel(3)).toBe("medium");
    expect(crowdLevel(4)).toBe("high");
    expect(crowdLevel(null)).toBeNull();
  });

  it("calculates count, crowd, blocked-view, machine, and false-free totals", () => {
    const observations: EvalObservation[] = [
      {
        expected: { file: "crowd.jpg", zone_type: "crowd", people_count: 3, view_blocked: false },
        predicted: { people_count: 2, view_blocked: false, units: {} },
        analysis_ok: true,
      },
      {
        expected: { file: "blocked.png", zone_type: "crowd", people_count: 0, view_blocked: true },
        predicted: { people_count: null, view_blocked: true, units: {} },
        analysis_ok: true,
      },
      {
        expected: { file: "machines.jpeg", zone_type: "machines", units: { W1: "in_use", W2: "free" } },
        predicted: { people_count: 0, view_blocked: false, units: { W1: "free", W2: "free" } },
        analysis_ok: true,
      },
    ];
    const metrics = calculateMetrics(observations);
    expect(metrics.peopleCountExact).toEqual({ correct: 0, total: 2, percent: 0 });
    expect(metrics.peopleCountWithinOne).toEqual({ correct: 1, total: 2, percent: 50 });
    expect(metrics.crowdLevel).toEqual({ correct: 1, total: 2, percent: 50 });
    expect(metrics.blockedView).toEqual({ correct: 2, total: 2, percent: 100 });
    expect(metrics.machineUnitState).toEqual({ correct: 1, total: 2, percent: 50 });
    expect(metrics.machineUnitStateByLabel.W1).toEqual({ correct: 0, total: 1, percent: 0 });
    expect(metrics.machineUnitStateByLabel.W2).toEqual({ correct: 1, total: 1, percent: 100 });
    expect(metrics.saidFreeWasBusy).toBe(1);
    expect(metrics.analysisFailures).toBe(0);
  });

  it("counts failed model analysis as unknown and incorrect", () => {
    const metrics = calculateMetrics([{
      expected: { file: "photo.jpg", zone_type: "crowd", people_count: 4, view_blocked: false },
      predicted: { people_count: null, view_blocked: null, units: {} },
      analysis_ok: false,
    }]);
    expect(metrics.peopleCountExact.percent).toBe(0);
    expect(metrics.blockedView.percent).toBe(0);
    expect(metrics.analysisFailures).toBe(1);
  });

  it("formats missing metrics as N/A and reports an empty dataset clearly", () => {
    expect(formatAccuracy({ correct: 0, total: 0, percent: null })).toBe("N/A (0/0)");
    expect(buildReport("gemini-3.8-flash", [])).toContain("no model calls were made");
  });

  it("selects the right inline image MIME type", () => {
    expect(getImageMimeType("photo.JPG")).toBe("image/jpeg");
    expect(getImageMimeType("nested/photo.png")).toBe("image/png");
    expect(getImageMimeType("photo.jpeg")).toBe("image/jpeg");
  });

  it("uses VISION_MODEL by default and accepts an explicit model argument", () => {
    expect(resolveEvalModel([], "configured-model")).toEqual({ model: "configured-model", override: false });
    expect(resolveEvalModel(["--", "model-override"], "configured-model"))
      .toEqual({ model: "model-override", override: true });
  });
});
