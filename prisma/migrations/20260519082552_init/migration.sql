-- CreateEnum
CREATE TYPE "MatchMode" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('RSS', 'SEARCH_PAGE', 'ARTICLE_SCRAPE');

-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('OK', 'RESTRICTED', 'RATE_LIMITED', 'ERROR', 'PARTIAL');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ScanTrigger" AS ENUM ('MANUAL', 'CRON', 'ON_CREATE');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('NEGATIVE_SPIKE', 'HIGH_TOXICITY', 'REPUTATION_DROP', 'CREDIBLE_NEGATIVE', 'MULTI_SOURCE_NEGATIVE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastScanAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "matchMode" "MatchMode" NOT NULL DEFAULT 'ANY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "contentHash" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "rawContent" TEXT,
    "matchedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "collectionMethod" "CollectionMethod" NOT NULL,
    "crawlStatus" "CrawlStatus" NOT NULL DEFAULT 'OK',
    "crawlError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentiment" "Sentiment",
    "sentimentScore" DOUBLE PRECISION,
    "emotion" TEXT,
    "toxicity" DOUBLE PRECISION,
    "hateSpeech" DOUBLE PRECISION,
    "fakeNews" DOUBLE PRECISION,
    "topic" TEXT,
    "aiSummary" TEXT,
    "analyzedAt" TIMESTAMP(3),

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceStat" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3),
    "lastStatus" "CrawlStatus" NOT NULL DEFAULT 'OK',
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "totalErrors" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "SourceStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "method" "CollectionMethod" NOT NULL,
    "url" TEXT NOT NULL,
    "status" "CrawlStatus" NOT NULL,
    "httpStatus" INTEGER,
    "message" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trigger" "ScanTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "newMentions" INTEGER NOT NULL DEFAULT 0,
    "analyzed" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "status" "ScanStatus" NOT NULL DEFAULT 'RUNNING',
    "message" TEXT,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rangeFrom" TIMESTAMP(3) NOT NULL,
    "rangeTo" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE INDEX "Keyword_projectId_idx" ON "Keyword"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_projectId_term_key" ON "Keyword"("projectId", "term");

-- CreateIndex
CREATE INDEX "Mention_projectId_publishedAt_idx" ON "Mention"("projectId", "publishedAt");

-- CreateIndex
CREATE INDEX "Mention_projectId_sentiment_idx" ON "Mention"("projectId", "sentiment");

-- CreateIndex
CREATE INDEX "Mention_projectId_sourceKey_idx" ON "Mention"("projectId", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "Mention_projectId_urlHash_key" ON "Mention"("projectId", "urlHash");

-- CreateIndex
CREATE INDEX "SourceStat_sourceKey_idx" ON "SourceStat"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "SourceStat_projectId_sourceKey_key" ON "SourceStat"("projectId", "sourceKey");

-- CreateIndex
CREATE INDEX "CrawlLog_projectId_createdAt_idx" ON "CrawlLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CrawlLog_sourceKey_createdAt_idx" ON "CrawlLog"("sourceKey", "createdAt");

-- CreateIndex
CREATE INDEX "ScanRun_projectId_startedAt_idx" ON "ScanRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "Alert_projectId_createdAt_idx" ON "Alert"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_projectId_createdAt_idx" ON "Report"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
