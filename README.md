# Campus Equipment Booking API

TypeScript Hono API for Cloudflare Workers and D1. It reserves shared campus equipment and rooms while preventing overlapping bookings for the same equipment.

## Quick start

```bash
npm install
npm test
npm run typecheck
npm run dev
```

The local Worker runs at `http://localhost:8787`, with the contract base URL at `http://localhost:8787/api`. Apply the D1 migration with `npx wrangler d1 migrations apply lab_test --local`.

Submission documentation:

- [API_CONTRACT.md](API_CONTRACT.md): endpoints, payloads, status codes, schema, and ERD
- [API_GUIDE.md](API_GUIDE.md): implementation, security, CORS, and frontend notes
- [CURL_EVIDENCE.md](CURL_EVIDENCE.md): HTTP-client evidence for success and error cases
- [QUALITY_GATE_REVIEW.md](QUALITY_GATE_REVIEW.md): review findings, fixes, and verification
- [AI_LOG.md](AI_LOG.md): transparent AI-assisted development record