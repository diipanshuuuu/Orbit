import { randomBytes } from "node:crypto";
import { db, zones, units, cameras, zoneStatuses } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { MAX_AI_CALLS_PER_DAY } from "./config";
import { logger } from "../src/lib/logger";
import { demoCrowdTimeline, demoMachinesTimeline } from "./demo-timelines";

// Request-driven initialization also gives us the actual browser-facing origin,
// rather than guessing a published domain. The advisory lock makes this race-safe.
export async function seedIfEmpty(origin: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(18742061)`);
    const existing = await tx.select({ id: zones.id }).from(zones).limit(1);
    if (!existing.length) {
      const [zone] = await tx.insert(zones).values({
        slug: "common-room", name: "Common room", type: "crowd",
        layoutHint: "A shared hostel common room. Count all visible people.",
        lowMax: 5, highMin: 15, typicalCycleMin: 45, isDemo: false,
      }).returning();
      if (!zone) throw new Error("Could not initialize Common room");
      const token = randomBytes(32).toString("hex");
      await tx.insert(cameras).values({ zoneId: zone.id, token, allowance: MAX_AI_CALLS_PER_DAY / 4 });
      await tx.insert(zoneStatuses).values({ zoneId: zone.id, state: "unknown" });
      // Intentional, one-time secret-link log explicitly required by the specification.
      logger.info({ cameraUrl: `${origin}/cam/${token}` }, "Common room camera created. Keep this URL private.");
    }
    // Seed demos even in an existing installation; never overwrite live zones.
    for (const demo of [
      { slug: "demo-mess", name: "Demo mess", type: "crowd" as const, timeline: demoCrowdTimeline },
      { slug: "demo-laundry", name: "Demo laundry", type: "machines" as const, timeline: demoMachinesTimeline },
    ]) {
      const [existingDemo] = await tx.select({ id: zones.id }).from(zones).where(eq(zones.slug, demo.slug));
      if (existingDemo) continue;
      const [created] = await tx.insert(zones).values({
        slug: demo.slug, name: demo.name, type: demo.type, isDemo: true, demoTimeline: demo.timeline,
        lowMax: 5, highMin: 15, typicalCycleMin: 45,
      }).onConflictDoNothing({ target: zones.slug }).returning({ id: zones.id });
      if (created && demo.type === "machines") {
        await tx.insert(units).values(demoMachinesTimeline.machines.map((unit) => ({ zoneId: created.id, label: unit.label })));
      }
    }
    // Existing demo flags also need a durable schedule; camera data is ignored.
    for (const type of ["crowd", "machines"] as const) {
      await tx.update(zones).set({
        demoTimeline: type === "crowd" ? demoCrowdTimeline : demoMachinesTimeline,
      }).where(sql`${zones.isDemo} = true and ${zones.demoTimeline} is null and ${eq(zones.type, type)}`);
    }
  });
}
