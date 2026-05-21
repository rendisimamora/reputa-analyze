-- ──────────────────────────────────────────────────────────────────────────
-- Migration 1/2: add QUEUED variant to ScanStatus enum.
--
-- Postgres requires `ALTER TYPE ... ADD VALUE` to be committed BEFORE the new
-- value can be referenced in DML/DDL (defaults, UPDATEs, etc). Prisma wraps
-- each migration file in a transaction, so this MUST be its own migration.
-- The follow-up migration adds the columns + default + housekeeping that
-- reference 'QUEUED'.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TYPE "ScanStatus" ADD VALUE IF NOT EXISTS 'QUEUED' BEFORE 'RUNNING';
