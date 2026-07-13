const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const {
  levelFromXp, rankFor, exerciseXp, weightXp, bodyTier,
  SPIRIT_THRESHOLDS, GEAR_THRESHOLDS, tierFromThresholds, PILLARS
} = require('./gamify');

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

// kcal = MET × 3.5 × peso(kg) / 200 × minutos (Compendium of Physical Activities)
// Ejercicios por series: cada rep ≈ 6 s de trabajo efectivo. A 97 kg da
// ~1.2 kcal por dominada, en línea con los estudios (1.0-1.6 kcal/rep a 70 kg).
function estimateCalories(met, weight, { minutes, sets, reps }) {
  const mins = minutes || ((sets || 0) * (reps || 10) * 6) / 60;
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
  const calories = estimateCalories(ex.met, weight, {
    minutes: Number(minutes) || null,
    sets: Number(sets) || null,
    reps: Number(reps) || null
  });
  const info = db.prepare(
    'INSERT INTO exercise_logs (date, exercise_id, exercise_name, sets, reps, minutes, calories) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(date || todayStr(), ex.id, ex.name, Number(sets) || null, Number(reps) || null, Number(minutes) || null, calories);
  const xp = exerciseXp(calories);
  db.prepare('INSERT INTO xp_events (date, pillar, amount, source, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(date || todayStr(), 'fisico', xp, 'exercise', info.lastInsertRowid, ex.name);
  res.json({ ...db.prepare('SELECT * FROM exercise_logs WHERE id = ?').get(info.lastInsertRowid), xp });
});

app.delete('/api/logs/:id', (req, res) => {
  db.prepare('DELETE FROM exercise_logs WHERE id = ?').run(req.params.id);
  db.prepare(`DELETE FROM xp_events WHERE source = 'exercise' AND ref_id = ?`).run(req.params.id);
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
  const row = db.prepare('SELECT * FROM weight_entries WHERE date = ?').get(d);

  // XP por nuevo mínimo histórico (cada kg perdido es un logro desbloqueado)
  db.prepare(`DELETE FROM xp_events WHERE source = 'weight' AND ref_id = ?`).run(row.id);
  const bestPrev = db.prepare('SELECT MIN(weight) AS m FROM weight_entries WHERE date < ?').get(d).m;
  let xp = 0;
  if (bestPrev != null && w < bestPrev) {
    xp = weightXp(bestPrev, w);
    db.prepare('INSERT INTO xp_events (date, pillar, amount, source, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d, 'fisico', xp, 'weight', row.id, `-${(bestPrev - w).toFixed(1)} kg`);
  }
  res.json({ ...row, xp });
});

app.delete('/api/weights/:id', (req, res) => {
  db.prepare('DELETE FROM weight_entries WHERE id = ?').run(req.params.id);
  db.prepare(`DELETE FROM xp_events WHERE source = 'weight' AND ref_id = ?`).run(req.params.id);
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

// ---------- Balance energético acumulado → grasa estimada ----------
// 1 kg de tejido adiposo ≈ 7700 kcal (grasa pura ≈ 9000 kcal/kg, pero el
// tejido que registra la báscula es ~87% grasa).
const KCAL_PER_KG_FAT = 7700;

app.get('/api/energy', (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  if (!profile || !profile.height_cm || !profile.age || !profile.sex || !profile.activity) {
    return res.json({ available: false });
  }
  const since = `-${days} days`;
  const foodByDate = db.prepare(
    `SELECT date, SUM(calories) AS c FROM food_entries WHERE date >= date('now','localtime',?) GROUP BY date`
  ).all(since);
  const burnedByDate = Object.fromEntries(
    db.prepare(
      `SELECT date, SUM(calories) AS c FROM exercise_logs WHERE date >= date('now','localtime',?) GROUP BY date`
    ).all(since).map((r) => [r.date, r.c])
  );
  const weights = db.prepare('SELECT date, weight FROM weight_entries ORDER BY date ASC').all();
  const weightAt = (date) => {
    let w = weights.length ? weights[0].weight : null;
    for (const entry of weights) {
      if (entry.date > date) break;
      w = entry.weight;
    }
    return w;
  };

  const sexTerm = profile.sex === 'F' ? -161 : 5;
  // solo cuentan días con comida registrada: un día sin registros no es un ayuno
  const rows = foodByDate.sort((a, b) => a.date.localeCompare(b.date)).map((f) => {
    const weight = weightAt(f.date);
    if (!weight) return null;
    const bmr = 10 * weight + 6.25 * profile.height_cm - 5 * profile.age + sexTerm;
    const tdee = Math.round(bmr * profile.activity);
    const burned = Math.round(burnedByDate[f.date] || 0);
    const consumed = Math.round(f.c);
    return { date: f.date, consumed, burned, tdee, balance: consumed - tdee - burned };
  }).filter(Boolean);

  const totalBalance = rows.reduce((a, r) => a + r.balance, 0);
  const inPeriod = weights.filter((w) => rows.length && w.date >= rows[0].date);
  res.json({
    available: true,
    days: rows,
    daysCounted: rows.length,
    totalBalance,
    avgBalance: rows.length ? Math.round(totalBalance / rows.length) : 0,
    fatKg: Math.round((-totalBalance / KCAL_PER_KG_FAT) * 1000) / 1000,
    kcalPerKg: KCAL_PER_KG_FAT,
    scaleChangeKg: inPeriod.length >= 2
      ? Math.round((inPeriod[inPeriod.length - 1].weight - inPeriod[0].weight) * 10) / 10
      : null
  });
});

// ---------- Misiones diarias (hábitos) ----------
app.get('/api/habits', (req, res) => {
  const date = req.query.date || todayStr();
  const rows = db.prepare(`
    SELECT h.*, CASE WHEN hl.id IS NULL THEN 0 ELSE 1 END AS done
    FROM habits h
    LEFT JOIN habit_logs hl ON hl.habit_id = h.id AND hl.date = ?
    WHERE h.active = 1
    ORDER BY h.sort, h.id
  `).all(date);
  res.json(rows);
});

app.post('/api/habits', (req, res) => {
  const { name, pillar = 'habitos', xp = 10 } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Falta el nombre' });
  const key = normalize(name.trim())
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `h-${Date.now()}`;
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM habits').get().m;
  const info = db.prepare('INSERT INTO habits (key, pillar, name, xp, sort) VALUES (?, ?, ?, ?, ?)')
    .run(key, pillar, name.trim(), Math.max(5, Math.min(100, Number(xp) || 10)), maxSort + 1);
  res.json(db.prepare('SELECT * FROM habits WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/habits/:id', (req, res) => {
  db.prepare('UPDATE habits SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/habits/:id/toggle', (req, res) => {
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(req.params.id);
  if (!habit) return res.status(404).json({ error: 'No existe' });
  const date = req.body?.date || todayStr();
  const existing = db.prepare('SELECT id FROM habit_logs WHERE date = ? AND habit_id = ?').get(date, habit.id);
  if (existing) {
    db.prepare('DELETE FROM habit_logs WHERE id = ?').run(existing.id);
    db.prepare(`DELETE FROM xp_events WHERE source = 'habit' AND ref_id = ? AND date = ?`).run(habit.id, date);
    return res.json({ done: false, xp: 0 });
  }
  db.prepare('INSERT INTO habit_logs (date, habit_id) VALUES (?, ?)').run(date, habit.id);
  db.prepare('INSERT INTO xp_events (date, pillar, amount, source, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(date, habit.pillar, habit.xp, 'habit', habit.id, habit.name);
  res.json({ done: true, xp: habit.xp });
});

// ---------- Centro de ansiedad ----------
// Registrar el episodio vale XP aunque no se haya resistido: lo que se
// registra se puede mirar de frente, y el patrón horario es oro.
const ANXIETY_XP_RESISTED = 25;
const ANXIETY_XP_LOGGED = 5;

app.post('/api/anxiety', (req, res) => {
  const { intensity, cause, action, resisted, date, time } = req.body;
  const d = date || todayStr();
  const info = db.prepare(
    'INSERT INTO anxiety_episodes (date, time, intensity, cause, action, resisted) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    d,
    time || nowTime(),
    Math.max(1, Math.min(5, Number(intensity) || 3)),
    (cause || '').trim() || null,
    (action || '').trim() || null,
    resisted ? 1 : 0
  );
  const xp = resisted ? ANXIETY_XP_RESISTED : ANXIETY_XP_LOGGED;
  db.prepare('INSERT INTO xp_events (date, pillar, amount, source, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(d, 'habitos', xp, 'anxiety', info.lastInsertRowid,
         resisted ? 'Impulso superado' : 'Episodio registrado');
  res.json({ ...db.prepare('SELECT * FROM anxiety_episodes WHERE id = ?').get(info.lastInsertRowid), xp });
});

app.get('/api/anxiety', (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const episodes = db.prepare(
    `SELECT * FROM anxiety_episodes WHERE date >= date('now','localtime',?) ORDER BY date DESC, time DESC`
  ).all(`-${days} days`);
  const byHour = db.prepare(`
    SELECT CAST(substr(time, 1, 2) AS INTEGER) AS hour, COUNT(*) AS count
    FROM anxiety_episodes GROUP BY hour ORDER BY hour
  `).all();
  const totals = db.prepare(
    'SELECT COUNT(*) AS total, COALESCE(SUM(resisted), 0) AS resisted FROM anxiety_episodes'
  ).get();
  res.json({ episodes, stats: { ...totals, byHour } });
});

app.delete('/api/anxiety/:id', (req, res) => {
  db.prepare('DELETE FROM anxiety_episodes WHERE id = ?').run(req.params.id);
  db.prepare(`DELETE FROM xp_events WHERE source = 'anxiety' AND ref_id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- Historial día por día (todo lo del día en una llamada) ----------
app.get('/api/days', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 120);
  const dates = db.prepare(`
    SELECT date FROM (
      SELECT date FROM food_entries
      UNION SELECT date FROM exercise_logs
      UNION SELECT date FROM habit_logs
      UNION SELECT date FROM weight_entries
      UNION SELECT date FROM anxiety_episodes
      UNION SELECT date FROM xp_events
    ) ORDER BY date DESC LIMIT ?
  `).all(limit).map((r) => r.date);

  const foodsBy = db.prepare('SELECT * FROM food_entries WHERE date = ? ORDER BY time ASC');
  const logsBy = db.prepare('SELECT * FROM exercise_logs WHERE date = ? ORDER BY created_at ASC');
  const habitsBy = db.prepare(
    'SELECT h.name FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE hl.date = ? ORDER BY h.sort'
  );
  const anxietyBy = db.prepare('SELECT * FROM anxiety_episodes WHERE date = ? ORDER BY time ASC');
  const weightBy = db.prepare('SELECT weight FROM weight_entries WHERE date = ?');
  const xpBy = db.prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM xp_events WHERE date = ?');

  res.json(dates.map((date) => {
    const foods = foodsBy.all(date);
    const exercises = logsBy.all(date);
    return {
      date,
      consumed: Math.round(foods.reduce((a, f) => a + f.calories, 0)),
      burned: Math.round(exercises.reduce((a, l) => a + l.calories, 0)),
      weight: weightBy.get(date)?.weight ?? null,
      xp: xpBy.get(date).s,
      foods,
      exercises,
      habits: habitsBy.all(date).map((r) => r.name),
      anxiety: anxietyBy.all(date)
    };
  }));
});

// ---------- Personaje (nivel, XP, tiers del avatar, racha) ----------
function computeStreaks() {
  const dates = db.prepare('SELECT DISTINCT date FROM xp_events ORDER BY date ASC').all().map((r) => r.date);
  const set = new Set(dates);
  const isoOf = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  // racha actual: días consecutivos hasta hoy (o hasta ayer si hoy aún no sumó)
  let current = 0;
  const cursor = new Date();
  if (!set.has(isoOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(isoOf(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dates) {
    const [y, m, day] = d.split('-').map(Number);
    const t = new Date(y, m - 1, day).getTime();
    run = prev != null && t - prev === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { current, best };
}

app.get('/api/character', (req, res) => {
  const date = req.query.date || todayStr();
  const pillars = {};
  for (const p of PILLARS) pillars[p] = { xp: 0, today: 0 };
  for (const r of db.prepare('SELECT pillar, SUM(amount) AS s FROM xp_events GROUP BY pillar').all()) {
    if (pillars[r.pillar]) pillars[r.pillar].xp = r.s;
  }
  for (const r of db.prepare('SELECT pillar, SUM(amount) AS s FROM xp_events WHERE date = ? GROUP BY pillar').all(date)) {
    if (pillars[r.pillar]) pillars[r.pillar].today = r.s;
  }
  const totalXp = Object.values(pillars).reduce((a, p) => a + p.xp, 0);
  const { level, into, next } = levelFromXp(totalXp);

  const first = db.prepare('SELECT weight FROM weight_entries ORDER BY date ASC LIMIT 1').get();
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  const body = bodyTier(first?.weight, latestWeight(), profile?.goal_weight);

  const spiritTier = tierFromThresholds(pillars.oracion.xp, SPIRIT_THRESHOLDS);
  const gearTier = tierFromThresholds(pillars.trabajo.xp, GEAR_THRESHOLDS);

  const accessories = db.prepare(
    'SELECT h.key FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE hl.date = ?'
  ).all(date).map((r) => r.key);

  res.json({
    date,
    totalXp,
    level,
    rank: rankFor(level),
    xpInto: into,
    xpNext: next,
    todayXp: Object.values(pillars).reduce((a, p) => a + p.today, 0),
    streak: computeStreaks(),
    pillars,
    body,
    spirit: { tier: spiritTier, xp: pillars.oracion.xp, nextAt: SPIRIT_THRESHOLDS[spiritTier] ?? null },
    gear: { tier: gearTier, xp: pillars.trabajo.xp, nextAt: GEAR_THRESHOLDS[gearTier] ?? null },
    accessories
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
