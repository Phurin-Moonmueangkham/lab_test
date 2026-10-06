CREATE TABLE equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  location TEXT NOT NULL CHECK(length(location) BETWEEN 1 AND 120)
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  borrower_name TEXT NOT NULL CHECK(length(borrower_name) BETWEEN 1 AND 120),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(length(purpose) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(start_at < end_at)
);

CREATE INDEX idx_bookings_equipment_time ON bookings(equipment_id, start_at, end_at);

INSERT INTO equipment (id, name, location) VALUES
  ('eq-1', 'Projector A', 'Building 1'),
  ('eq-2', 'Camera Kit A', 'Media Room'),
  ('eq-3', 'Meeting Room 1', 'Building 2');