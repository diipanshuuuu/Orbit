import { describe, expect, it } from "vitest";
import { meanAbsDiff } from "./capture";
import { uploadDue, type UploadSchedule } from "./upload-schedule";

describe("grayscale comparison", () => {
  it("identical thumbs have zero difference", () => { expect(meanAbsDiff(new Uint8Array([0, 120]), new Uint8Array([0, 120]))).toBe(0); });
  it("normalizes the mean absolute difference", () => { expect(meanAbsDiff(new Uint8Array([0, 0]), new Uint8Array([255, 0]))).toBe(0.5); });
});
describe("upload scheduling", () => {
  const base: UploadSchedule = { now: 100_000, everSent: true, differs: false, lastSentAt: 80_000, lastChangedSentAt: 80_000, recheckAt: null, retryAt: 0, failures: 0 };
  it("sends the first frame immediately", () => { expect(uploadDue({ ...base, everSent: false })).toBe(true); });
  it("waits for an actual reason", () => { expect(uploadDue(base)).toBeNull(); });
  it("throttles changed frames for 60 seconds", () => { expect(uploadDue({ ...base, differs: true })).toBeNull(); });
  it("sends changed after exactly 60 seconds", () => { expect(uploadDue({ ...base, differs: true, lastChangedSentAt: 40_000 })).toBe(true); });
  it("sends an unchanged heartbeat after 120 seconds", () => { expect(uploadDue({ ...base, lastSentAt: -20_000 })).toBe(false); });
  it("honors a recheck at 10 seconds without marking changed too soon", () => { expect(uploadDue({ ...base, differs: true, recheckAt: 100_000 })).toBe(false); });
  it("does not send an early recheck", () => { expect(uploadDue({ ...base, recheckAt: 105_000 })).toBeNull(); });
  it("backs off retries", () => { expect(uploadDue({ ...base, differs: true, retryAt: 110_000, failures: 1 })).toBeNull(); });
  it("retries when due even before heartbeat, preserving changed throttle", () => { expect(uploadDue({ ...base, differs: true, retryAt: 100_000, failures: 1 })).toBe(false); });
});
