import { afterEach, describe, expect, it, vi } from "vitest";
import { validAdminPasscode, requireAdmin } from "./admin-auth";
import { adminZoneInput, utcCounterDay } from "./admin-validation";
import type { Request, Response, NextFunction } from "express";

afterEach(() => vi.unstubAllEnvs());
const valid = {
  name: " Laundry ", type: "machines", layout_hint: "Left wall",
  low_max: 5, high_min: 15, typical_cycle_min: 45,
  active_start: null, active_end: null, units: [" W1 ", "W2"],
};
describe("admin passcode boundary", () => {
  it("requires the configured bearer passcode", () => {
    expect(validAdminPasscode("Bearer test-only-passcode", "test-only-passcode")).toBe(true);
    for (const header of [undefined, "test-only-passcode", "Bearer wrong", "Bearer ", "Basic test-only-passcode"]) {
      expect(validAdminPasscode(header, "test-only-passcode")).toBe(false);
    }
    expect(validAdminPasscode("Bearer test-only-passcode", undefined)).toBe(false);
    expect(validAdminPasscode("Bearer test-only-passcode", "")).toBe(false);
    expect(validAdminPasscode("Bearer short", "a".repeat(1000))).toBe(false);
  });
  it.each([
    [undefined, "Bearer test", 503, false],
    ["test", undefined, 401, false],
    ["test", "Bearer wrong", 401, false],
    ["test", "Bearer test", undefined, true],
  ])("fails closed and marks every response private", (secret, header, status, allowed) => {
    if (secret === undefined) vi.stubEnv("ADMIN_PASSCODE", undefined);
    else vi.stubEnv("ADMIN_PASSCODE", secret);
    const req = { get: () => header } as unknown as Request;
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    requireAdmin(req, res as unknown as Response, next as NextFunction);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
    expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (status) expect(res.status).toHaveBeenCalledWith(status);
  });
});
describe("admin zone validation", () => {
  it("trims names and unit labels", () => {
    expect(adminZoneInput.parse(valid)).toMatchObject({ name: "Laundry", units: ["W1", "W2"] });
  });
  it("accepts overnight active hours", () => {
    expect(adminZoneInput.safeParse({ ...valid, active_start: "22:00", active_end: "06:00" }).success).toBe(true);
  });
  it.each([
    { name: " " }, { name: "x".repeat(121) }, { type: "other" },
    { low_max: -1 }, { low_max: 15 }, { high_min: 5 },
    { typical_cycle_min: 0 }, { typical_cycle_min: 1.5 },
    { active_start: "09:00" }, { active_end: "17:00" },
    { active_start: "25:00", active_end: "17:00" },
    { active_start: "09:00", active_end: "09:00" },
    { units: ["W1", " W1 "] }, { units: [" "] },
    { units: Array.from({ length: 101 }, (_, n) => String(n)) },
  ])("rejects invalid configuration", (change) => {
    expect(adminZoneInput.safeParse({ ...valid, ...change }).success).toBe(false);
  });
  it("uses an explicit UTC day across midnight", () => {
    expect(utcCounterDay(new Date("2026-11-11T00:00:00Z"))).toBe("2026-11-11");
    expect(utcCounterDay(new Date("2026-11-10T23:59:59Z"))).toBe("2026-11-10");
  });
});
