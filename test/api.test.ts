import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { app } from '../src/index';

class D1TestStatement {
  constructor(private readonly database: Database.Database, private readonly sql: string, private readonly values: unknown[] = []) {}

  bind(...values: unknown[]) {
    return new D1TestStatement(this.database, this.sql, values);
  }

  async first<T>() {
    return this.database.prepare(this.sql).get(...this.values) as T | undefined;
  }

  async all<T>() {
    const results = this.database.prepare(this.sql).all(...this.values) as T[];
    return { results, success: true, meta: {} };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  }
}

class D1TestDatabase {
  readonly database = new Database(':memory:');

  constructor() {
    this.database.exec(`
      CREATE TABLE equipment (id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL);
      CREATE TABLE bookings (
        id TEXT PRIMARY KEY,
        equipment_id TEXT NOT NULL,
        borrower_name TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        purpose TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO equipment VALUES ('eq-1', 'Projector A', 'Building 1');
      INSERT INTO equipment VALUES ('eq-2', 'Camera Kit A', 'Media Room');
      INSERT INTO equipment VALUES ('eq-3', 'Meeting Room 1', 'Building 2');
    `);
  }

  prepare(sql: string) {
    return new D1TestStatement(this.database, sql);
  }
}

const booking = {
  equipmentId: 'eq-1',
  borrowerName: 'Somchai Jaidee',
  startAt: '2026-10-20T09:00:00.000Z',
  endAt: '2026-10-20T11:00:00.000Z',
  purpose: 'Class presentation',
};

let db: D1TestDatabase;
const request = (path: string, init?: RequestInit) => app.request(path, init, {
  DB: db as unknown as D1Database,
  FRONTEND_ORIGIN: 'http://localhost:5173',
});

beforeEach(() => {
  db = new D1TestDatabase();
});

describe('Campus Equipment Booking API', () => {
  it('lists seeded equipment and empty bookings', async () => {
    const equipment = await request('/api/equipment');
    const bookings = await request('/api/bookings');
    expect(equipment.status).toBe(200);
    expect((await equipment.json() as unknown[]).length).toBe(3);
    expect(await bookings.json()).toEqual([]);
  });

  it('supports booking create, read, update, and delete', async () => {
    const created = await request('/api/bookings', { method: 'POST', body: JSON.stringify(booking), headers: { 'Content-Type': 'application/json' } });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { id: string; purpose: string };
    const fetched = await request(`/api/bookings/${createdBody.id}`);
    expect(fetched.status).toBe(200);
    const updated = await request(`/api/bookings/${createdBody.id}`, { method: 'PATCH', body: JSON.stringify({ purpose: 'Updated presentation' }), headers: { 'Content-Type': 'application/json' } });
    expect(updated.status).toBe(200);
    expect((await updated.json() as { purpose: string }).purpose).toBe('Updated presentation');
    const deleted = await request(`/api/bookings/${createdBody.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
  });

  it('returns 400 JSON errors for invalid data', async () => {
    const unknownEquipment = await request('/api/bookings', { method: 'POST', body: JSON.stringify({ ...booking, equipmentId: 'eq-999' }), headers: { 'Content-Type': 'application/json' } });
    expect(unknownEquipment.status).toBe(400);
    expect((await unknownEquipment.json() as { error: string }).error).toBe('equipmentId does not exist');
    const malformed = await request('/api/bookings', { method: 'POST', body: '{"equipmentId":', headers: { 'Content-Type': 'application/json' } });
    expect(malformed.status).toBe(400);
    expect((await malformed.json() as { error: string }).error).toBe('Malformed JSON');
  });

  it('returns 409 for overlap on create and update', async () => {
    const first = await request('/api/bookings', { method: 'POST', body: JSON.stringify(booking), headers: { 'Content-Type': 'application/json' } });
    const firstBody = await first.json() as { id: string };
    const conflict = await request('/api/bookings', { method: 'POST', body: JSON.stringify({ ...booking, borrowerName: 'Second User', startAt: '2026-10-20T10:00:00.000Z', endAt: '2026-10-20T12:00:00.000Z' }), headers: { 'Content-Type': 'application/json' } });
    expect(conflict.status).toBe(409);
    const other = await request('/api/bookings', { method: 'POST', body: JSON.stringify({ ...booking, equipmentId: 'eq-2' }), headers: { 'Content-Type': 'application/json' } });
    const otherBody = await other.json() as { id: string };
    const updateConflict = await request(`/api/bookings/${otherBody.id}`, { method: 'PATCH', body: JSON.stringify({ equipmentId: 'eq-1' }), headers: { 'Content-Type': 'application/json' } });
    expect(updateConflict.status).toBe(409);
    expect(firstBody.id).toMatch(/^booking-/);
  });

  it('returns 404 and enforces CORS', async () => {
    const missing = await request('/api/bookings/booking-missing');
    expect(missing.status).toBe(404);
    const allowed = await request('/api/equipment', { headers: { Origin: 'http://localhost:5173' } });
    const unknown = await request('/api/equipment', { headers: { Origin: 'http://evil.example' } });
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(unknown.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});