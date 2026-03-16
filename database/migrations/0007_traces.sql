-- Trace and RequestLog tables for admin dashboard
CREATE TABLE IF NOT EXISTS "Trace" (
  "id" SERIAL PRIMARY KEY,
  "traceId" TEXT UNIQUE,
  "userID" INTEGER,
  "conversationID" TEXT,
  "durationMs" INTEGER,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "cost" DOUBLE PRECISION,
  "status" TEXT,
  "toolsCalled" JSON,
  "spans" JSON,
  "traceJson" JSON,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "Trace_userID_idx" ON "Trace" ("userID");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Trace_conversationID_idx" ON "Trace" ("conversationID");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Trace_createdAt_idx" ON "Trace" ("createdAt");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "RequestLog" (
  "id" SERIAL PRIMARY KEY,
  "userID" INTEGER,
  "method" TEXT,
  "path" TEXT,
  "statusCode" INTEGER,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "RequestLog_path_idx" ON "RequestLog" ("path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "RequestLog_createdAt_idx" ON "RequestLog" ("createdAt");
