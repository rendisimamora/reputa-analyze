# ReputaScan ID

AI-powered media sentiment & reputation monitoring untuk media online Indonesia.
Data dikumpulkan dari **RSS feed + halaman publik** (16 media nasional). **Tanpa** Twitter/YouTube/News API/Google CSE.

OpenAI digunakan **hanya** untuk analisa sentimen Bahasa Indonesia.

## Highlights

- 16 source adapter siap pakai: Detik, Kompas, CNN Indonesia, CNBC Indonesia, Tempo, Antara, Liputan6, Kumparan, Tribunnews, Media Indonesia, Republika, Suara, Merdeka, Okezone, Viva, Bisnis Indonesia.
- Adapter pattern: tambah source baru dengan satu file di `src/sources/`.
- Real crawling: `robots.txt` checker, per-domain rate limit, retry + backoff, dedupe (URL + content hash), in-memory cache.
- AI sentiment (OpenAI): label, score (-1..1), emotion, toxicity, hate speech, fake-news indicator, topic, summary — strict JSON output.
- Reputation score 0–100 dengan kategori Excellent/Good/Risky/Critical.
- Alert engine: negative spike, high toxicity, reputation drop, credible negative, multi-source negative.
- Dark mode premium SaaS dashboard (Next.js 14, Tailwind, Recharts, Lucide).
- Internal `node-cron` scheduler + `/api/cron/scan-all` endpoint untuk external cron.
- Crawl logs, source health, mention filters, executive AI report dengan Export PDF (via browser print).

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · PostgreSQL · Prisma · OpenAI SDK · rss-parser · cheerio · robots-parser · node-cron · Recharts · iron-session · bcryptjs.

## Setup

```bash
# 1. Install deps
npm install   # atau pnpm install / yarn

# 2. Configure env
cp .env.example .env
# Isi DATABASE_URL, OPENAI_API_KEY, SESSION_PASSWORD (string >= 32 chars).

# 3. Buat schema database
npx prisma migrate dev --name init
npx prisma generate

# 4. (Opsional) seed user admin demo
npm run seed
# -> admin@reputascan.id / reputascan123

# 5. Jalankan
npm run dev
# buka http://localhost:3000
```

## Scheduler

Dua opsi:

**Opsi A — in-process node-cron** (single instance):

```bash
npm run scheduler
```

Akan menjalankan scan tiap `SCAN_CRON` (default `*/30 * * * *`) untuk semua project `active=true`.

**Opsi B — external cron** (Vercel Cron, GitHub Actions, k8s CronJob):

POST ke `/api/cron/scan-all?token=$SESSION_PASSWORD` (atau header `x-cron-token`).

## Alur

1. Register/login.
2. Buat project + tambah keyword (tokoh, brand, isu).
3. Sistem scan: poll RSS semua source → filter keyword → (fallback) public search page → dedupe → simpan → OpenAI sentiment → reputation score → alert.
4. Dashboard menampilkan metric, trend, source distribution, topic positif/negatif, executive summary, recommendation.
5. Mentions page: filter date/source/sentiment/method, link langsung ke artikel asli.
6. Report page: regenerate + Export PDF (print).

## Crawling rules (built-in)

- `robots.txt` di-fetch + cached, fetch hanya bila diijinkan untuk user-agent kita.
- `User-Agent` jelas & dapat dihubungi (override via `CRAWLER_USER_AGENT`).
- Per-host queue + delay (`CRAWLER_DELAY_MS`, default 2.5s) + global concurrency cap.
- Retry exponential backoff hanya untuk error transient (408/425/429/5xx).
- 401/403 ditandai `RESTRICTED`. Source error dilanjut ke source berikutnya.
- Tidak ada bypass login/paywall/captcha. Tidak menyentuh social media yang butuh auth.
- Setiap fetch dicatat di `CrawlLog` + `SourceStat`.

## Tambah source baru

```ts
// src/sources/newSource.ts
import { BaseSource, type SourceMeta } from './baseSource';

export class NewSource extends BaseSource {
  meta: SourceMeta = { key: 'new', name: 'New Source', baseUrl: 'https://...', credibility: 0.7 };
  rssFeeds() { return ['https://.../rss']; }
  extractArticle(html: string) { return this.genericExtract(html); }
}
```

Daftarkan di `src/sources/index.ts`.

## Catatan produksi

- Untuk multi-instance, ganti `src/lib/rateLimiter.ts` dengan distributed limiter (Redis) dan jalankan scheduler di **satu** worker atau migrate ke BullMQ.
- Untuk halaman yang sepenuhnya client-rendered, tambahkan Puppeteer hanya pada adapter yang memang membutuhkan (saat ini tidak dipakai — semua source punya RSS).
- Snapshot mention disimpan di Postgres. Pertimbangkan retention policy jika volume besar.

## Lisensi

Internal/proprietary. Hormati ToS setiap media — sistem ini menghormati `robots.txt`, namun pastikan kebijakan masing-masing situs juga ditinjau secara berkala.
