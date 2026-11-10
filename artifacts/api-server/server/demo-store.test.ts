import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZoneRow } from "@workspace/db";
import { demoCrowdTimeline } from "./demo-timelines";

const mock = vi.hoisted(() => ({ select: vi.fn(), transaction: vi.fn(), analyzeFrame: vi.fn() }));
vi.mock("@workspace/db", async (importOriginal) => ({
  ...await importOriginal<typeof import("@workspace/db")>(),
  db: { select: mock.select, transaction: mock.transaction },
}));
vi.mock("./vision", () => ({ analyzeFrame: mock.analyzeFrame }));
import { ingest, publicZone } from "./store";
import { createCamera, saveAdminZone } from "./admin-store";
import { saveFeedback } from "./feedback-store";

function query(rows: unknown[]) {
  const result = Object.assign(Promise.resolve(rows), {
    from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), for: vi.fn(),
  });
  for (const method of [result.from, result.where, result.orderBy, result.for]) method.mockReturnValue(result);
  return result;
}
const zone: ZoneRow = {
  id: 5, slug: "demo-mess", name: "Demo mess", type: "crowd", isDemo: true,
  demoTimeline: demoCrowdTimeline, layoutHint: "", lowMax: 5, highMin: 15, typicalCycleMin: 45,
  checkedAt: null, activeStart: null, activeEnd: null, forceRecheck: true,
};

beforeEach(() => vi.resetAllMocks());
describe("demo camera and AI isolation", () => {
  it("projects public demo data without reading cameras, readings, or stored statuses", async () => {
    const select = vi.fn().mockReturnValue(query([]));
    const status = await publicZone({ select } as never, zone, new Date("2026-11-11T06:30:00Z"));
    expect(status).toMatchObject({ slug: "demo-mess", is_demo: true, state: "high", people_count: 22, last_seen_at: null });
    expect(select).toHaveBeenCalledTimes(1); // unit labels only
    expect(mock.analyzeFrame).not.toHaveBeenCalled();
  });
  it("rejects a legacy demo camera token before frame writes, allowance charges, counters, or AI", async () => {
    mock.select.mockReturnValue(query([{ id: 8, zoneId: zone.id }]));
    const tx = { select: vi.fn().mockReturnValue(query([zone])), update: vi.fn(), insert: vi.fn() };
    mock.transaction.mockImplementation((run) => run(tx));
    expect(await ingest({ token: "not-a-real-camera-token", image: "test-jpeg", changed: true })).toBeNull();
    expect(tx.select).toHaveBeenCalledTimes(1); // zone guard, never camera/frame processing
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
    expect(mock.analyzeFrame).not.toHaveBeenCalled();
  });
  it("refuses to create cameras for a demo", async () => {
    const tx = { select: vi.fn().mockReturnValue(query([{ id: zone.id, isDemo: true }])), insert: vi.fn() };
    mock.transaction.mockImplementation((run) => run(tx));
    expect(await createCamera(zone.id)).toBe("demo-zone");
    expect(tx.insert).not.toHaveBeenCalled();
  });
  it("protects the stored demo presets from incompatible admin edits", async () => {
    const tx = { select: vi.fn().mockReturnValue(query([{ id: zone.id, isDemo: true }])), update: vi.fn(), insert: vi.fn() };
    mock.transaction.mockImplementation((run) => run(tx));
    expect(await saveAdminZone({
      name: "Changed", type: "machines", units: ["W4"], layout_hint: "",
      low_max: 5, high_min: 15, typical_cycle_min: 45, active_start: null, active_end: null,
    }, zone.id)).toBe("demo-zone");
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });
  it("saves negative demo feedback without requesting a camera recheck", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 10 }]);
    const values = vi.fn().mockReturnValue({ returning });
    const tx = { select: vi.fn().mockReturnValue(query([{ id: zone.id, isDemo: true }])), insert: vi.fn().mockReturnValue({ values }), update: vi.fn() };
    mock.transaction.mockImplementation((run) => run(tx));
    expect(await saveFeedback({
      zone_slug: zone.slug, unit_label: null, vote: "down", status_shown: "high",
      device_id: "550e8400-e29b-41d4-a716-446655440000",
    })).toEqual({ id: 10 });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ zoneId: zone.id, vote: "down" }));
    expect(tx.update).not.toHaveBeenCalled();
    expect(mock.analyzeFrame).not.toHaveBeenCalled();
  });
});
