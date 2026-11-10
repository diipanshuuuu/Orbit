import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const saveUsageEvent = vi.hoisted(() => vi.fn());
vi.mock("./usage-store", () => ({ saveUsageEvent }));
import usageRouter from "../src/routes/usage";

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", usageRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server not listening");
  url = `http://127.0.0.1:${address.port}/api/events`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => saveUsageEvent.mockReset());
afterEach(() => vi.unstubAllEnvs());

const deviceId = "550e8400-e29b-41d4-a716-446655440000";
describe("anonymous usage events", () => {
  it("accepts a page view and a source attribution", async () => {
    saveUsageEvent.mockResolvedValue({ id: 14 });
    const input = { device_id: deviceId, event_type: "page_view", path: "/", source: "lobby-qr", action: null };
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ id: 14 });
    expect(saveUsageEvent).toHaveBeenCalledWith(input);
  });
  it("accepts button taps with a public route and action label", async () => {
    saveUsageEvent.mockResolvedValue({ id: 15 });
    const input = { device_id: deviceId, event_type: "button_tap", path: "/z/common-room", source: null, action: "Retry" };
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
    expect(response.status).toBe(201);
    expect(saveUsageEvent).toHaveBeenCalledWith(input);
  });
  it("rejects invalid paths, IDs, and missing button labels", async () => {
    for (const input of [
      { device_id: "bad", event_type: "page_view", path: "/", source: null, action: null },
      { device_id: deviceId, event_type: "page_view", path: "/cam/private-token", source: null, action: null },
      { device_id: deviceId, event_type: "button_tap", path: "/", source: null, action: null },
    ]) {
      expect((await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      })).status).toBe(400);
    }
    expect(saveUsageEvent).not.toHaveBeenCalled();
  });
});
