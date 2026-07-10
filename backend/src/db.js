const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'recomp.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'otro',
  met REAL NOT NULL DEFAULT 3,
  unit TEXT NOT NULL DEFAULT 'minutos',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  exercise_id INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  sets INTEGER,
  reps INTEGER,
  minutes REAL,
  calories REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS food_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  name TEXT NOT NULL,
  calories REAL NOT NULL,
  impulsive INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS frequent_foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  calories REAL NOT NULL,
  times_used INTEGER NOT NULL DEFAULT 1,
  last_used TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS weight_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  weight REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  height_cm REAL,
  age INTEGER,
  sex TEXT,
  activity REAL,
  goal_weight REAL,
  rate_pct REAL
);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_date ON exercise_logs(date);
CREATE INDEX IF NOT EXISTS idx_food_entries_date ON food_entries(date);
`);

const BASE_EXERCISES = [
  { name: 'Dominadas', type: 'tren superior', met: 8, unit: 'series' },
  { name: 'Fondos en silla', type: 'tren superior', met: 5, unit: 'series' },
  { name: 'Flexiones', type: 'tren superior', met: 6, unit: 'series' },
  { name: 'Plancha', type: 'core', met: 3.5, unit: 'minutos' },
  { name: 'Elevación de piernas colgado', type: 'core', met: 4, unit: 'series' },
  { name: 'Bici fija', type: 'cardio bajo impacto', met: 5.5, unit: 'minutos' },
  { name: 'Natación', type: 'cardio bajo impacto', met: 6, unit: 'minutos' },
  { name: 'Isométricos de cuádriceps', type: 'otro', met: 2.5, unit: 'minutos' },
  { name: 'Caminata', type: 'cardio bajo impacto', met: 3.3, unit: 'minutos' }
];

const count = db.prepare('SELECT COUNT(*) AS n FROM exercises').get().n;
if (count === 0) {
  const insert = db.prepare('INSERT INTO exercises (name, type, met, unit) VALUES (?, ?, ?, ?)');
  for (const e of BASE_EXERCISES) insert.run(e.name, e.type, e.met, e.unit);
}

module.exports = db;
