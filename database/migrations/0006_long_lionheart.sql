CREATE TABLE IF NOT EXISTS "Package" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"estimatedValue" integer,
	"requirementDescription" text,
	"acquisitionMethod" text,
	"contractType" text,
	"pathway" text,
	"requiredDocuments" json DEFAULT '[]'::json,
	"status" text DEFAULT 'intake',
	"flags" json DEFAULT '{}'::json,
	"conversationId" integer,
	"createdAt" timestamp with time zone DEFAULT now(),
	"updatedAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PackageDocument" (
	"id" text PRIMARY KEY NOT NULL,
	"packageId" text NOT NULL,
	"docType" text NOT NULL,
	"version" integer DEFAULT 1,
	"s3Key" text,
	"contentHash" text,
	"status" text DEFAULT 'draft',
	"title" text,
	"fileType" text DEFAULT 'md',
	"createdAt" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "PackageDocument" ADD CONSTRAINT "PackageDocument_packageId_Package_id_fk" FOREIGN KEY ("packageId") REFERENCES "public"."Package"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Package_conversationId_idx" ON "Package" USING btree ("conversationId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Package_status_idx" ON "Package" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PackageDocument_packageId_idx" ON "PackageDocument" USING btree ("packageId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PackageDocument_docType_idx" ON "PackageDocument" USING btree ("packageId","docType");
