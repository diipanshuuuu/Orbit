import { z } from "zod";
import { VISION_MODEL } from "./config";
import { logger } from "../src/lib/logger";

export interface VisionZone { name: string; layoutHint: string; units: { label: string }[] }
const unitSchema = z.object({
  label: z.string().max(100),
  state: z.enum(["free", "in_use", "unknown"]),
  timer_minutes: z.number().finite().nonnegative().nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().refine((s) => s.trim().split(/\s+/).filter(Boolean).length <= 12),
});
const responseSchema = z.object({
  scene_ok: z.boolean(),
  people_count: z.number().int().nonnegative(),
  units: z.array(unitSchema),
});
export type VisionResult = {
  ok: boolean; scene_ok: boolean; people_count: number | null;
  units: z.infer<typeof unitSchema>[];
  raw?: z.infer<typeof responseSchema>;
};
function unknownUnit(label: string): z.infer<typeof unitSchema> {
  return { label, state: "unknown", timer_minutes: null, confidence: 0, evidence: "Unable to judge" };
}
export function visionPrompt(zone: VisionZone): string {
  return `You are the sensor for a shared-facility status board. You receive one still frame from a fixed camera.
Zone: ${zone.name}. Layout: ${zone.layoutHint}
Units to report: ${zone.units.map((u) => u.label).join(", ") || "none"}
Return JSON only:
- scene_ok: false if the view is blocked, too dark to judge, or the camera has clearly moved.
- people_count: people visible, including partly visible ones.
- units: one entry per listed unit with state ("free" | "in_use" | "unknown"), timer_minutes (the number on its display if you can read it clearly, otherwise null), confidence (0 to 1), evidence (up to 12 words on what you saw).
Rules: report only what is visible. If a unit is hidden or unclear, answer "unknown" rather than guessing; a wrong "free" is the worst mistake. Do not describe or identify any person.`;
}
export async function analyzeFrame(
  image: string,
  zone: VisionZone,
  mimeType = "image/jpeg",
): Promise<VisionResult> {
  try {
    const { ai, ThinkingLevel } = await import("@workspace/integrations-gemini-ai");
    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [{ role: "user", parts: [
        { text: visionPrompt(zone) },
        { inlineData: { mimeType, data: image } },
      ] }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object", required: ["scene_ok", "people_count", "units"],
          properties: {
            scene_ok: { type: "boolean" },
            people_count: { type: "integer", minimum: 0 },
            units: { type: "array", items: {
              type: "object", required: ["label", "state", "timer_minutes", "confidence", "evidence"],
              properties: {
                label: { type: "string" },
                state: { type: "string", enum: ["free", "in_use", "unknown"] },
                timer_minutes: { type: ["number", "null"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                evidence: { type: "string" },
              },
            } },
          },
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 8192,
        // One SDK attempt per allowance token. Failure consumes the reserved token.
        httpOptions: { timeout: 25_000, retryOptions: { attempts: 1 } },
      },
    });
    const raw = responseSchema.parse(JSON.parse(response.text ?? ""));
    return {
      ok: true, scene_ok: raw.scene_ok, people_count: raw.scene_ok ? raw.people_count : null,
      units: zone.units.map(({ label }) => {
        const matches = raw.units.filter((u) => u.label === label);
        return raw.scene_ok && matches.length === 1 ? matches[0]! : unknownUnit(label);
      }),
      raw,
    };
  } catch (error: unknown) {
    // Log only allowlisted metadata, never the error object, message, body or frame.
    const metadata = error !== null && typeof error === "object"
      ? error as { name?: unknown; status?: unknown; statusCode?: unknown }
      : {};
    const errorName = typeof metadata.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(metadata.name)
      ? metadata.name : "UnknownError";
    const status = metadata.status ?? metadata.statusCode;
    const statusCode = typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
      ? status : null;
    logger.warn({ errorName, statusCode }, "Vision analysis failed; keeping status unconfirmed");
    return { ok: false, scene_ok: false, people_count: null, units: zone.units.map((u) => unknownUnit(u.label)) };
  }
}
