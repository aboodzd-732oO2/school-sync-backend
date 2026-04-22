-- Add institutionId column (nullable while we backfill)
ALTER TABLE "MonthlyReport" ADD COLUMN "institutionId" INTEGER;

-- Backfill from institutionName (best-effort; leaves NULL if name no longer matches)
UPDATE "MonthlyReport" mr
SET "institutionId" = i.id
FROM "Institution" i
WHERE mr."institutionName" = i.name;

-- Drop old unique index that used institutionName
DROP INDEX IF EXISTS "MonthlyReport_month_year_institutionName_key";

-- Add new unique index on (month, year, institutionId)
CREATE UNIQUE INDEX "MonthlyReport_month_year_institutionId_key"
  ON "MonthlyReport"("month", "year", "institutionId");

-- Index on institutionId for faster lookups
CREATE INDEX "MonthlyReport_institutionId_idx" ON "MonthlyReport"("institutionId");

-- Foreign key with cascade delete (orphan reports get removed if institution deleted)
ALTER TABLE "MonthlyReport"
  ADD CONSTRAINT "MonthlyReport_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
