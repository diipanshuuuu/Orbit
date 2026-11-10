import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

const instant = (name: string) => timestamp(name, { withTimezone: true });
export const zones = pgTable("zones", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: text("type", { enum: ["crowd", "machines"] }).notNull(),
  layoutHint: text("layout_hint").notNull().default(""),
  lowMax: integer("low_max").notNull().default(5),
  highMin: integer("high_min").notNull().default(15),
  typicalCycleMin: integer("typical_cycle_min").notNull().default(45),
  isDemo: boolean("is_demo").notNull().default(false),
  checkedAt: instant("checked_at"),
});
export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone").notNull().references(() => zones.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
}, (t) => [uniqueIndex("units_zone_label").on(t.zoneId, t.label)]);
export const cameras = pgTable("cameras", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone").notNull().references(() => zones.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  lastSeenAt: instant("last_seen_at"),
  lastAnalysedAt: instant("last_analysed_at"),
  lastAttemptedAt: instant("last_attempted_at"),
  allowance: doublePrecision("allowance").notNull(),
  allowanceAt: instant("allowance_at").notNull().defaultNow(),
  // Sole retained frame, overwritten in-place, never returned by public queries.
  latestFrame: text("latest_frame"),
});
export const readings = pgTable("readings", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone").notNull().references(() => zones.id, { onDelete: "cascade" }),
  capturedAt: instant("captured_at").notNull().defaultNow(),
  raw: jsonb("raw_model_json").notNull(),
  peopleCount: integer("people_count"),
});
export const zoneStatuses = pgTable("zone_status", {
  zoneId: integer("zone").primaryKey().references(() => zones.id, { onDelete: "cascade" }),
  state: text("state", { enum: ["low", "medium", "high", "unknown"] }).notNull().default("unknown"),
  pendingState: text("pending_state"),
  since: instant("since").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
  peopleCount: integer("people_count"),
});
export const unitStatuses = pgTable("unit_status", {
  unitId: integer("unit").primaryKey().references(() => units.id, { onDelete: "cascade" }),
  state: text("state", { enum: ["free", "in_use", "unknown"] }).notNull().default("unknown"),
  pendingState: text("pending_state", { enum: ["free"] }),
  since: instant("since").notNull().defaultNow(),
  updatedAt: instant("updated_at").notNull().defaultNow(),
  timerMinutes: doublePrecision("timer_minutes"),
  confidence: doublePrecision("confidence").notNull().default(0),
});
export const insertZoneSchema = createInsertSchema(zones).omit({ id: true });
export const insertUnitSchema = createInsertSchema(units).omit({ id: true });
export const insertCameraSchema = createInsertSchema(cameras).omit({ id: true });
export const insertReadingSchema = createInsertSchema(readings).omit({ id: true });
export type ZoneRow = typeof zones.$inferSelect;
export type CameraRow = typeof cameras.$inferSelect;
export type UnitStatusRow = typeof unitStatuses.$inferSelect;
