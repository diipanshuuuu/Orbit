import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const store = vi.hoisted(() => ({
  adminDashboard: vi.fn(), saveAdminZone: vi.fn(), createCamera: vi.fn(), latestAdminFrame: vi.fn(),
}));
vi.mock("./admin-store", () => store);
import adminRouter from "../src/routes/admin";

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", adminRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server not listening");
  url = `http://127.0.0.1:${address.port}/api`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => {
  vi.stubEnv("ADMIN_PASSCODE", "unit-test-passcode");
  Object.values(store).forEach((mock) => mock.mockReset());
});
afterEach(() => vi.unstubAllEnvs());
const headers = { Authorization: "Bearer unit-test-passcode", "Content-Type": "application/json" };
const input = {
  name: "Laundry", type: "machines", layout_hint: "Left wall", low_max: 5, high_min: 15,
  typical_cycle_min: 45, active_start: null, active_end: null, units: ["W1"],
};

describe("all private admin routes", () => {
  it.each([
    ["GET", "/admin"], ["POST", "/admin/zones"], ["PUT", "/admin/zones/1"],
    ["POST", "/admin/zones/1/cameras"], ["GET", "/admin/cameras/1/frame"],
  ])("rejects unauthenticated %s %s before querying private data", async (method, path) => {
    const response = await fetch(url + path, { method });
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    Object.values(store).forEach((mock) => expect(mock).not.toHaveBeenCalled());
    expect(await response.text()).not.toContain("unit-test-passcode");
  });
  it("fails closed if the passcode is unconfigured", async () => {
    vi.stubEnv("ADMIN_PASSCODE", undefined);
    expect((await fetch(url + "/admin", { headers })).status).toBe(503);
    expect(store.adminDashboard).not.toHaveBeenCalled();
  });
  it("returns the current protected dashboard, including existing camera links", async () => {
    const data = { day: "2026-11-11", zones: [{
      ...input, id: 1, slug: "common-room", name: "Common room", type: "crowd", units: [],
      cameras: [{
        id: 1, path: "/cam/test-token-not-a-real-camera", last_seen_at: null,
        last_analysed_at: null, has_frame: true, frames_received: 10, analysed: 2, allowance_left: 49.5,
      }], readings: [{ id: 1, captured_at: "2026-11-11T00:00:00.000Z", raw: { scene_ok: true, people_count: 2, units: [] } }],
    }] };
    store.adminDashboard.mockResolvedValue(data);
    const response = await fetch(url + "/admin", { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(data);
  });
  it("creates and updates validated zones", async () => {
    store.saveAdminZone.mockResolvedValue({ id: 7 });
    const created = await fetch(url + "/admin/zones", { method: "POST", headers, body: JSON.stringify(input) });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: 7 });
    const updated = await fetch(url + "/admin/zones/7", { method: "PUT", headers, body: JSON.stringify({ ...input, units: ["W1", "W2"] }) });
    expect(updated.status).toBe(200);
    expect(store.saveAdminZone).toHaveBeenLastCalledWith({ ...input, units: ["W1", "W2"] }, 7);
  });
  it("rejects invalid edits and missing zones", async () => {
    const bad = await fetch(url + "/admin/zones/1", { method: "PUT", headers, body: JSON.stringify({ ...input, units: ["W1", "W1"] }) });
    expect(bad.status).toBe(400);
    expect(store.saveAdminZone).not.toHaveBeenCalled();
    store.saveAdminZone.mockResolvedValue(null);
    expect((await fetch(url + "/admin/zones/99", { method: "PUT", headers, body: JSON.stringify(input) })).status).toBe(404);
  });
  it("creates a camera only for an existing zone", async () => {
    store.createCamera.mockResolvedValueOnce({ id: 8 }).mockResolvedValueOnce(null);
    const created = await fetch(url + "/admin/zones/7/cameras", { method: "POST", headers });
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: 8 });
    expect((await fetch(url + "/admin/zones/99/cameras", { method: "POST", headers })).status).toBe(404);
    expect((await fetch(url + "/admin/zones/nope/cameras", { method: "POST", headers })).status).toBe(400);
  });
  it("serves only the single latest frame after authorization", async () => {
    store.latestAdminFrame.mockResolvedValueOnce({ image: "synthetic-frame" }).mockResolvedValueOnce({ image: null }).mockResolvedValueOnce(null);
    const frame = await fetch(url + "/admin/cameras/8/frame", { headers });
    expect(frame.headers.get("cache-control")).toBe("no-store");
    expect(await frame.json()).toEqual({ image: "synthetic-frame" });
    expect(await (await fetch(url + "/admin/cameras/8/frame", { headers })).json()).toEqual({ image: null });
    expect((await fetch(url + "/admin/cameras/99/frame", { headers })).status).toBe(404);
  });
});
