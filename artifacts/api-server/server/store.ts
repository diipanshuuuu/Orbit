import { db, zones, cameras, units, unitStatuses, zoneStatuses, readings, cameraDaily } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import type { ZoneRow } from "@workspace/db";
import { crowdLevel, demoStatus, freshness, refillAllowance, remainingTime, shouldAnalyse, transitionUnit } from "./status";
import { MAX_AI_CALLS_PER_DAY } from "./config";
import { analyzeFrame } from "./vision";
import type { IngestInput } from "@workspace/api-zod";
import { utcCounterDay } from "./admin-validation";

type Store = Pick<typeof db, "select">;
const iso = (date: Date | null | undefined) => date?.toISOString() ?? null;

export async function publicZone(store: Store, zone: ZoneRow, now: Date) {
  if (zone.isDemo) {
    const labels = await store.select({ label: units.label }).from(units)
      .where(eq(units.zoneId, zone.id)).orderBy(units.id);
    return {
      slug: zone.slug, name: zone.name, type: zone.type,
      ...demoStatus(zone, zone.demoTimeline, labels.map((unit) => unit.label), now),
    };
  }
  // Explicitly project public columns. Tokens, frames, raw readings never leave here.
  const seen = await store.select({ lastSeenAt: cameras.lastSeenAt }).from(cameras)
    .where(eq(cameras.zoneId, zone.id)).orderBy(desc(cameras.lastSeenAt));
  const lastSeenAt = seen.reduce<Date | null>((latest, c) =>
    c.lastSeenAt && (!latest || c.lastSeenAt > latest) ? c.lastSeenAt : latest, null);
  const [status] = await store.select().from(zoneStatuses).where(eq(zoneStatuses.zoneId, zone.id));
  const unitRows = await store.select({ unit: units, status: unitStatuses }).from(units)
    .leftJoin(unitStatuses, eq(unitStatuses.unitId, units.id)).where(eq(units.zoneId, zone.id));
  const health = freshness(lastSeenAt, zone.checkedAt, now, zone.forceRecheck);
  return {
    slug: zone.slug, name: zone.name, type: zone.type, is_demo: false,
    state: health === "live" ? status?.state ?? "unknown" : health,
    people_count: health === "live" ? status?.peopleCount ?? null : null,
    checked_at: iso(zone.checkedAt), last_seen_at: iso(lastSeenAt),
    units: unitRows.map(({ unit, status: current }) => {
      const live = health === "live" && current;
      return {
        label: unit.label, state: live ? current.state : "unknown" as const,
        pending_state: live ? current.pendingState : null,
        since: live ? iso(current.since) : null, updated_at: live ? iso(current.updatedAt) : null,
        ...(live ? remainingTime(current, zone.typicalCycleMin, now) : { minutes_left: null, time_source: null }),
      };
    }),
  };
}
export async function getPublicZones() {
  // A snapshot keeps a response internally consistent while an ingest commits.
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(zones).orderBy(zones.id);
    return Promise.all(rows.map((zone) => publicZone(tx, zone, new Date())));
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function ingest(input: IngestInput) {
  // Check membership before locking. Re-check inside transaction for safe token revocation.
  const [known] = await db.select({ id: cameras.id, zoneId: cameras.zoneId }).from(cameras).where(eq(cameras.token, input.token));
  if (!known) return null;
  return db.transaction(async (tx) => {
    // Zone lock serializes different cameras for the same zone, across Autoscale instances.
    // Held until analysis and status changes commit, never a process-local mutex or queue.
    const [zone] = await tx.select().from(zones).where(eq(zones.id, known.zoneId)).for("update");
    if (!zone || zone.isDemo) return null;
    const [camera] = await tx.select().from(cameras).where(eq(cameras.token, input.token)).for("update");
    if (!camera) return null;
    const now = new Date();
    const allowance = refillAllowance(camera.allowance, camera.allowanceAt, now, MAX_AI_CALLS_PER_DAY);
    const zoneUnits = await tx.select().from(units).where(eq(units.zoneId, zone.id));
    const statusRows = await tx.select({ status: unitStatuses }).from(unitStatuses)
      .innerJoin(units, eq(unitStatuses.unitId, units.id)).where(eq(units.zoneId, zone.id));
    const pending = zone.forceRecheck || zone.checkedAt === null || statusRows.some(({ status }) => status.pendingState !== null);
    const analyse = shouldAnalyse({
      changed: input.changed, pending, allowance, now,
      lastAnalysedAt: camera.lastAnalysedAt, lastAttemptedAt: camera.lastAttemptedAt,
    });
    await tx.update(cameras).set({
      lastSeenAt: now, latestFrame: input.image,
      allowance: analyse ? allowance - 1 : allowance, allowanceAt: now,
      ...(analyse ? { lastAttemptedAt: now } : {}),
    }).where(eq(cameras.id, camera.id));
    if (!input.changed) {
      await tx.update(zones).set({ checkedAt: now }).where(eq(zones.id, zone.id));
      zone.checkedAt = now;
    }
    let analysed = false;
    let lastAnalysedAt = camera.lastAnalysedAt;
    if (analyse) {
      const result = await analyzeFrame(input.image, { ...zone, units: zoneUnits });
      if (result.ok) {
        analysed = true;
        lastAnalysedAt = now;
        await tx.insert(readings).values({
          zoneId: zone.id, capturedAt: now, raw: result.raw ?? result, peopleCount: result.people_count,
        });
        const state = crowdLevel(result.people_count, zone.lowMax, zone.highMin);
        const [old] = await tx.select().from(zoneStatuses).where(eq(zoneStatuses.zoneId, zone.id));
        await tx.insert(zoneStatuses).values({
          zoneId: zone.id, state, peopleCount: result.people_count, since: now, updatedAt: now,
        }).onConflictDoUpdate({ target: zoneStatuses.zoneId, set: {
          state, peopleCount: result.people_count, pendingState: null,
          since: old?.state === state ? old.since : now, updatedAt: now,
        } });
        for (const unit of zoneUnits) {
          const prev = statusRows.find(({ status }) => status.unitId === unit.id)?.status ?? {
            state: "unknown" as const, pendingState: null, since: now, updatedAt: now, timerMinutes: null, confidence: 0,
          };
          const reading = result.units.find((u) => u.label === unit.label) ?? { state: "unknown" as const, timer_minutes: null, confidence: 0 };
          const next = transitionUnit(prev, reading, now);
          await tx.insert(unitStatuses).values({ unitId: unit.id, ...next })
            .onConflictDoUpdate({ target: unitStatuses.unitId, set: next });
        }
        await tx.update(cameras).set({ lastAnalysedAt: now }).where(eq(cameras.id, camera.id));
        await tx.update(zones).set({ checkedAt: now, forceRecheck: false }).where(eq(zones.id, zone.id));
        zone.checkedAt = now;
        zone.forceRecheck = false;
      }
    }
    await tx.insert(cameraDaily).values({
      cameraId: camera.id, day: utcCounterDay(now), framesReceived: 1, analysed: analysed ? 1 : 0,
    }).onConflictDoUpdate({ target: [cameraDaily.cameraId, cameraDaily.day], set: {
      framesReceived: sql`${cameraDaily.framesReceived} + 1`,
      analysed: sql`${cameraDaily.analysed} + ${analysed ? 1 : 0}`,
    } });
    const status = await publicZone(tx, zone, new Date());
    // Freshness masking in publicZone must not suppress a pending-unit recheck.
    const pendingRows = await tx.select({ pendingState: unitStatuses.pendingState }).from(unitStatuses)
      .innerJoin(units, eq(unitStatuses.unitId, units.id)).where(eq(units.zoneId, zone.id));
    return {
      analysed, status,
      recheck: zone.forceRecheck || pendingRows.some((u) => u.pendingState !== null),
      last_analysed_at: iso(lastAnalysedAt),
    };
  });
}
