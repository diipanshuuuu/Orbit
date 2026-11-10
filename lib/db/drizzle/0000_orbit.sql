CREATE TABLE "cameras" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone" integer NOT NULL,
	"token" text NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_analysed_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone,
	"allowance" double precision NOT NULL,
	"allowance_at" timestamp with time zone DEFAULT now() NOT NULL,
	"latest_frame" text,
	CONSTRAINT "cameras_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone" integer NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_model_json" jsonb NOT NULL,
	"people_count" integer
);
--> statement-breakpoint
CREATE TABLE "unit_status" (
	"unit" integer PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'unknown' NOT NULL,
	"pending_state" text,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timer_minutes" double precision,
	"confidence" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone" integer NOT NULL,
	"label" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_status" (
	"zone" integer PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'unknown' NOT NULL,
	"pending_state" text,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"people_count" integer
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"layout_hint" text DEFAULT '' NOT NULL,
	"low_max" integer DEFAULT 5 NOT NULL,
	"high_min" integer DEFAULT 15 NOT NULL,
	"typical_cycle_min" integer DEFAULT 45 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	CONSTRAINT "zones_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_zone_zones_id_fk" FOREIGN KEY ("zone") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_zone_zones_id_fk" FOREIGN KEY ("zone") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_status" ADD CONSTRAINT "unit_status_unit_units_id_fk" FOREIGN KEY ("unit") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_zone_zones_id_fk" FOREIGN KEY ("zone") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_status" ADD CONSTRAINT "zone_status_zone_zones_id_fk" FOREIGN KEY ("zone") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "units_zone_label" ON "units" USING btree ("zone","label");