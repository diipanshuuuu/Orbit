import { beforeEach, describe, expect, it, vi } from "vitest";
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@workspace/integrations-gemini-ai", () => ({
  ai: { models: { generateContent } }, ThinkingLevel: { MINIMAL: "minimal" },
}));
vi.mock("../src/lib/logger", () => ({ logger: { warn: vi.fn() } }));
import { analyzeFrame, visionPrompt } from "./vision";

const zone = { name: "Laundry", layoutHint: "W1 on the left", units: [{ label: "W1" }] };
const unit = { label: "W1", state: "in_use", timer_minutes: 24, confidence: 0.9, evidence: "Display shows twenty four minutes" };
function respond(value: unknown) { generateContent.mockResolvedValue({ text: JSON.stringify(value) }); }
beforeEach(() => { generateContent.mockReset(); });
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
    expect(request.config.thinkingConfig.thinkingLevel).toBe("minimal");
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
  it("makes absent labels unknown", async () => {
    respond({ scene_ok: true, people_count: 0, units: [{ ...unit, label: "W2", state: "free" }] });
    expect((await analyzeFrame("test", zone)).units[0]?.state).toBe("unknown");
  });
  it("makes ambiguous duplicate labels unknown", async () => {
    respond({ scene_ok: true, people_count: 0, units: [unit, { ...unit, state: "free" }] });
    expect((await analyzeFrame("test", zone)).units[0]?.state).toBe("unknown");
  });
});
