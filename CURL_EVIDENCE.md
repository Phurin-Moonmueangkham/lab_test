# cURL Test Evidence

Current stack: TypeScript Hono on Cloudflare Workers with local D1.

Start and initialize the local Worker:

```bash
npm run dev
npx wrangler d1 migrations apply lab_test --local
```

Base URL used: `http://localhost:8787/api`.

## Case 1: List seeded equipment

```bash
curl -s http://localhost:8787/api/equipment
```

Observed status: `200`

```json
[{"id":"eq-1","name":"Projector A","location":"Building 1"},{"id":"eq-2","name":"Camera Kit A","location":"Media Room"},{"id":"eq-3","name":"Meeting Room 1","location":"Building 2"}]
```

## Case 2: Create a booking

```bash
curl -s -X POST http://localhost:8787/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
```

Observed status: `201`. The response contains the booking ID and all required booking fields.

## Case 3: Overlapping booking

```bash
curl -s -i -X POST http://localhost:8787/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"equipmentId":"eq-1","borrowerName":"Second User","startAt":"2026-10-20T10:00:00.000Z","endAt":"2026-10-20T12:00:00.000Z","purpose":"Overlap test"}'
```

Observed status: `409`

```json
{"error":"Booking time conflicts with an existing booking"}
```

## Case 4: Invalid equipment

```bash
curl -s -i -X POST http://localhost:8787/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"equipmentId":"eq-999","borrowerName":"Test User","startAt":"2026-10-21T09:00:00.000Z","endAt":"2026-10-21T10:00:00.000Z","purpose":"Invalid equipment"}'
```

Expected status: `400`, with `{ "error": "equipmentId does not exist" }`.

## Case 5: Read a booking

Use the `id` returned by Case 2:

```bash
curl -s http://localhost:8787/api/bookings/<BOOKING_ID>
```

Expected status: `200`.

## Case 6: Update a booking

```bash
curl -s -X PATCH http://localhost:8787/api/bookings/<BOOKING_ID> \
  -H 'Content-Type: application/json' \
  -d '{"purpose":"Updated presentation"}'
```

Expected status: `200`.

## Case 7: Delete a booking

```bash
curl -s -i -X DELETE http://localhost:8787/api/bookings/<BOOKING_ID>
```

Expected status: `204 No Content`.

## Case 8: Missing booking

```bash
curl -s -i http://localhost:8787/api/bookings/booking-missing
```

Expected status: `404`, with `{ "error": "Booking not found" }`.

Automated verification: `npm test` reports 5 passed, 0 failed; `npm run typecheck` also passes.

## Remote deployment evidence

Remote Worker URL: `https://campus-equipment-booking-api.6731503026.workers.dev`

Observed from the deployed Worker on 2026-10-06:

| Guide case | Endpoint/action | Observed status |
| --- | --- | ---: |
| 1 | `GET /api/equipment` | 200 |
| 2 | `GET /api/bookings` | 200 |
| 3 | `POST /api/bookings` | 201 |
| 4 | `GET /api/bookings/booking-9e203d62-a266-48c0-b953-a0dd63e73ffd` | 200 |
| 5 | `PATCH /api/bookings/booking-9e203d62-a266-48c0-b953-a0dd63e73ffd` | 200 |
| 6 | Invalid time range | 400 |
| 7 | Overlapping booking | 409 |
| 8 | Missing booking | 404 |
| 9 | `DELETE /api/bookings/booking-9e203d62-a266-48c0-b953-a0dd63e73ffd` | 204 |

The created booking was for `eq-1` from 09:00 to 11:00, then updated to 12:00 to 14:00. The overlap request from 12:30 to 13:30 returned the required `409` JSON error.