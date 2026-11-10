import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

const saveFeedback = vi.hoisted(() => vi.fn());
vi.mock("./feedback-store", () => ({ saveFeedback }));
import feedbackRouter from "../src/routes/feedback";

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", feedbackRouter);
  await new Promise<void>((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server not listening");
  url = `http://127.0.0.1:${address.port}/api/feedback`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => saveFeedback.mockReset());
afterEach(() => vi.unstubAllEnvs());

const feedbackInput = {
  zone_slug: "common-room",
  unit_label: null,
  vote: "down",
  status_shown: "low",
  device_id: "550e8400-e29b-41d4-a716-446655440000",
};

describe("resident feedback route", () => {
  it("saves anonymous zone feedback and returns its ID", async () => {
    saveFeedback.mockResolvedValue({ id: 23 });
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(feedbackInput),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ id: 23 });
    expect(saveFeedback).toHaveBeenCalledWith(feedbackInput);
  });
  it("rejects invalid votes and malformed device IDs before storage", async () => {
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...feedbackInput, vote: "maybe", device_id: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    expect(saveFeedback).not.toHaveBeenCalled();
  });
  it("returns 404 for an unknown zone", async () => {
    saveFeedback.mockResolvedValue(null);
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(feedbackInput),
    });
    expect(response.status).toBe(404);
  });
  it("rejects a unit that does not belong to the selected zone", async () => {
    saveFeedback.mockResolvedValue("unit-not-found");
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...feedbackInput, unit_label: "W1" }),
    });
    expect(response.status).toBe(400);
  });
});
