/*
  Warnings:

  - The primary key for the `Alert` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CrawlLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `projectId` column on the `CrawlLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Keyword` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Mention` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Project` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Report` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ScanRun` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SourceStat` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `projectId` column on the `SourceStat` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[userId,slug]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `id` on the `Alert` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `projectId` on the `Alert` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `CrawlLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Keyword` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `projectId` on the `Keyword` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Mention` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `projectId` on the `Mention` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `slug` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `id` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `Report` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `projectId` on the `Report` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `ScanRun` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `projectId` on the `ScanRun` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `SourceStat` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Keyword" DROP CONSTRAINT "Keyword_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Mention" DROP CONSTRAINT "Mention_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_userId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ScanRun" DROP CONSTRAINT "ScanRun_projectId_fkey";

-- AlterTable
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "projectId",
ADD COLUMN     "projectId" UUID NOT NULL,
ADD CONSTRAINT "Alert_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CrawlLog" DROP CONSTRAINT "CrawlLog_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "projectId",
ADD COLUMN     "projectId" UUID,
ADD CONSTRAINT "CrawlLog_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Keyword" DROP CONSTRAINT "Keyword_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "projectId",
ADD COLUMN     "projectId" UUID NOT NULL,
ADD CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Mention" DROP CONSTRAINT "Mention_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "projectId",
ADD COLUMN     "projectId" UUID NOT NULL,
ADD CONSTRAINT "Mention_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Project" DROP CONSTRAINT "Project_pkey",
ADD COLUMN     "slug" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL,
ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Report" DROP CONSTRAINT "Report_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "projectId",
ADD COLUMN     "projectId" UUID NOT NULL,
ADD CONSTRAINT "Report_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "ScanRun" DROP CONSTRAINT "ScanRun_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "projectId",
ADD COLUMN     "projectId" UUID NOT NULL,
ADD CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SourceStat" DROP CONSTRAINT "SourceStat_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
DROP COLUMN "projectId",
ADD COLUMN     "projectId" UUID,
ADD CONSTRAINT "SourceStat_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "Alert_projectId_createdAt_idx" ON "Alert"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CrawlLog_projectId_createdAt_idx" ON "CrawlLog"("projectId", "createdAt");

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
CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_slug_key" ON "Project"("userId", "slug");

-- CreateIndex
CREATE INDEX "Report_projectId_createdAt_idx" ON "Report"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ScanRun_projectId_startedAt_idx" ON "ScanRun"("projectId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceStat_projectId_sourceKey_key" ON "SourceStat"("projectId", "sourceKey");

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
