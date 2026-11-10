import { randomBytes } from "node:crypto";
import { db, zones, units, cameras, cameraDaily, readings, zoneStatuses, unitStatuses, feedback } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { adminZoneInput, utcCounterDay } from "./admin-validation";
import { MAX_AI_CALLS_PER_DAY } from "./config";
import { refillAllowance } from "./status";

const iso = (value: Date | null) => value?.toISOString() ?? null;
export async function adminDashboard() {
  const now = new Date();
  const day = utcCounterDay(now);
  return db.transaction(async (tx) => {
    const allZones = await tx.select().from(zones).orderBy(zones.id);
    return { day, zones: await Promise.all(allZones.map(async (zone) => {
      const labels = await tx.select({ label: units.label }).from(units).where(eq(units.zoneId, zone.id)).orderBy(units.id);
      const cameraRows = await tx.select({ camera: cameras, daily: cameraDaily }).from(cameras)
        .leftJoin(cameraDaily, and(eq(cameraDaily.cameraId, cameras.id), eq(cameraDaily.day, day)))
        .where(eq(cameras.zoneId, zone.id)).orderBy(cameras.id);
      const recent = await tx.select().from(readings).where(eq(readings.zoneId, zone.id))
        .orderBy(desc(readings.capturedAt), desc(readings.id)).limit(20);
      const [feedbackSummary] = await tx.select({
        count: sql<number>`count(*)::int`,
        upCount: sql<number>`count(*) filter (where ${feedback.vote} = 'up')::int`,
      }).from(feedback).where(eq(feedback.zoneId, zone.id));
      const recentFeedback = await tx.select({ entry: feedback, unitLabel: units.label }).from(feedback)
        .leftJoin(units, eq(units.id, feedback.unitId))
        .where(eq(feedback.zoneId, zone.id))
        .orderBy(desc(feedback.createdAt), desc(feedback.id)).limit(20);
      return {
        id: zone.id, slug: zone.slug, name: zone.name, type: zone.type, layout_hint: zone.layoutHint,
        low_max: zone.lowMax, high_min: zone.highMin, typical_cycle_min: zone.typicalCycleMin,
        active_start: zone.activeStart, active_end: zone.activeEnd, units: labels.map((row) => row.label),
        cameras: cameraRows.map(({ camera, daily }) => ({
          id: camera.id, path: `/cam/${camera.token}`, last_seen_at: iso(camera.lastSeenAt),
          last_analysed_at: iso(camera.lastAnalysedAt), has_frame: camera.latestFrame !== null,
          frames_received: daily?.framesReceived ?? 0, analysed: daily?.analysed ?? 0,
          allowance_left: refillAllowance(camera.allowance, camera.allowanceAt, now, MAX_AI_CALLS_PER_DAY),
        })),
        readings: recent.map((row) => ({ id: row.id, captured_at: row.capturedAt.toISOString(), raw: row.raw })),
        feedback_count: feedbackSummary?.count ?? 0,
        agreement_rate: feedbackSummary?.count ? feedbackSummary.upCount / feedbackSummary.count : null,
        feedback: recentFeedback.map(({ entry, unitLabel }) => ({
          id: entry.id, unit_label: unitLabel, vote: entry.vote, status_shown: entry.statusShown,
          created_at: entry.createdAt.toISOString(), device_id: entry.deviceId,
        })),
      };
    })) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function saveAdminZone(input: z.infer<typeof adminZoneInput>, id?: number) {
  return db.transaction(async (tx) => {
    if (id) {
      const [existing] = await tx.select({ id: zones.id }).from(zones).where(eq(zones.id, id)).for("update");
      if (!existing) return null;
    }
    const values = {
      name: input.name, type: input.type, layoutHint: input.layout_hint,
      lowMax: input.low_max, highMin: input.high_min, typicalCycleMin: input.typical_cycle_min,
      activeStart: input.active_start, activeEnd: input.active_end, checkedAt: null,
    };
    // Slugs remain stable on edit; random suffix avoids collisions for equal names.
    const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "zone"}-${randomBytes(4).toString("hex")}`;
    const [saved] = id
      ? await tx.update(zones).set(values).where(eq(zones.id, id)).returning()
      : await tx.insert(zones).values({ ...values, slug }).returning();
    if (!saved) throw new Error("Zone save failed");
    const oldUnits = await tx.select().from(units).where(eq(units.zoneId, saved.id));
    const removed = oldUnits.filter((unit) => !input.units.includes(unit.label));
    // Explicitly removed labels lose only their own current status through the FK.
    for (const unit of removed) await tx.delete(units).where(eq(units.id, unit.id));
    for (const label of input.units) {
      if (!oldUnits.some((unit) => unit.label === label)) {
        await tx.insert(units).values({ zoneId: saved.id, label });
      }
    }
    const kept = await tx.select({ id: units.id }).from(units).where(eq(units.zoneId, saved.id));
    for (const unit of kept) {
      await tx.insert(unitStatuses).values({ unitId: unit.id })
        .onConflictDoUpdate({ target: unitStatuses.unitId, set: { state: "unknown", pendingState: null, timerMinutes: null, confidence: 0, since: new Date(), updatedAt: new Date() } });
    }
    await tx.insert(zoneStatuses).values({ zoneId: saved.id })
      .onConflictDoUpdate({ target: zoneStatuses.zoneId, set: { state: "unknown", peopleCount: null, pendingState: null, updatedAt: new Date() } });
    return { id: saved.id };
  });
}

export async function createCamera(zoneId: number) {
  return db.transaction(async (tx) => {
    const [zone] = await tx.select({ id: zones.id }).from(zones).where(eq(zones.id, zoneId)).for("update");
    if (!zone) return null;
    const [camera] = await tx.insert(cameras).values({
      zoneId, token: randomBytes(32).toString("hex"), allowance: MAX_AI_CALLS_PER_DAY / 4,
    }).returning({ id: cameras.id });
    return camera!;
  });
}

export async function latestAdminFrame(id: number) {
  const [camera] = await db.select({ image: cameras.latestFrame }).from(cameras).where(eq(cameras.id, id));
  return camera ?? null;
}
