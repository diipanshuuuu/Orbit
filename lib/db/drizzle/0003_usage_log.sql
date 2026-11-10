CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"event_type" text NOT NULL,
	"path" text NOT NULL,
	"source" text,
	"action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_type_created_at" ON "events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "events_source" ON "events" USING btree ("source");--> statement-breakpoint
CREATE INDEX "events_device_created_at" ON "events" USING btree ("device_id","created_at");