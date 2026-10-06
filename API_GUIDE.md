# Cloudflare Implementation Guide

## Run

```bash
npm install
npm test
npm run typecheck
npm run dev
```

The Worker listens locally at `http://localhost:8787`. Cloudflare D1 is exposed to the Worker as `env.DB`. The schema and seed data are in [migrations/0001_initial.sql](migrations/0001_initial.sql).

For local D1:

```bash
npx wrangler d1 migrations apply lab_test --local
```

The repository is configured with the D1 database ID in `wrangler.toml`. Authenticate Wrangler, then run:

```bash
npx wrangler d1 migrations apply lab_test --remote
npm run deploy
```

## Implementation and security

- Hono exposes the required `/api/equipment` and `/api/bookings` routes from the TypeScript Worker entrypoint `src/index.ts`.
- D1/SQLite uses a foreign key from `bookings.equipment_id` to `equipment.id`.
- Accepted timestamps are normalized to UTC ISO strings before overlap checks and storage, so timezone offsets cannot bypass the business rule.
- All user-controlled SQL values use `?` parameter binding; request values are never concatenated into SQL.
- Zod validates IDs, required strings, ISO timestamps, and payload shape before database writes.
- `helmet()` adds security headers and the JSON parser has a 20 KB limit.
- CORS allows only `FRONTEND_ORIGIN` (default `http://localhost:5173`).
- Errors are JSON and do not expose stack traces.

## Browser tester connection

An optional browser tester served from `http://localhost:5173` can call the API:

```js
const API = 'http://localhost:8787/api';
const response = await fetch(`${API}/bookings`);
const bookings = await response.json();

const created = await fetch(`${API}/bookings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    equipmentId: 'eq-1',
    borrowerName: 'Somchai Jaidee',
    startAt: '2026-10-20T09:00:00.000Z',
    endAt: '2026-10-20T11:00:00.000Z',
    purpose: 'Class presentation'
  })
});
```

Set `FRONTEND_ORIGIN` to the tester's exact origin if it differs. CORS is only needed for a browser client; curl is not subject to browser CORS.

See [API_CONTRACT.md](API_CONTRACT.md) for the contract and [CURL_EVIDENCE.md](CURL_EVIDENCE.md) for HTTP evidence.