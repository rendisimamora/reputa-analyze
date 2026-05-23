# ReputaScan API

Programmatic access. All endpoints under `/api/*` require **JWT bearer token authentication**, except `/api/auth/login` and `/api/auth/register` (which issue tokens).

---

## Setup (one-time, server side)

1. Generate a strong secret on the server:

       openssl rand -base64 48

2. Put it in `.env`:

       JWT_SECRET=<output-of-the-command-above>
       # Optional. Default is 7 days.
       JWT_TTL_SECONDS=604800

3. Restart the server.

---

## Authentication flow

### 1. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}'
```

Response:

```json
{
  "user": { "id": "...", "email": "you@example.com", "name": "Rendi" },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
}
```

Store the `token`. It expires in 7 days by default.

### 2. Use the token

Every subsequent request must include `Authorization: Bearer <token>`:

```bash
curl http://localhost:3000/api/projects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiI..."
```

### 3. Refresh

There's no refresh endpoint yet — when the token expires, call `/api/auth/login` again.

### 4. Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiI..."
```

The endpoint returns 200 always; logout is effectively client-side (just discard the token). The server cannot revoke individual JWTs in this setup. If you need true revocation, add a `tokenVersion` column to `User` and embed it in claims.

---

## Endpoints (quick reference)

### Auth
- `POST /api/auth/login` — `{ email, password }` → `{ user, token }`
- `POST /api/auth/register` — `{ email, password, name? }` → `{ user, token }`
- `POST /api/auth/logout` — no body → `{ ok: true }`
- `GET  /api/auth/me` — → `{ user: { id, email, name } | null }`

### Projects
- `GET  /api/projects` — list all your projects
- `POST /api/projects` — create one (`{ name, description?, keywords: string[], matchMode? }`)
- `GET  /api/projects/:slug` — fetch one
- `PATCH /api/projects/:slug` — partial update (name, description, active, telegram*)
- `DELETE /api/projects/:slug` — soft delete

### Scanning
- `POST /api/projects/:slug/scan` — enqueue a manual scan
- `GET  /api/projects/:slug/scan` — read progress for latest run
- `POST /api/cron/scan-all?token=<SESSION_PASSWORD>` — enqueue scans for ALL active projects (admin/cron use)

### Dashboard
- `GET /api/projects/:slug/dashboard/summary` — score, totals, AI summary
- `GET /api/projects/:slug/dashboard/charts` — trends + distributions
- `GET /api/projects/:slug/dashboard/recent` — latest mentions + source health

### Mentions
- `GET /api/projects/:slug/mentions?take=25&skip=0&q=&sentiment=&source=&method=&status=&from=&to=`
- `POST /api/projects/:slug/reanalyze` — re-run AI sentiment

### Alerts
- `GET   /api/projects/:slug/alerts`
- `PATCH /api/projects/:slug/alerts` — `{ alertId, acknowledged }`

### Insight
- `GET  /api/projects/:slug/insight/content` — cached content briefs
- `POST /api/projects/:slug/insight/content` — regenerate
- `GET  /api/projects/:slug/insight/keyword`
- `POST /api/projects/:slug/insight/keyword`
- `POST /api/projects/:slug/insight/complete` — `{ ideaId, completed }`

### Crawl logs
- `GET /api/projects/:slug/crawl-logs?take=25&skip=0&source=&method=&status=&from=&to=`

### Report
- `GET  /api/projects/:slug/report` — list saved snapshots
- `POST /api/projects/:slug/report` — generate a new snapshot (`{ from?, to? }`)

### Keywords
- `POST  /api/projects/:slug/keywords` — append one (`{ term, matchMode? }`)
- `PATCH /api/projects/:slug/keywords` — replace all (`{ keywords: string[], matchMode? }`)

### Telegram
- `POST /api/projects/:slug/telegram-test` — send a test message (`{ botToken?, chatId? }`)

---

## Error handling

| Status | Meaning |
|---|---|
| 200 | Success |
| 400 | Validation error — body shape doesn't match expected schema. Response includes `{ error, issues? }`. |
| 401 | Missing or invalid token. Re-login. |
| 403 | Token valid but user lacks access to the resource (mostly for cron endpoint). |
| 404 | Resource not found OR doesn't belong to your user. |
| 500 | Internal — check server logs. |

## Token format

```
header.payload.signature
```

Decoded payload:

```json
{
  "sub": "019e4456-...",  // user id
  "iat": 1716393600,
  "exp": 1716998400
}
```

Don't trust client-side parsing for security decisions — the server verifies the signature on every request.
