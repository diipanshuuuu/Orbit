import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, events, feedback } from "@workspace/db";
import type { z } from "zod";
import { usageEventInput } from "./usage-validation";
import { completeDailyCounts } from "./usage-metrics";

type UsageEvent = z.infer<typeof usageEventInput>;

export async function saveUsageEvent(input: UsageEvent): Promise<{ id: number }> {
  const [saved] = await db.insert(events).values({
    deviceId: input.device_id,
    eventType: input.event_type,
    path: input.path,
    source: input.source,
    action: input.action,
  }).returning({ id: events.id });
  if (!saved) throw new Error("Usage event save failed");
  return saved;
}

export async function getAdminTraction(now = new Date()) {
  const rangeStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
  const rangeStart = rangeStartDate.toISOString().slice(0, 10);
  const rangeEnd = now.toISOString().slice(0, 10);
  return db.transaction(async (tx) => {
    const dayExpression = sql<string>`to_char(date_trunc('day', ${events.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;
    const dailyRows = await tx.select({
      day: dayExpression,
      views: sql<number>`count(*) filter (where ${events.eventType} = 'page_view')::int`,
      unique_devices: sql<number>`count(distinct ${events.deviceId}) filter (where ${events.eventType} = 'page_view')::int`,
    }).from(events).where(and(gte(events.createdAt, rangeStartDate), lte(events.createdAt, now)))
      .groupBy(dayExpression).orderBy(dayExpression);
    const sources = await tx.select({
      source: events.source,
      views: sql<number>`count(*)::int`,
    }).from(events).where(eq(events.eventType, "page_view"))
      .groupBy(events.source).orderBy(desc(sql`count(*)`));
    const [viewTotal] = await tx.select({
      count: sql<number>`count(*)::int`,
    }).from(events).where(eq(events.eventType, "page_view"));
    const [feedbackTotal] = await tx.select({
      count: sql<number>`count(*)::int`,
      positive: sql<number>`count(*) filter (where ${feedback.vote} = 'up')::int`,
    }).from(feedback);

    return {
      range_start: rangeStart,
      range_end: rangeEnd,
      total_views: viewTotal?.count ?? 0,
      feedback_count: feedbackTotal?.count ?? 0,
      thumbs_up_rate: feedbackTotal?.count ? feedbackTotal.positive / feedbackTotal.count : null,
      daily: completeDailyCounts(rangeStart, dailyRows, 30),
      sources,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
