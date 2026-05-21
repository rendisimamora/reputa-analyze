-- ──────────────────────────────────────────────────────────────────────────
-- Migration 2/2: add scan queue columns + reset default + housekeeping.
--
-- Safe to run only AFTER 20260521000000_scan_queue, which committed the
-- 'QUEUED' enum variant.
-- ──────────────────────────────────────────────────────────────────────────

-- Columns
ALTER TABLE "ScanRun" ADD COLUMN "claimedAt"    TIMESTAMP(3);
ALTER TABLE "ScanRun" ADD COLUMN "progressJson" JSONB;

-- Default for new rows is now QUEUED
ALTER TABLE "ScanRun" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- Index for the worker poll loop
CREATE INDEX "ScanRun_status_claimedAt_idx" ON "ScanRun"("status", "claimedAt");

-- Housekeeping: any stuck RUNNING rows from the old architecture that have no
-- finishedAt → mark FAILED so the UI doesn't show phantom "Scanning..." spinners.
UPDATE "ScanRun"
SET    "status" = 'FAILED',
       "finishedAt" = NOW(),
       "message" = COALESCE("message", '') || ' [auto-failed by scan_queue_columns migration]'
WHERE  "status" = 'RUNNING' AND "finishedAt" IS NULL;
