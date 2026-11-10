import { and, desc, eq } from "drizzle-orm";
import { db, feedback, units, zones } from "@workspace/db";
import type { z } from "zod";
import { SubmitFeedbackBody } from "@workspace/api-zod";

type FeedbackInput = z.infer<typeof SubmitFeedbackBody>;

export async function saveFeedback(input: FeedbackInput): Promise<{ id: number } | null | "unit-not-found"> {
  return db.transaction(async (tx) => {
    const [zone] = await tx.select({ id: zones.id }).from(zones)
      .where(eq(zones.slug, input.zone_slug)).for("update");
    if (!zone) return null;

    let unitId: number | null = null;
    if (input.unit_label !== null) {
      const [unit] = await tx.select({ id: units.id }).from(units)
        .where(and(eq(units.zoneId, zone.id), eq(units.label, input.unit_label)));
      if (!unit) return "unit-not-found";
      unitId = unit.id;
    }

    const [saved] = await tx.insert(feedback).values({
      zoneId: zone.id,
      unitId,
      vote: input.vote,
      statusShown: input.status_shown,
      deviceId: input.device_id,
    }).returning({ id: feedback.id });

    if (input.vote === "down") {
      await tx.update(zones).set({ forceRecheck: true }).where(eq(zones.id, zone.id));
    }
    if (!saved) throw new Error("Feedback save failed");
    return saved;
  });
}
