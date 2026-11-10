import { beforeEach, describe, expect, it, vi } from "vitest";
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@workspace/integrations-gemini-ai", () => ({
  ai: { models: { generateContent } }, ThinkingLevel: { LOW: "LOW" },
}));
vi.mock("../src/lib/logger", () => ({ logger: { warn: vi.fn() } }));
import { analyzeFrame, visionPrompt } from "./vision";
import { logger } from "../src/lib/logger";

const zone = { name: "Laundry", layoutHint: "W1 on the left", units: [{ label: "W1" }] };
const unit = { label: "W1", state: "in_use", timer_minutes: 24, confidence: 0.9, evidence: "Display shows twenty four minutes" };
function respond(value: unknown) { generateContent.mockResolvedValue({ text: JSON.stringify(value) }); }
beforeEach(() => { generateContent.mockReset(); vi.mocked(logger.warn).mockClear(); });
describe("vision sensor boundary", () => {
  it("uses the supplied prompt and zone fields", () => {
    expect(visionPrompt(zone)).toContain("Zone: Laundry. Layout: W1 on the left");
    expect(visionPrompt(zone)).toContain('a wrong "free" is the worst mistake');
    expect(visionPrompt({ ...zone, units: [] })).toContain("Units to report: none");
  });
  it("validates a good response", async () => {
    respond({ scene_ok: true, people_count: 2, units: [unit] });
    const result = await analyzeFrame("test", zone);
    expect(result.ok).toBe(true);
    expect(result.units[0]?.state).toBe("in_use");
    expect(generateContent).toHaveBeenCalledOnce();
    const request = generateContent.mock.calls[0]![0];
    expect(request.model).toBe(process.env.VISION_MODEL || "gemini-3.8-flash");
    expect(request.config.thinkingConfig.thinkingLevel).toBe("LOW");
    expect(request.config.httpOptions.retryOptions.attempts).toBe(1);
  });
  it("makes blocked scenes unknown even when model says free", async () => {
    respond({ scene_ok: false, people_count: 0, units: [{ ...unit, state: "free" }] });
    const result = await analyzeFrame("test", zone);
    expect(result.ok).toBe(true);
    expect(result.people_count).toBeNull();
    expect(result.units[0]?.state).toBe("unknown");
  });
  it.each([
    { scene_ok: true, people_count: -1, units: [unit] },
    { scene_ok: true, people_count: 2, units: [{ ...unit, confidence: 1.5 }] },
    { scene_ok: true, people_count: 2, units: [{ ...unit, state: "available" }] },
    { scene_ok: true, people_count: 2, units: [{ ...unit, evidence: "one two three four five six seven eight nine ten eleven twelve thirteen" }] },
  ])("returns safe failure for invalid data", async (value) => {
    respond(value);
    const result = await analyzeFrame("test", zone);
    expect(result.ok).toBe(false);
    expect(result.units[0]?.state).toBe("unknown");
  });
  it("handles malformed JSON", async () => {
    generateContent.mockResolvedValue({ text: "not JSON" });
    expect((await analyzeFrame("test", zone)).ok).toBe(false);
  });
  it("handles provider errors", async () => {
    generateContent.mockRejectedValue(new Error("Unavailable"));
    expect((await analyzeFrame("test", zone)).units[0]?.state).toBe("unknown");
  });
  it("logs only the provider error name and HTTP status, never its message or body", async () => {
    const error = Object.assign(new Error("sensitive image and response"), {
      name: "ApiError", status: 400, body: "sensitive body", image: "private frame",
    });
    generateContent.mockRejectedValue(error);
    expect((await analyzeFrame("private frame", zone)).ok).toBe(false);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      { errorName: "ApiError", statusCode: 400 },
      "Vision analysis failed; keeping status unconfirmed",
    );
  });
  it("logs local validation errors without the invalid model output", async () => {
    generateContent.mockResolvedValue({ text: "private malformed output" });
    await analyzeFrame("private frame", zone);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      { errorName: "SyntaxError", statusCode: null },
      "Vision analysis failed; keeping status unconfirmed",
    );
  });
  it.each([
    [Object.assign(new Error("private"), { name: "TimeoutError", statusCode: 504 }), "TimeoutError", 504],
    [{ name: "private frame with spaces", status: "private body" }, "UnknownError", null],
    [null, "UnknownError", null],
    ["private error body", "UnknownError", null],
  ])("safely logs alternate and non-error failures", async (error, errorName, statusCode) => {
    generateContent.mockRejectedValue(error);
    expect((await analyzeFrame("private frame", zone)).ok).toBe(false);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      { errorName, statusCode },
      "Vision analysis failed; keeping status unconfirmed",
    );
  });
  it("makes absent labels unknown", async () => {
    respond({ scene_ok: true, people_count: 0, units: [{ ...unit, label: "W2", state: "free" }] });
    expect((await analyzeFrame("test", zone)).units[0]?.state).toBe("unknown");
  });
  it("makes ambiguous duplicate labels unknown", async () => {
    respond({ scene_ok: true, people_count: 0, units: [unit, { ...unit, state: "free" }] });
    expect((await analyzeFrame("test", zone)).units[0]?.state).toBe("unknown");
  });
});
