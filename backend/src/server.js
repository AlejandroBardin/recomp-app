const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function latestWeight() {
  const row = db.prepare('SELECT weight FROM weight_entries ORDER BY date DESC LIMIT 1').get();
  return row ? row.weight : null;
}

// kcal = MET × 3.5 × peso(kg) / 200 × minutos
// Para ejercicios por series sin tiempo: ~2 min por serie
function estimateCalories(met, weight, { minutes, sets }) {
  const mins = minutes || (sets ? sets * 2 : 0);
  if (!mins || !weight) return 0;
  return Math.round((met * 3.5 * weight / 200) * mins);
}

// ---------- Ejercicios ----------
app.get('/api/exercises', (req, res) => {
  res.json(db.prepare('SELECT * FROM exercises WHERE active = 1 ORDER BY type, name').all());
});

app.post('/api/exercises', (req, res) => {
  const { name, type = 'otro', met = 3, unit = 'minutos' } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Falta el nombre' });
  const info = db.prepare('INSERT INTO exercises (name, type, met, unit) VALUES (?, ?, ?, ?)')
    .run(name.trim(), type, Number(met) || 3, unit);
  res.json(db.prepare('SELECT * FROM exercises WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/exercises/:id', (req, res) => {
  const { name, type, met, unit } = req.body;
  const ex = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'No existe' });
  db.prepare('UPDATE exercises SET name = ?, type = ?, met = ?, unit = ? WHERE id = ?')
    .run(name ?? ex.name, type ?? ex.type, met != null ? Number(met) : ex.met, unit ?? ex.unit, req.params.id);
  res.json(db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id));
});

