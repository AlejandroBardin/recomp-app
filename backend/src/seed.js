// Datos de ejemplo para probar la app inmediatamente.
// Ejecutar con: npm run seed  (solo carga si no hay datos previos)
const db = require('./db');

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmt(d);
};

const hasFood = db.prepare('SELECT COUNT(*) AS n FROM food_entries').get().n > 0;
const hasWeights = db.prepare('SELECT COUNT(*) AS n FROM weight_entries').get().n > 0;
const hasProfile = !!db.prepare('SELECT id FROM profile WHERE id = 1').get();

if (!hasProfile) {
  db.prepare(`
    INSERT INTO profile (id, height_cm, age, sex, activity, goal_weight, rate_pct)
    VALUES (1, 178, 35, 'M', 1.375, 85, 0.75)
  `).run();
  console.log('Perfil de ejemplo creado (editalo en la pestaña Progreso).');
}

if (!hasWeights) {
  const insert = db.prepare('INSERT INTO weight_entries (date, weight) VALUES (?, ?)');
  insert.run(daysAgo(42), 99.0);
  insert.run(daysAgo(35), 98.7);
  insert.run(daysAgo(28), 98.9);
  insert.run(daysAgo(21), 98.2);
  insert.run(daysAgo(14), 97.8);
  insert.run(daysAgo(7), 97.9);
  insert.run(daysAgo(2), 97.4);
  console.log('Pesos de ejemplo cargados.');
}

if (!hasFood) {
  const today = daysAgo(0);
  const yesterday = daysAgo(1);
  const food = db.prepare(
    'INSERT INTO food_entries (date, time, name, calories, impulsive) VALUES (?, ?, ?, ?, ?)'
  );
  food.run(today, '08:30', 'Café con leche', 80, 0);
  food.run(today, '12:45', 'Milanesa con ensalada', 650, 0);
  food.run(today, '17:20', 'Galletitas', 240, 1);
  food.run(yesterday, '09:00', 'Tostadas con queso', 220, 0);
  food.run(yesterday, '13:30', 'Guiso de lentejas', 550, 0);
  food.run(yesterday, '16:45', 'Alfajor', 190, 1);
  food.run(yesterday, '21:00', 'Pizza (2 porciones)', 560, 0);

  const freq = db.prepare(
    `INSERT INTO frequent_foods (name, calories, times_used) VALUES (?, ?, ?)
     ON CONFLICT(name) DO NOTHING`
  );
  freq.run('Café con leche', 80, 5);
  freq.run('Milanesa con ensalada', 650, 3);
  freq.run('Tostadas con queso', 220, 4);
  freq.run('Guiso de lentejas', 550, 2);
  freq.run('Yogur descremado', 90, 3);
  freq.run('Banana', 105, 4);
  console.log('Comidas de ejemplo cargadas.');
}

const hasLogs = db.prepare('SELECT COUNT(*) AS n FROM exercise_logs').get().n > 0;
if (!hasLogs) {
  const ex = (name) => db.prepare('SELECT * FROM exercises WHERE name = ?').get(name);
  const weight = db.prepare('SELECT weight FROM weight_entries ORDER BY date DESC LIMIT 1').get()?.weight || 97;
  const kcal = (met, mins) => Math.round((met * 3.5 * weight / 200) * mins);
  const log = db.prepare(
    'INSERT INTO exercise_logs (date, exercise_id, exercise_name, sets, reps, minutes, calories) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const dom = ex('Dominadas');
  const bici = ex('Bici fija');
  const flex = ex('Flexiones');
  if (dom) log.run(daysAgo(0), dom.id, dom.name, 3, 6, null, kcal(dom.met, 6));
  if (bici) log.run(daysAgo(0), bici.id, bici.name, null, null, 20, kcal(bici.met, 20));
  if (flex) log.run(daysAgo(1), flex.id, flex.name, 3, 12, null, kcal(flex.met, 6));
  if (dom) log.run(daysAgo(2), dom.id, dom.name, 3, 5, null, kcal(dom.met, 6));
  console.log('Registros de ejercicio de ejemplo cargados.');
}

console.log('Seed listo.');
