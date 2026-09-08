const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { buscarAlimentos } = require('./openfoodfacts');
const { ALIMENTOS_BASE } = require('./alimentos-base');
const { MUSCLES, MUSCLE_KEYS, esMusculoValido } = require('./musculos');
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

// El peso que tenías a esa fecha: el último pesaje anterior o igual. Si el
// registro es previo a tu primer pesaje, se usa ese primero, que es la mejor
// aproximación que hay. Lo usan tanto el alta como el recálculo, para que un
// registro con fecha pasada no dependa de por dónde entró.
function pesoEnFecha(date) {
  const row = db.prepare(
    'SELECT weight FROM weight_entries WHERE date <= ? ORDER BY date DESC LIMIT 1'
  ).get(date);
  if (row) return row.weight;
  const primero = db.prepare('SELECT weight FROM weight_entries ORDER BY date ASC LIMIT 1').get();
  return primero ? primero.weight : null;
}

// kcal = MET × 3.5 × peso(kg) / 200 × minutos (Compendium of Physical Activities)
// Ejercicios por series: cada rep ≈ 6 s de trabajo efectivo. A 97 kg da
// ~1.2 kcal por dominada, en línea con los estudios (1.0-1.6 kcal/rep a 70 kg).
function estimateCalories(met, weight, { minutes, sets, reps }) {
  const mins = minutes || ((sets || 0) * (reps || 10) * 6) / 60;
  if (!mins || !weight) return 0;
  return Math.round((met * 3.5 * weight / 200) * mins);
}

// Un registro guardado sin ningún peso cargado quedó en 0 kcal, y la columna
// `calories` es almacenada, no calculada: sin esto se queda en 0 para siempre
// y arrastra con él el balance energético y la grasa estimada.
//
// Se recalcula con el peso vigente a la fecha del registro (el último anterior
// o igual); para los que son previos a tu primer pesaje se usa ese primero,
// que es la mejor aproximación disponible. El XP se rehace igual que en el
// resto de la app: se borra el evento por source + ref_id y se inserta el nuevo.
function recalcularRegistrosSinPeso() {
  const primero = db.prepare('SELECT weight FROM weight_entries ORDER BY date ASC LIMIT 1').get();
  if (!primero) return 0; // todavía no hay con qué recalcular

  const pendientes = db.prepare(`
    SELECT l.*, e.met FROM exercise_logs l
    LEFT JOIN exercises e ON e.id = l.exercise_id
    WHERE l.calories = 0
  `).all();
  if (pendientes.length === 0) return 0;

  const actualizar = db.prepare('UPDATE exercise_logs SET calories = ? WHERE id = ?');
  const borrarXp = db.prepare(`DELETE FROM xp_events WHERE source = 'exercise' AND ref_id = ?`);
  const insertarXp = db.prepare(
    'INSERT INTO xp_events (date, pillar, amount, source, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const corregir = db.transaction((filas) => {
    let n = 0;
    for (const l of filas) {
      if (l.met == null) continue; // el ejercicio ya no existe: no hay MET con qué calcular
      const peso = pesoEnFecha(l.date);
      const kcal = estimateCalories(l.met, peso, { minutes: l.minutes, sets: l.sets, reps: l.reps });
      if (!(kcal > 0)) continue;
      actualizar.run(kcal, l.id);
      borrarXp.run(l.id);
      insertarXp.run(l.date, 'fisico', exerciseXp(kcal), 'exercise', l.id, l.exercise_name);
      n++;
    }
    return n;
  });

  return corregir(pendientes);
}

// ---------- Ejercicios ----------
app.get('/api/exercises', (req, res) => {
  res.json(db.prepare('SELECT * FROM exercises WHERE active = 1 ORDER BY type, name').all());
});

// ---------- Catálogo de ejercicios ----------
// 876 ejercicios de free-exercise-db con nombre en español, MET y músculos
// (ver scripts/generar-catalogo-ejercicios.js). Es solo para autocompletar el
// alta: nada de esto entra a la base hasta que Ale guarda el ejercicio, y lo
// que guarda queda editable como cualquier otro.
const CATALOGO = require('./catalogo-ejercicios.json');

