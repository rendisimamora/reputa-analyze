-- Add AI Insight cache columns to Project.
-- Mirrors the aiSummary pattern: cached JSON + generatedAt + last error.

ALTER TABLE "Project" ADD COLUMN "insightContentJson" JSONB;
ALTER TABLE "Project" ADD COLUMN "insightKeywordJson" JSONB;
ALTER TABLE "Project" ADD COLUMN "insightGeneratedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "insightError"       TEXT;
