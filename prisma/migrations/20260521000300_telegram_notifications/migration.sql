-- Telegram notification config per project.
ALTER TABLE "Project" ADD COLUMN "telegramEnabled"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "telegramBotToken"   TEXT;
ALTER TABLE "Project" ADD COLUMN "telegramChatId"     TEXT;
ALTER TABLE "Project" ADD COLUMN "telegramLastSentAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "telegramLastError"  TEXT;