// Sin acentos y sin mayúsculas: "dominada" tiene que encontrar "Dominadas" y
// "extension" tiene que encontrar "Extensión".
const plano = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const CATALOGO_INDICE = CATALOGO.map((e) => ({ e, busca: `${plano(e.nombre)} ${plano(e.en)}` }));

app.get('/api/exercises/catalog', (req, res) => {
  const q = plano(req.query.q);
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  if (q.length < 2) return res.json([]);

  const palabras = q.split(' ');
  // Los que empiezan con lo tipeado van primero: buscando "press" querés
  // "Press militar" antes que "Extensión de tríceps en polea".
  const encontrados = [];
  for (const { e, busca } of CATALOGO_INDICE) {
    if (!palabras.every((p) => busca.includes(p))) continue;
    const nombre = plano(e.nombre);
    const rango = nombre.startsWith(q) ? 0 : nombre.includes(q) ? 1 : 2;
    // Los estiramientos van al final: buscando "sentadilla" querés la
    // sentadilla con barra, no el "Sit Squat" de la sección de movilidad.
    const prioridad = e.categoria === 'stretching' ? 1 : 0;
    encontrados.push({ e, rango, prioridad, largo: e.nombre.length });
  }
  encontrados.sort((a, b) => a.rango - b.rango || a.prioridad - b.prioridad || a.largo - b.largo);

  // Marcar los que ya están en la lista de ejercicios, para no duplicarlos
  // sin darse cuenta.
  const mios = new Set(
    db.prepare('SELECT name FROM exercises WHERE active = 1').all().map((r) => plano(r.name))
  );

  res.json(encontrados.slice(0, limit).map(({ e }) => ({
    nombre: e.nombre,
    en: e.en,
    tipo: e.tipo,
    met: e.met,
    unidad: e.unidad,
    primary: e.primary,
    secondary: e.secondary,
    equipo: e.equipo,
    categoria: e.categoria,
    nivel: e.nivel,
    ya: mios.has(plano(e.nombre))
  })));
});

// Los músculos llegan como arrays de claves de la taxonomía; se descarta
// cualquiera que no exista en vez de guardar basura que después el mapa no
// sabría dibujar. null = sin asignar (distinto de "no trabaja ninguno").
const limpiarMusculos = (v) => {
  if (!Array.isArray(v)) return null;
  const ok = [...new Set(v.filter((k) => typeof k === 'string' && esMusculoValido(k)))];
  return JSON.stringify(ok);
};

app.post('/api/exercises', (req, res) => {
  const { name, type = 'otro', met = 3, unit = 'minutos', primary_muscles, secondary_muscles } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Falta el nombre' });
  const info = db.prepare(
    'INSERT INTO exercises (name, type, met, unit, primary_muscles, secondary_muscles) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name.trim(), type, Number(met) || 3, unit,
        limpiarMusculos(primary_muscles), limpiarMusculos(secondary_muscles));
  res.json(db.prepare('SELECT * FROM exercises WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/exercises/:id', (req, res) => {
  const { name, type, met, unit, primary_muscles, secondary_muscles } = req.body;
  const ex = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'No existe' });
  db.prepare(
    'UPDATE exercises SET name = ?, type = ?, met = ?, unit = ?, primary_muscles = ?, secondary_muscles = ? WHERE id = ?'
  ).run(name ?? ex.name, type ?? ex.type, met != null ? Number(met) : ex.met, unit ?? ex.unit,
        primary_muscles !== undefined ? limpiarMusculos(primary_muscles) : ex.primary_muscles,
        secondary_muscles !== undefined ? limpiarMusculos(secondary_muscles) : ex.secondary_muscles,
        req.params.id);
  res.json(db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id));
});

