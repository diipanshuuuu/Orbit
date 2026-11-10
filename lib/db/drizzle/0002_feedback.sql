CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone" integer NOT NULL,
	"unit" integer,
	"vote" text NOT NULL,
	"status_shown" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "force_recheck" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_zone_zones_id_fk" FOREIGN KEY ("zone") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_unit_units_id_fk" FOREIGN KEY ("unit") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_zone_created_at" ON "feedback" USING btree ("zone","created_at");