# Scheduler architecture

## Why this exists

The scanning pipeline (RSS crawl → 16 media sources → DB writes → OpenAI sentiment
analysis on every mention → reputation scoring → AI summary regeneration) is
heavy. Running it inside the Next.js process makes local development sluggish
and couples the web app's uptime to the scanner's failure modes.

Scans now run in a **separate Node process** managed by PM2 on a VM. The Next.js
app only enqueues work; it never touches a network socket for crawling or hits
the OpenAI API on the request path.

## Flow

```
┌─────────────────┐    POST /api/projects/[slug]/scan       ┌──────────────┐
│  Browser (UI)   │ ──────────────────────────────────────▶ │  Next.js     │
└─────────────────┘                                         │              │
                                                            │ enqueueScan()│
                                                            │              │
                                                            │  INSERT INTO │
                                                            │  ScanRun     │
                                                            │  status=QUEUED
                                                            └──────┬───────┘
                                                                   │
                                                                   ▼
                                                            ┌──────────────┐
                                                            │  Postgres    │
                                                            │  ScanRun     │
                                                            └──────┬───────┘
                                                                   │ poll every 2s
                                                                   ▼
                                                            ┌──────────────────────┐
                                                            │ PM2 worker (VM)       │
                                                            │ src/scheduler/runner.ts│
                                                            │                       │
                                                            │ 1. claimAndExecuteOne │
                                                            │ 2. cron tick enqueues │
                                                            │ 3. rescue stuck scans │
                                                            └──────────────────────┘
                                                                   │
                                                                   ▼
                                              writes progressJson back to ScanRun
                                              every stage transition. UI polls
                                              GET /api/projects/[slug]/scan to
                                              render the progress bar.
```

## Local dev

You do **not** need to run the scheduler for the Next.js UI to work. UI calls
that need to display progress will simply show "Menunggu worker…" until a worker
is online.

To run a scan locally without the worker, use the inline one-off CLI:

    npm run scan:once <projectId>

To run the full scheduler loop locally:

    npm run scheduler

## Production deploy (VM with PM2)

1. SSH to the VM and pull latest:

       cd /srv/reputascan-id && git pull && npm ci

2. Apply DB migration (adds `ScanStatus.QUEUED`, `ScanRun.claimedAt`, `ScanRun.progressJson`):

       npx prisma migrate deploy

3. Start the worker under PM2:

       pm2 start ecosystem.config.js
       pm2 save
       pm2 startup     # follow the instructions to survive reboots

4. Tail logs:

       pm2 logs reputascan-scheduler

## Operational notes

- **Single instance only.** `claimAndExecuteOne` uses a conditional UPDATE; two
  workers could each claim a different row in the same tick, but the row-level
  claim still prevents double-execution of the same row. Don't run multiple
  instances unless you migrate to BullMQ.
- **Stuck-scan rescue.** If a worker dies mid-scan, the row's `claimedAt` is set
  but `finishedAt` is null. After 15 minutes (configurable via `STUCK_RESCUE_MS`),
  the janitor marks it `FAILED` so the UI doesn't hang forever.
- **De-dupe.** `enqueueScan` returns the existing row if a QUEUED-unclaimed
  scan already exists for that project — clicking the Scan button rapidly is safe.
- **Memory.** Worker restarts on >512MB RSS (cheerio + lots of articles can grow).
