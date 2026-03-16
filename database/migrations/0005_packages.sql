-- Acquisition package tracking tables
CREATE TABLE IF NOT EXISTS "Package" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "estimatedValue" INTEGER,
  "requirementDescription" TEXT,
  "acquisitionMethod" TEXT,
  "contractType" TEXT,
  "pathway" TEXT,
  "requiredDocuments" JSON DEFAULT '[]',
  "status" TEXT DEFAULT 'intake',
  "flags" JSON DEFAULT '{}',
  "conversationId" INTEGER,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "Package_conversationId_idx" ON "Package" ("conversationId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Package_status_idx" ON "Package" ("status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "PackageDocument" (
  "id" TEXT PRIMARY KEY,
  "packageId" TEXT NOT NULL REFERENCES "Package"("id") ON DELETE CASCADE,
  "docType" TEXT NOT NULL,
  "version" INTEGER DEFAULT 1,
  "s3Key" TEXT,
  "contentHash" TEXT,
  "status" TEXT DEFAULT 'draft',
  "title" TEXT,
  "fileType" TEXT DEFAULT 'md',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "PackageDocument_packageId_idx" ON "PackageDocument" ("packageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PackageDocument_docType_idx" ON "PackageDocument" ("packageId", "docType");
