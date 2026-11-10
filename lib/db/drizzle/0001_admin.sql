CREATE TABLE "camera_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"camera" integer NOT NULL,
	"day" date NOT NULL,
	"frames_received" integer DEFAULT 0 NOT NULL,
	"analysed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "active_start" text;--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "active_end" text;--> statement-breakpoint
ALTER TABLE "camera_daily" ADD CONSTRAINT "camera_daily_camera_cameras_id_fk" FOREIGN KEY ("camera") REFERENCES "public"."cameras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "camera_daily_camera_day" ON "camera_daily" USING btree ("camera","day");