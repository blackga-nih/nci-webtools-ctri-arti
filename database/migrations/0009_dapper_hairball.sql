ALTER TABLE "Trace" ADD COLUMN "environment" text;--> statement-breakpoint
CREATE INDEX "Trace_environment_idx" ON "Trace" USING btree ("environment");