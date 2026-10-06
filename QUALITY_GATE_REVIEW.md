# Quality Gate Review

## Pre-30-minute snapshot

The first implementation snapshot was a runnable Express/SQLite task API with `GET/POST/PATCH/DELETE /api/tasks`, Zod validation, Helmet, CORS, and four tests. It was useful as a technical starting point, but it did not yet match the supplied booking contract.

**Evidence note:** No screenshot or git commit was captured exactly at minute 30. This is a transparent reconstructed record based on the first implementation state and its test output, not a claim of a timed screenshot or checkpoint.

## Findings after the snapshot

### 1. Reliability / Accuracy

**What I found:** The resource was `tasks`, while the exam requires `equipment` and `bookings` with a relationship.

**How I fixed it:** Replaced the schema and routes with `equipment` and `bookings`, seeded `eq-1`, `eq-2`, and `eq-3`, and documented the contract and ERD.

**Evidence:** `npm test` passes the seeded equipment test and booking CRUD test; `GET /api/equipment` returns three equipment records.

### 2. Business-rule correctness

**What I found:** There was no protection against two bookings for the same equipment at overlapping times.

**How I fixed it:** Added the overlap predicate `startAt < existingEnd AND endAt > existingStart` to create and update paths. The update query excludes its own booking ID.

**Evidence:** The automated test `overlapping bookings are rejected with 409 on create and update` passes, and the curl evidence includes a `409` conflict.

### 3. Contract and error consistency

**What I found:** The first validation response included a `details` field and list endpoints used `{data: ...}`, while the supplied contract requires a simple JSON error and an equipment array.

**How I fixed it:** All errors now use `{ "error": "..." }`; equipment and booking responses match the documented resource shapes. `400`, `404`, and `409` are used for distinct client conditions.

**Evidence:** The invalid input, not-found, and conflict tests pass; curl output shows JSON errors for all three statuses.

### 4. Evidence and ownership

**What I found:** The first version had no curl evidence, Quality Gate record, or AI log.

**How I fixed it:** Added `CURL_EVIDENCE.md`, this review, `AI_LOG.md`, and `API_CONTRACT.md`.

**Evidence:** The final verification section records the exact commands, responses, and `npm test` result.

### 5. Time representation and test isolation

**What I found:** Clients may send equivalent times with different timezone offsets, and the initial test database helper accidentally converted SQLite `:memory:` into a persistent file.

**How I fixed it:** Normalize all accepted timestamps to UTC ISO strings before comparison/storage, and preserve the special `:memory:` filename in the database factory.

**Evidence:** The full suite passes with isolated databases, and the overlap predicate compares canonical UTC values.

### 6. Supplied curl guide compatibility

**What I found:** The supplied `curl_test_guide.md` uses `/bookings/not-found` and expects `404`, while the first TypeScript migration rejected IDs without the `booking-` prefix as `400`.

**How I fixed it:** Path IDs are now validated only as non-empty bounded strings; an unknown ID is looked up with a bound query and returns `404 Booking not found`.

**Evidence:** The live Wrangler request `GET http://localhost:8787/api/bookings/not-found` returned `404` with `{"error":"Booking not found"}`.

## Final verification

- `npm test`: 5 passed, 0 failed.
- `npm run typecheck`: passed.
- TypeScript diagnostics for `src/index.ts` and `test/api.test.ts`: no errors found.
- Local D1 migration `0001_initial.sql`: applied successfully.
- Real Wrangler HTTP checks from `curl_test_guide.md`: `200, 200, 201, 200, 200, 400, 409, 404, 204`.
- Remote Worker deployment: `https://campus-equipment-booking-api.6731503026.workers.dev`.
- Remote production checks confirmed `GET` equipment/bookings `200`, create `201`, read/update `200`, overlap `409`, and delete `204`.
- Manual curl cases are recorded in `CURL_EVIDENCE.md`.