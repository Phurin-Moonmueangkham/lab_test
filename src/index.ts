import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';

type Bindings = {
  DB: D1Database;
  FRONTEND_ORIGIN?: string;
};

type AppEnv = { Bindings: Bindings };

type BookingRow = {
  id: string;
  equipment_id: string;
  borrower_name: string;
  start_at: string;
  end_at: string;
  purpose: string;
  created_at: string;
  updated_at: string;
};

const app = new Hono<AppEnv>();
const bookingIdSchema = z.string().trim().min(1).max(100);
const bookingSchema = z.object({
  equipmentId: z.string().regex(/^eq-[A-Za-z0-9-]+$/),
  borrowerName: z.string().trim().min(1).max(120),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  purpose: z.string().trim().min(1).max(500),
}).strict();
const bookingUpdateSchema = bookingSchema.partial().refine((value) => Object.keys(value).length > 0);

function error(message: string, status: 400 | 404 | 409 | 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeTimestamp(value: string): string {
  return new Date(value).toISOString();
}

function toBooking(row: BookingRow) {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    borrowerName: row.borrower_name,
    startAt: row.start_at,
    endAt: row.end_at,
    purpose: row.purpose,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hasTimeConflict(
  db: D1Database,
  equipmentId: string,
  startAt: string,
  endAt: string,
  excludedId?: string,
): Promise<boolean> {
  const statement = excludedId
    ? db.prepare('SELECT 1 FROM bookings WHERE equipment_id = ? AND id <> ? AND start_at < ? AND end_at > ? LIMIT 1').bind(equipmentId, excludedId, endAt, startAt)
    : db.prepare('SELECT 1 FROM bookings WHERE equipment_id = ? AND start_at < ? AND end_at > ? LIMIT 1').bind(equipmentId, endAt, startAt);
  return Boolean(await statement.first());
}

app.use('*', secureHeaders());
app.use('/api/*', cors({
  origin: (origin, context) => {
    const allowed = context.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
    return !origin || origin === allowed ? origin : '';
  },
}));

app.get('/health', (context) => context.json({ status: 'ok' }));

app.get('/api/equipment', async (context) => {
  const { results } = await context.env.DB.prepare('SELECT id, name, location FROM equipment ORDER BY id').all();
  return context.json(results);
});

app.get('/api/bookings', async (context) => {
  const { results } = await context.env.DB.prepare('SELECT * FROM bookings ORDER BY start_at ASC, id ASC').all<BookingRow>();
  return context.json(results.map(toBooking));
});

app.get('/api/bookings/:id', async (context) => {
  const id = bookingIdSchema.safeParse(context.req.param('id'));
  if (!id.success) return error('Invalid booking id', 400);
  const row = await context.env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id.data).first<BookingRow>();
  if (!row) return error('Booking not found', 404);
  return context.json(toBooking(row));
});

app.post('/api/bookings', async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return error('Malformed JSON', 400);
  }
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return error('Invalid booking data', 400);
  const startAt = normalizeTimestamp(parsed.data.startAt);
  const endAt = normalizeTimestamp(parsed.data.endAt);
  if (startAt >= endAt) return error('startAt must be before endAt', 400);
  const { equipmentId, borrowerName, purpose } = parsed.data;
  const equipment = await context.env.DB.prepare('SELECT 1 FROM equipment WHERE id = ?').bind(equipmentId).first();
  if (!equipment) return error('equipmentId does not exist', 400);
  if (await hasTimeConflict(context.env.DB, equipmentId, startAt, endAt)) {
    return error('Booking time conflicts with an existing booking', 409);
  }
  const id = `booking-${crypto.randomUUID()}`;
  await context.env.DB.prepare(
    'INSERT INTO bookings (id, equipment_id, borrower_name, start_at, end_at, purpose) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, equipmentId, borrowerName, startAt, endAt, purpose).run();
  const row = await context.env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first<BookingRow>();
  return context.json(toBooking(row as BookingRow), 201);
});

app.patch('/api/bookings/:id', async (context) => {
  const id = bookingIdSchema.safeParse(context.req.param('id'));
  if (!id.success) return error('Invalid booking id', 400);
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    return error('Malformed JSON', 400);
  }
  const parsed = bookingUpdateSchema.safeParse(body);
  if (!parsed.success) return error('Invalid booking data', 400);
  const existing = await context.env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id.data).first<BookingRow>();
  if (!existing) return error('Booking not found', 404);
  const next = {
    equipmentId: parsed.data.equipmentId ?? existing.equipment_id,
    borrowerName: parsed.data.borrowerName ?? existing.borrower_name,
    startAt: parsed.data.startAt ? normalizeTimestamp(parsed.data.startAt) : existing.start_at,
    endAt: parsed.data.endAt ? normalizeTimestamp(parsed.data.endAt) : existing.end_at,
    purpose: parsed.data.purpose ?? existing.purpose,
  };
  if (next.startAt >= next.endAt) return error('startAt must be before endAt', 400);
  const equipment = await context.env.DB.prepare('SELECT 1 FROM equipment WHERE id = ?').bind(next.equipmentId).first();
  if (!equipment) return error('equipmentId does not exist', 400);
  if (await hasTimeConflict(context.env.DB, next.equipmentId, next.startAt, next.endAt, id.data)) {
    return error('Booking time conflicts with an existing booking', 409);
  }
  await context.env.DB.prepare(
    "UPDATE bookings SET equipment_id = ?, borrower_name = ?, start_at = ?, end_at = ?, purpose = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(next.equipmentId, next.borrowerName, next.startAt, next.endAt, next.purpose, id.data).run();
  const row = await context.env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id.data).first<BookingRow>();
  return context.json(toBooking(row as BookingRow));
});

app.delete('/api/bookings/:id', async (context) => {
  const id = bookingIdSchema.safeParse(context.req.param('id'));
  if (!id.success) return error('Invalid booking id', 400);
  const result = await context.env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(id.data).run();
  if (!result.meta.changes) return error('Booking not found', 404);
  return new Response(null, { status: 204 });
});

app.notFound(() => error('Route not found', 404));
app.onError((caught) => {
  console.error(caught);
  return error('Internal server error', 500);
});

export default app;
export { app };