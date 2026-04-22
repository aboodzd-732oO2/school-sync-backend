-- CreateTable
CREATE TABLE "RequestStatusLog" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "fromStatus" "RequestStatus",
    "toStatus" "RequestStatus" NOT NULL,
    "userId" INTEGER,
    "userEmail" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RequestStatusLog_requestId_createdAt_idx" ON "RequestStatusLog"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "RequestStatusLog" ADD CONSTRAINT "RequestStatusLog_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "Request"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: seed one initial log for every existing request (creation event)
INSERT INTO "RequestStatusLog" ("requestId", "fromStatus", "toStatus", "userEmail", "userType", "createdAt")
SELECT r."id", NULL, r."status"::"RequestStatus", 'system', 'system', r."dateSubmitted"
FROM "Request" r;
