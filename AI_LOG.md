# AI Log

This record documents how AI assistance was used and what was verified by the student/developer.

| Stage | Prompt / assistance | Used | Verification |
| --- | --- | --- | --- |
| Initial design | Asked for a small REST API with CRUD, SQLite, validation, CORS, and tests. | Used the initial Express/SQLite structure as a starting point. | Read the generated files and ran the first test suite and HTTP health check. |
| Contract review | Compared the initial task API with the supplied Campus Equipment Booking brief and rubric. | Replaced the task resource with `equipment` and `bookings`; added seeded equipment and the required endpoint names. | Confirmed the routes and payload names against `API_CONTRACT.md` and the brief. |
| Business-rule review | Checked how time overlap and update behavior should work. | Implemented `startAt < existingEnd && endAt > existingStart`, excluding the current booking on update. | Tests verify conflict on create and update and return `409`. |
| Quality review | Used the rubric to identify missing evidence and error-contract gaps. | Added `API_CONTRACT.md`, `CURL_EVIDENCE.md`, `QUALITY_GATE_REVIEW.md`, and this log; changed errors to `{error}`. | Ran `npm test`, diagnostics, and real `curl` requests. |
| Final correctness check | Reviewed timezone handling and test setup after a failing test run. | Normalized timestamps to UTC and fixed SQLite `:memory:` isolation. | Re-ran all five tests successfully. |
| Stack alignment | Updated the implementation after the requested stack was clarified as TypeScript, Node.js, and Cloudflare. | Migrated the runtime to TypeScript Hono on Cloudflare Workers with D1 and Wrangler; kept the contract and business rules unchanged. | `npm run typecheck` and `npm test` both pass. |

The implementation was inspected and tested locally. Important decisions I can explain: parameter binding uses `?` placeholders, the overlap predicate allows adjacent bookings, and update conflict checks exclude the row being updated.