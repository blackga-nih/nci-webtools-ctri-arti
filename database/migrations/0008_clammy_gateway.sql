CREATE TABLE "RequestLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"userID" integer,
	"method" text,
	"path" text,
	"statusCode" integer,
	"durationMs" integer,
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "Trace" (
	"id" serial PRIMARY KEY NOT NULL,
	"traceId" text,
	"userID" integer,
	"conversationID" text,
	"durationMs" integer,
	"inputTokens" integer,
	"outputTokens" integer,
	"cost" double precision,
	"status" text,
	"toolsCalled" json,
	"spans" json,
	"traceJson" json,
	"createdAt" timestamp with time zone DEFAULT now(),
	CONSTRAINT "Trace_traceId_unique" UNIQUE("traceId")
);
--> statement-breakpoint
CREATE INDEX "RequestLog_path_idx" ON "RequestLog" USING btree ("path");--> statement-breakpoint
CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Trace_userID_idx" ON "Trace" USING btree ("userID");--> statement-breakpoint
CREATE INDEX "Trace_conversationID_idx" ON "Trace" USING btree ("conversationID");--> statement-breakpoint
CREATE INDEX "Trace_createdAt_idx" ON "Trace" USING btree ("createdAt");