# Notes Backend

Express 5 + TypeScript + SQLite (`better-sqlite3`) API for the notes app. It stores notes, checklists and trackers. In production it also serves the built frontend from `../notes-frontend/out`.

## Setup

```bash
npm install
cp .env.example .env    # then edit
npm run build && npm start
```

| Variable | Purpose |
|---|---|
| `DATABASE_PATH` | SQLite file; its directory is created if missing |
| `HIDDEN_NOTES_PIN` | 4-character PIN that unlocks hidden items (required) |
| `NODE_ENV` | `production` serves the built frontend; otherwise non-API requests are proxied to Vite |
| `PORT` | Listen port (default `3002`) |
| `FRONTEND_DEV_PORT` | Vite dev server port for the dev proxy (default `3003`) |

`npm run testdb` writes sample data to `data/test.db`. Point `DATABASE_PATH` at it to try changes safely.

## Access model

- **Localhost only by default.** LAN clients are refused unless LAN sharing is on (`POST /api/system/lan/enable`, from localhost only, lasts 15 minutes).
- **Hidden items** need the PIN cookie (`POST /api/auth`) to be listed, changed or deleted. Failed PIN attempts are rate-limited per IP (5 per hour).
- **Browser protections.** Requests must address the server as localhost or by IP (no hostnames), which blocks DNS rebinding. Non-GET requests from a browser page must come from the same hostname, which blocks CSRF.
- **Clipboard note.** It is created at startup and can't be deleted, renamed, unpinned, hidden or archived.

## API

All routes are under `/api`. Errors come back as `{ "error": "..." }`.

| Resource | Routes |
|---|---|
| Notes | `GET /notes`, `/notes/hidden`, `/notes/archived` · `POST /notes` · `PUT /notes/:id` · `DELETE /notes/:id` |
| Checklists | same shape under `/checklists`, plus `POST /checklists/:id/items` · `PUT /checklists/items/:itemId` · `DELETE /checklists/items/:itemId` |
| Trackers | same shape under `/trackers`, plus `POST /trackers/:id/entries` · `PUT /trackers/entries/:entryId` · `POST /trackers/import` (PIN) |
| Content (all types, merged) | `GET /content`, `/content/hidden`, `/content/archived` · `DELETE /content/batch` with `{ items: [{ id, type }] }` |
| Auth | `POST /auth` `{ pin }` · `GET /auth/status` · `POST /logout` |
| System | `GET /health` · `GET /server-ip` · `GET /system/lan/status` · `POST /system/lan/enable` / `disable` |

- **`PUT` is a partial update.** Send only the fields you want to change: `title`, `content`/`items`/`unit`, and the flags `pinned`, `hidden`, `archived`.
- **Flags** accept `true`/`false` or `0`/`1`.
- **Checklist items.** Sending `items` replaces the whole list.
- **Tracker entries.** Remove entries by sending `deletedEntryIds` on the tracker `PUT`.
