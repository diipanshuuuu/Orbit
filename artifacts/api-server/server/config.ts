function positiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 4) throw new Error("MAX_AI_CALLS_PER_DAY must be at least 4.");
  return n;
}
export const MAX_AI_CALLS_PER_DAY = positiveNumber(process.env.MAX_AI_CALLS_PER_DAY, 200);
export const VISION_MODEL = process.env.VISION_MODEL || "gemini-3.8-flash";