app.delete('/api/exercises/:id', (req, res) => {
  db.prepare('UPDATE exercises SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Mapa muscular ----------
// Volumen por músculo en "series equivalentes": un ejercicio por series aporta
// sus series; uno por tiempo, un décimo de sus minutos (30 min de caminata ≈ 3
// series). Es una convención para poder sumar peras con manzanas, no una
// medida fisiológica. El músculo principal cuenta entero y el secundario la
// mitad, que es como se cuentan las "series efectivas".
app.get('/api/muscles', (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const logs = db.prepare(`
    SELECT l.sets, l.minutes, e.primary_muscles, e.secondary_muscles
    FROM exercise_logs l
    LEFT JOIN exercises e ON e.id = l.exercise_id
    WHERE l.date >= date('now','localtime',?)
  `).all(`-${days} days`);

  const volumen = Object.fromEntries(MUSCLE_KEYS.map((k) => [k, 0]));
  let sinAsignar = 0;

  const parse = (s) => { try { return JSON.parse(s) || []; } catch { return []; } };

  for (const l of logs) {
    const unidades = l.sets != null ? l.sets : (l.minutes || 0) / 10;
    if (!(unidades > 0)) continue;
    const prim = parse(l.primary_muscles);
    const sec = parse(l.secondary_muscles);
    if (prim.length === 0 && sec.length === 0) { sinAsignar += unidades; continue; }
    for (const k of prim) if (k in volumen) volumen[k] += unidades;
    for (const k of sec) if (k in volumen) volumen[k] += unidades * 0.5;
  }

  const total = Object.values(volumen).reduce((a, b) => a + b, 0);
  const max = Math.max(0, ...Object.values(volumen));
  const musculos = MUSCLE_KEYS
    .filter((k) => MUSCLES[k].view)
    .map((k) => ({
      key: k,
      label: MUSCLES[k].label,
      view: MUSCLES[k].view,
      value: Math.round(volumen[k] * 10) / 10,
      // Relativo al músculo más trabajado: es lo que colorea el mapa.
      intensity: max > 0 ? volumen[k] / max : 0
    }))
    .sort((a, b) => b.value - a.value);

  res.json({
    days,
    total: Math.round(total * 10) / 10,
    sinAsignar: Math.round(sinAsignar * 10) / 10,
    muscles: musculos,
    untrained: musculos.filter((m) => m.value === 0).map((m) => m.label)
  });
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
  const fecha = date || todayStr();
  const weight = pesoEnFecha(fecha) || 0;
  const calories = estimateCalories(ex.met, weight, {
    minutes: Number(minutes) || null,
    sets: Number(sets) || null,
    reps: Number(reps) || null
  });
  const info = db.prepare(
    'INSERT INTO exercise_logs (date, exercise_id, exercise_name, sets, reps, minutes, calories) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(fecha, ex.id, ex.name, Number(sets) || null, Number(reps) || null, Number(minutes) || null, calories);
  const xp = exerciseXp(calories);
  db.prepare('INSERT INTO xp_events (date, pillar, amount, source, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(fecha, 'fisico', xp, 'exercise', info.lastInsertRowid, ex.name);
  res.json({ ...db.prepare('SELECT * FROM exercise_logs WHERE id = ?').get(info.lastInsertRowid), xp });
});

app.delete('/api/logs/:id', (req, res) => {
  db.prepare('DELETE FROM exercise_logs WHERE id = ?').run(req.params.id);
  db.prepare(`DELETE FROM xp_events WHERE source = 'exercise' AND ref_id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// ---------- Rutinas ----------
// Una rutina agrupa ejercicios con su plan. No registra nada por sí misma: al
// tildar cada ejercicio se crea un exercise_log normal, así el cálculo de
// calorías, el XP y el mapa muscular siguen siendo los de siempre y no hay dos
// caminos que puedan divergir.

const exDeRutina = db.prepare(`
  SELECT re.id, re.exercise_id, re.sets, re.reps, re.minutes, re.sort,
         e.name, e.unit, e.met, e.type
  FROM routine_exercises re
  JOIN exercises e ON e.id = re.exercise_id
  WHERE re.routine_id = ?
  ORDER BY re.sort, re.id
`);

const conEjercicios = (r) => ({ ...r, exercises: exDeRutina.all(r.id) });

// Reemplazo completo en vez de diff: la lista es corta y así no quedan filas
// huérfanas ni hace falta que el cliente mande ids.
const guardarEjercicios = db.transaction((routineId, lista) => {
  db.prepare('DELETE FROM routine_exercises WHERE routine_id = ?').run(routineId);
  const ins = db.prepare(
    'INSERT INTO routine_exercises (routine_id, exercise_id, sets, reps, minutes, sort) VALUES (?, ?, ?, ?, ?, ?)'
  );
  (Array.isArray(lista) ? lista : []).forEach((x, i) => {
    const ex = db.prepare('SELECT id FROM exercises WHERE id = ?').get(x.exercise_id);
    if (!ex) return; // ignora ejercicios que ya no existen
    ins.run(routineId, x.exercise_id,
            Number(x.sets) || null, Number(x.reps) || null, Number(x.minutes) || null, i);
  });
});

// weekday: 0 = domingo … 6 = sábado (igual que Date.getDay(), para no tener que
// convertir de un lado al otro). null = sin día fijo.
const limpiarDia = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
};

app.get('/api/routines', (req, res) => {
  const rows = db.prepare('SELECT * FROM routines WHERE active = 1 ORDER BY sort, id').all();
  res.json(rows.map(conEjercicios));
});

// Lo que toca en una fecha: las rutinas de ese día de la semana, marcando qué
// ejercicios ya registraste para no hacerlos dos veces.
app.get('/api/routines/today', (req, res) => {
  const date = req.query.date || todayStr();
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();

  const hechos = new Set(
    db.prepare('SELECT exercise_id FROM exercise_logs WHERE date = ?').all(date).map((r) => r.exercise_id)
  );
  const rutinas = db.prepare(
    'SELECT * FROM routines WHERE active = 1 AND weekday = ? ORDER BY sort, id'
  ).all(weekday).map((r) => {
    const exercises = exDeRutina.all(r.id).map((e) => ({ ...e, done: hechos.has(e.exercise_id) }));
    return { ...r, exercises, pendientes: exercises.filter((e) => !e.done).length };
  });

  res.json({ date, weekday, routines: rutinas });
});

app.post('/api/routines', (req, res) => {
  const { name, weekday, exercises } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Falta el nombre' });
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM routines').get().m;
  const info = db.prepare('INSERT INTO routines (name, weekday, sort) VALUES (?, ?, ?)')
    .run(name.trim(), limpiarDia(weekday), maxSort + 1);
  guardarEjercicios(info.lastInsertRowid, exercises);
  res.json(conEjercicios(db.prepare('SELECT * FROM routines WHERE id = ?').get(info.lastInsertRowid)));
});

app.put('/api/routines/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM routines WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'No existe' });
  const { name, weekday, exercises } = req.body;
  db.prepare('UPDATE routines SET name = ?, weekday = ? WHERE id = ?')
    .run(name?.trim() || r.name, weekday !== undefined ? limpiarDia(weekday) : r.weekday, r.id);
  if (exercises !== undefined) guardarEjercicios(r.id, exercises);
  res.json(conEjercicios(db.prepare('SELECT * FROM routines WHERE id = ?').get(r.id)));
});

// Baja lógica, como el resto de la app: los registros que salieron de esta
// rutina son exercise_logs comunes y no se tocan.
app.delete('/api/routines/:id', (req, res) => {
  db.prepare('UPDATE routines SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Comidas ----------
app.get('/api/food', (req, res) => {
  const date = req.query.date || todayStr();
  res.json(db.prepare('SELECT * FROM food_entries WHERE date = ? ORDER BY time DESC, id DESC').all(date));
});

// Unidades de carga. 'g' y 'ml' se cuentan por 100 (como viene la etiqueta);
// 'unidad' y 'porcion', por pieza. `porcion` no lleva acento en la base para
// no depender de la codificación de la columna.
const UNIDADES = ['g', 'ml', 'unidad', 'porcion'];
const porCien = (u) => u === 'g' || u === 'ml';

const numeroOpcional = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
};

app.post('/api/food', (req, res) => {
  const { name, calories, impulsive, date, time, qty, unit, base } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Falta el nombre' });
  const kcal = Number(calories);
  if (!Number.isFinite(kcal) || kcal < 0) return res.status(400).json({ error: 'Calorías inválidas' });

  const unidad = UNIDADES.includes(unit) ? unit : null;
  const cantidad = numeroOpcional(qty);
  // Gramos totales solo cuando la unidad los da directo: de "2 porciones" no
  // se puede inferir un peso, y un número inventado ensucia el histórico.
  const gramos = unidad === 'g' && cantidad != null ? cantidad : null;

  const macros = {
    protein: numeroOpcional(req.body.protein),
    fat: numeroOpcional(req.body.fat),
    carbs: numeroOpcional(req.body.carbs),
    fiber: numeroOpcional(req.body.fiber)
  };

  const info = db.prepare(`
    INSERT INTO food_entries (date, time, name, calories, impulsive, qty, unit, grams, protein, fat, carbs, fiber)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date || todayStr(), time || nowTime(), name.trim(), Math.round(kcal), impulsive ? 1 : 0,
         cantidad, unidad, gramos, macros.protein, macros.fat, macros.carbs, macros.fiber);

  // Alimentos frecuentes: además de las kcal de la última carga se guarda la
  // referencia nutricional, así la próxima vez alcanza con poner la cantidad.
  // Si el alta no trae referencia, la que ya estaba guardada no se pisa.
  const BASES = ['100g', 'unidad', 'porcion'];
  const ref = base && BASES.includes(base.unit) && numeroOpcional(base.kcal) != null ? base : null;
  const baseUnit = ref ? ref.unit : null;

  db.prepare(`
    INSERT INTO frequent_foods (name, calories, times_used, last_used,
                                base_unit, base_kcal, base_protein, base_fat, base_carbs, base_fiber, base_label)
    VALUES (?, ?, 1, datetime('now','localtime'), ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      calories = excluded.calories,
      times_used = times_used + 1,
      last_used = excluded.last_used,
      base_unit = COALESCE(excluded.base_unit, base_unit),
      base_kcal = COALESCE(excluded.base_kcal, base_kcal),
      base_protein = COALESCE(excluded.base_protein, base_protein),
      base_fat = COALESCE(excluded.base_fat, base_fat),
      base_carbs = COALESCE(excluded.base_carbs, base_carbs),
      base_fiber = COALESCE(excluded.base_fiber, base_fiber),
      base_label = COALESCE(excluded.base_label, base_label)
  `).run(name.trim(), Math.round(kcal), baseUnit,
         baseUnit ? numeroOpcional(ref.kcal) : null,
         baseUnit ? numeroOpcional(ref.protein) : null,
         baseUnit ? numeroOpcional(ref.fat) : null,
         baseUnit ? numeroOpcional(ref.carbs) : null,
         baseUnit ? numeroOpcional(ref.fiber) : null,
         baseUnit && typeof ref.label === 'string' ? ref.label.slice(0, 40) : null);

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

app.get('/api/foods/suggest', async (req, res) => {
  const texto = (req.query.q || '').trim();
  const q = normalize(texto);
  const rows = db.prepare(`
    SELECT name, calories, base_unit, base_kcal, base_protein, base_fat, base_carbs, base_fiber, base_label
    FROM frequent_foods ORDER BY times_used DESC, last_used DESC
  `).all();
  const matches = q ? rows.filter((r) => normalize(r.name).includes(q)) : rows;

  // Los tuyos primero y siempre: son los que de verdad comés, ya tienen las
  // calorías de la porción que solés servirte, y salen de la base local
  // aunque Open Food Facts esté caído. Los que ya cargaste con referencia
  // (por 100 g o por unidad) la traen puesta y solo hay que poner cuánto.
  const locales = matches.slice(0, 6).map((r) => ({
    source: 'local',
    name: r.name,
    calories: r.calories,
    base: r.base_unit
      ? {
        unit: r.base_unit,
        kcal: r.base_kcal,
        protein: r.base_protein,
        fat: r.base_fat,
        carbs: r.base_carbs,
        fiber: r.base_fiber,
        label: r.base_label
      }
      : null
  }));

  const yaEstan = new Set(locales.map((l) => normalize(l.name)));

  // Alimentos comunes con macros: un huevo, un tomate, una cucharada de
  // aceite. Van después de los tuyos y antes de Open Food Facts, que sirve
  // para productos envasados pero no tiene comida suelta.
  const base = q
    ? ALIMENTOS_BASE
      .filter((a) => normalize(a.name).includes(q) && !yaEstan.has(normalize(a.name)))
      .sort((a, b) => normalize(a.name).indexOf(q) - normalize(b.name).indexOf(q))
      .slice(0, 6)
      .map((a) => ({ source: 'base', ...a }))
    : [];
  for (const a of base) yaEstan.add(normalize(a.name));

  const externos = (await buscarAlimentos(texto))
    .filter((e) => !yaEstan.has(normalize(e.name)));

  res.json([...locales, ...base, ...externos.slice(0, 6)]);
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

  // Cargar un peso es lo que desbloquea el cálculo de calorías: los registros
  // de ejercicio que habían quedado en 0 por no tenerlo se arreglan acá.
  const recalculados = recalcularRegistrosSinPeso();

  // XP por nuevo mínimo histórico (cada kg perdido es un logro desbloqueado)
  db.prepare(`DELETE FROM xp_events WHERE source = 'weight' AND ref_id = ?`).run(row.id);
  const bestPrev = db.prepare('SELECT MIN(weight) AS m FROM weight_entries WHERE date < ?').get(d).m;
  let xp = 0;
  if (bestPrev != null && w < bestPrev) {
    xp = weightXp(bestPrev, w);
    db.prepare('INSERT INTO xp_events (date, pillar, amount, source, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)')
      .run(d, 'fisico', xp, 'weight', row.id, `-${(bestPrev - w).toFixed(1)} kg`);
  }
  res.json({ ...row, xp, recalculados });
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
    belowBmr: targetCalories < bmr,
    // En déficit la proteína es lo que decide si lo que baja es grasa o
    // músculo. 1.8 g/kg es el piso habitual para un recorte agresivo; el
    // rango de trabajo va hasta ~2.2.
    proteinTarget: Math.round(weight * 1.8),
    proteinRange: [Math.round(weight * 1.6), Math.round(weight * 2.2)]
  };
}

// Macros del día. `cubierto` es la parte de las calorías que tiene macros
// cargados: sin eso, un total de "40 g de proteína" no se distingue de "comí
// poca proteína" cuando en realidad es "cargué poco". Es un piso, no un dato.
function macrosDelDia(date) {
  const r = db.prepare(`
    SELECT
      COALESCE(SUM(protein), 0) AS protein,
      COALESCE(SUM(fat), 0)     AS fat,
      COALESCE(SUM(carbs), 0)   AS carbs,
      COALESCE(SUM(fiber), 0)   AS fiber,
      COALESCE(SUM(CASE WHEN protein IS NOT NULL OR fat IS NOT NULL OR carbs IS NOT NULL
                        THEN calories ELSE 0 END), 0) AS kcalConMacros,
      COALESCE(SUM(calories), 0) AS kcal
    FROM food_entries WHERE date = ?
  `).get(date);
  const redondear = (n) => Math.round(n * 10) / 10;
  return {
    protein: redondear(r.protein),
    fat: redondear(r.fat),
    carbs: redondear(r.carbs),
    fiber: redondear(r.fiber),
    kcalConMacros: Math.round(r.kcalConMacros),
    cubierto: r.kcal > 0 ? Math.round((r.kcalConMacros / r.kcal) * 100) : null
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
  const macros = macrosDelDia(date);
  res.json({
    date,
    consumed: Math.round(consumed),
    burned: Math.round(burned),
    net: Math.round(consumed - burned),
    weight,
    profile,
    targets,
    macros,
    // Gramos por kg de peso: es la forma en que se leen los macros en
    // recomposición, no en gramos absolutos.
    perKg: weight
      ? {
        kcal: Math.round((consumed / weight) * 10) / 10,
        protein: Math.round((macros.protein / weight) * 100) / 100,
        fat: Math.round((macros.fat / weight) * 100) / 100,
        carbs: Math.round((macros.carbs / weight) * 100) / 100
      }
      : null
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

// Backfill al arrancar: si ya hay peso cargado y quedaron registros en 0 de
// antes de este arreglo, se corrigen sin esperar a que cargues un peso nuevo.
const corregidos = recalcularRegistrosSinPeso();
if (corregidos > 0) console.log(`Recalculadas las calorías de ${corregidos} registro(s) de ejercicio`);

app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
