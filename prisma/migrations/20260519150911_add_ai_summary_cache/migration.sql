-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "aiExecutive" TEXT,
ADD COLUMN     "aiRecommendation" TEXT,
ADD COLUMN     "aiSummaryAt" TIMESTAMP(3),
ADD COLUMN     "aiSummaryError" TEXT;
