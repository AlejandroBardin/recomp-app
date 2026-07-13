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

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  pillar TEXT NOT NULL,
  name TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 10,
  sort INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  habit_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE(date, habit_id)
);

CREATE TABLE IF NOT EXISTS anxiety_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  intensity INTEGER NOT NULL DEFAULT 3,
  cause TEXT,
  action TEXT,
  resisted INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  pillar TEXT NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  ref_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_date ON exercise_logs(date);
CREATE INDEX IF NOT EXISTS idx_food_entries_date ON food_entries(date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_anxiety_date ON anxiety_episodes(date);
CREATE INDEX IF NOT EXISTS idx_xp_events_date ON xp_events(date);
CREATE INDEX IF NOT EXISTS idx_xp_events_pillar ON xp_events(pillar);
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

// Misiones diarias por pilar. El pilar "fisico" suma XP automáticamente
// desde los registros de ejercicio y las bajadas de peso.
const BASE_HABITS = [
  { key: 'agua', pillar: 'alimentacion', name: 'Beber 2 L de agua', xp: 15 },
  { key: 'verduras', pillar: 'alimentacion', name: 'Comer 2+ porciones de verdura', xp: 15 },
  { key: 'cocina', pillar: 'alimentacion', name: 'Cocinar saludable en casa', xp: 20 },
  { key: 'dia-limpio', pillar: 'alimentacion', name: 'Día limpio (nada fuera de hambre real)', xp: 25 },
  { key: 'cama', pillar: 'habitos', name: 'Tender la cama', xp: 10 },
  { key: 'sueno', pillar: 'habitos', name: 'Dormir 7–8 h en horario consistente', xp: 20 },
  { key: 'orden', pillar: 'habitos', name: 'Espacio de trabajo ordenado', xp: 10 },
  { key: 'higiene', pillar: 'habitos', name: 'Autocuidado (ducha, afeitado)', xp: 10 },
  { key: 'oracion', pillar: 'oracion', name: '15 min de oración / meditación', xp: 20 },
  { key: 'lectura', pillar: 'oracion', name: 'Leer un pasaje inspirador', xp: 15 },
  { key: 'servicio', pillar: 'oracion', name: 'Asistir a un servicio', xp: 30 },
  { key: 'tareas', pillar: 'trabajo', name: 'Completar la lista de tareas', xp: 20 },
  { key: 'profundo', pillar: 'trabajo', name: '4 h de trabajo profundo', xp: 30 },
  { key: 'meta', pillar: 'trabajo', name: 'Alcanzar una meta profesional', xp: 50 }
];

const habitCount = db.prepare('SELECT COUNT(*) AS n FROM habits').get().n;
if (habitCount === 0) {
  const insert = db.prepare('INSERT INTO habits (key, pillar, name, xp, sort) VALUES (?, ?, ?, ?, ?)');
  BASE_HABITS.forEach((h, i) => insert.run(h.key, h.pillar, h.name, h.xp, i));
}

// Backfill: el esfuerzo previo a la gamificación también cuenta.
const { exerciseXp, weightXp } = require('./gamify');
const xpCount = db.prepare('SELECT COUNT(*) AS n FROM xp_events').get().n;
if (xpCount === 0) {
  const insertXp = db.prepare(
    'INSERT INTO xp_events (date, pillar, amount, source, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const l of db.prepare('SELECT * FROM exercise_logs').all()) {
    insertXp.run(l.date, 'fisico', exerciseXp(l.calories), 'exercise', l.id, l.exercise_name);
  }
  let best = null;
  for (const w of db.prepare('SELECT * FROM weight_entries ORDER BY date ASC').all()) {
    if (best != null && w.weight < best) {
      insertXp.run(w.date, 'fisico', weightXp(best, w.weight), 'weight', w.id, `-${(best - w.weight).toFixed(1)} kg`);
    }
    if (best == null || w.weight < best) best = w.weight;
  }
}

module.exports = db;