app.delete('/api/exercises/:id', (req, res) => {
  db.prepare('UPDATE exercises SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Registros de ejercicio ----------
app.get('/api/logs', (req, res) => {
  const date = req.query.date || todayStr();
  res.json(db.prepare('SELECT * FROM exercise_logs WHERE date = ? ORDER BY created_at DESC').all(date));
});

app.get('/api/logs/history', (req, res) => {
  const days = Math.min(Number(req.query.days) || 14, 90);
  const rows = db.prepare(
    `SELECT * FROM exercise_logs WHERE date >= date('now', 'localtime', ?) ORDER BY date DESC, created_at DESC`
  ).all(`-${days} days`);
  res.json(rows);
});

app.post('/api/logs', (req, res) => {
  const { exercise_id, sets, reps, minutes, date } = req.body;
  const ex = db.prepare('SELECT * FROM exercises WHERE id = ?').get(exercise_id);
  if (!ex) return res.status(404).json({ error: 'Ejercicio no encontrado' });
  const weight = latestWeight() || 0;
  const calories = estimateCalories(ex.met, weight, { minutes: Number(minutes) || null, sets: Number(sets) || null });
  const info = db.prepare(
    'INSERT INTO exercise_logs (date, exercise_id, exercise_name, sets, reps, minutes, calories) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(date || todayStr(), ex.id, ex.name, Number(sets) || null, Number(reps) || null, Number(minutes) || null, calories);
  res.json(db.prepare('SELECT * FROM exercise_logs WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/logs/:id', (req, res) => {
  db.prepare('DELETE FROM exercise_logs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Comidas ----------
app.get('/api/food', (req, res) => {
  const date = req.query.date || todayStr();
  res.json(db.prepare('SELECT * FROM food_entries WHERE date = ? ORDER BY time DESC, id DESC').all(date));
});

app.post('/api/food', (req, res) => {
  const { name, calories, impulsive, date, time } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Falta el nombre' });
  const kcal = Number(calories);
  if (!Number.isFinite(kcal) || kcal < 0) return res.status(400).json({ error: 'Calorías inválidas' });
  const info = db.prepare(
    'INSERT INTO food_entries (date, time, name, calories, impulsive) VALUES (?, ?, ?, ?, ?)'
  ).run(date || todayStr(), time || nowTime(), name.trim(), kcal, impulsive ? 1 : 0);

  // actualizar alimentos frecuentes (autocompletado)
  db.prepare(`
    INSERT INTO frequent_foods (name, calories, times_used, last_used)
    VALUES (?, ?, 1, datetime('now','localtime'))
    ON CONFLICT(name) DO UPDATE SET
      calories = excluded.calories,
      times_used = times_used + 1,
      last_used = excluded.last_used
  `).run(name.trim(), kcal);

  res.json(db.prepare('SELECT * FROM food_entries WHERE id = ?').get(info.lastInsertRowid));
});

app.patch('/api/food/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM food_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'No existe' });
  const impulsive = req.body.impulsive != null ? (req.body.impulsive ? 1 : 0) : entry.impulsive;
  db.prepare('UPDATE food_entries SET impulsive = ? WHERE id = ?').run(impulsive, req.params.id);
  res.json(db.prepare('SELECT * FROM food_entries WHERE id = ?').get(req.params.id));
});

app.delete('/api/food/:id', (req, res) => {
  db.prepare('DELETE FROM food_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Búsqueda insensible a acentos y mayúsculas (el LIKE de SQLite no cubre "café" vs "cafe")
const normalize = (s) => s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();

app.get('/api/foods/suggest', (req, res) => {
  const q = normalize((req.query.q || '').trim());
  const rows = db.prepare('SELECT name, calories FROM frequent_foods ORDER BY times_used DESC, last_used DESC').all();
  const matches = q ? rows.filter((r) => normalize(r.name).includes(q)) : rows;
  res.json(matches.slice(0, 8));
});

// Patrones: comidas impulsivas agrupadas por hora del día
app.get('/api/food/patterns', (req, res) => {
  const rows = db.prepare(`
    SELECT CAST(substr(time, 1, 2) AS INTEGER) AS hour, COUNT(*) AS count
    FROM food_entries WHERE impulsive = 1
    GROUP BY hour ORDER BY hour
  `).all();
  const total = db.prepare('SELECT COUNT(*) AS n FROM food_entries WHERE impulsive = 1').get().n;
  res.json({ total, byHour: rows });
});

// ---------- Peso ----------
app.get('/api/weights', (req, res) => {
  res.json(db.prepare('SELECT * FROM weight_entries ORDER BY date ASC').all());
});

app.post('/api/weights', (req, res) => {
  const { date, weight } = req.body;
  const w = Number(weight);
  if (!Number.isFinite(w) || w <= 0) return res.status(400).json({ error: 'Peso inválido' });
  const d = date || todayStr();
  db.prepare(`
    INSERT INTO weight_entries (date, weight) VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET weight = excluded.weight
  `).run(d, w);
  res.json(db.prepare('SELECT * FROM weight_entries WHERE date = ?').get(d));
});

app.delete('/api/weights/:id', (req, res) => {
  db.prepare('DELETE FROM weight_entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Perfil ----------
app.get('/api/profile', (req, res) => {
  res.json(db.prepare('SELECT * FROM profile WHERE id = 1').get() || null);
});

app.put('/api/profile', (req, res) => {
  const { height_cm, age, sex, activity, goal_weight, rate_pct } = req.body;
  // ritmo de pérdida: entre 0.25% y 1% del peso corporal por semana, nunca más
  const rate = Math.min(Math.max(Number(rate_pct) || 0.75, 0.25), 1);
  db.prepare(`
    INSERT INTO profile (id, height_cm, age, sex, activity, goal_weight, rate_pct)
    VALUES (1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      height_cm = excluded.height_cm, age = excluded.age, sex = excluded.sex,
      activity = excluded.activity, goal_weight = excluded.goal_weight, rate_pct = excluded.rate_pct
  `).run(Number(height_cm) || null, Number(age) || null, sex || null, Number(activity) || null,
         Number(goal_weight) || null, rate);
  res.json(db.prepare('SELECT * FROM profile WHERE id = 1').get());
});

// ---------- Cálculos (Mifflin-St Jeor) ----------
function computeTargets(profile, weight) {
  if (!profile || !weight || !profile.height_cm || !profile.age || !profile.sex || !profile.activity) return null;
  const sexTerm = profile.sex === 'F' ? -161 : 5;
  const bmr = 10 * weight + 6.25 * profile.height_cm - 5 * profile.age + sexTerm;
  const tdee = bmr * profile.activity;
  const rate = Math.min(Math.max(profile.rate_pct || 0.75, 0.25), 1);
  const weeklyLossKg = weight * rate / 100;
  const dailyDeficit = weeklyLossKg * 7700 / 7;
  const targetCalories = tdee - dailyDeficit;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    rate_pct: rate,
    weeklyLossKg: Math.round(weeklyLossKg * 100) / 100,
    dailyDeficit: Math.round(dailyDeficit),
    targetCalories: Math.round(targetCalories),
    belowBmr: targetCalories < bmr
  };
}

// ---------- Resumen del día (dashboard en una llamada) ----------
app.get('/api/summary', (req, res) => {
  const date = req.query.date || todayStr();
  const consumed = db.prepare('SELECT COALESCE(SUM(calories), 0) AS c FROM food_entries WHERE date = ?').get(date).c;
  const burned = db.prepare('SELECT COALESCE(SUM(calories), 0) AS c FROM exercise_logs WHERE date = ?').get(date).c;
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() || null;
  const weight = latestWeight();
  const targets = computeTargets(profile, weight);
  res.json({
    date,
    consumed: Math.round(consumed),
    burned: Math.round(burned),
    net: Math.round(consumed - burned),
    weight,
    profile,
    targets
  });
});

// Healthcheck de kamal-proxy
app.get('/up', (req, res) => res.send('OK'));

// ---------- Frontend estático (build de producción / Docker) ----------
const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
