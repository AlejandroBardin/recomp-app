#!/usr/bin/env node
// Genera backend/src/catalogo-ejercicios.json a partir de free-exercise-db.
//
//   node scripts/generar-catalogo-ejercicios.js [ruta/a/free-exercise-db]
//
// El dataset (github.com/yuhonas/free-exercise-db, Unlicense) trae 876
// ejercicios en inglés con músculos, equipo, categoría y nivel, pero sin MET
// y sin nombres en español. Este script agrega las dos cosas y deja un JSON
// chico que el backend carga en memoria para el autocompletado.
//
// La traducción es por reglas, no palabra por palabra: se busca el movimiento
// (el núcleo del nombre), después los modificadores, y se arma la frase en
// orden español — "Barbell Incline Bench Press" → "Press de banca inclinado
// con barra". Lo que no se reconoce queda en inglés, y el nombre original
// viaja igual en el catálogo, así que la búsqueda encuentra el ejercicio
// aunque la traducción no sea perfecta.

const fs = require('fs');
const path = require('path');

const RAIZ = process.argv[2] || path.join(__dirname, '..', '..', 'free-exercise-db');
const ORIGEN = path.join(RAIZ, 'dist', 'exercises.json');
const DESTINO = path.join(__dirname, '..', 'backend', 'src', 'catalogo-ejercicios.json');

// ---------- Diccionarios ----------

// Movimientos: el núcleo del nombre. Se busca el match más largo, así que
// "bench press" gana sobre "press" y "leg curl" sobre "curl".
const MOVIMIENTOS = {
  // empujes
  'bench press': 'press de banca',
  'chest press': 'press de pecho',
  'shoulder press': 'press militar',
  'military press': 'press militar',
  'overhead press': 'press sobre la cabeza',
  'push press': 'push press',
  'floor press': 'press en el suelo',
  'leg press': 'prensa de piernas',
  'calf press': 'press de gemelos',
  'chest dip': 'fondos en paralelas',
  'bench dip': 'fondos en banco',
  'dips': 'fondos',
  'dip': 'fondos',
  'push-up': 'flexiones',
  'push up': 'flexiones',
  'pushup': 'flexiones',
  'pushups': 'flexiones',
  'press': 'press',

  // tirones
  'pull-up': 'dominadas',
  'pull up': 'dominadas',
  'pullup': 'dominadas',
  'pullups': 'dominadas',
  'chin-up': 'dominadas supinas',
  'chin up': 'dominadas supinas',
  'chinup': 'dominadas supinas',
  'muscle up': 'muscle-up',
  'upright row': 'remo al mentón',
  'inverted row': 'remo invertido',
  'row': 'remo',
  'rows': 'remo',
  'pulldown': 'jalón al pecho',
  'pulldowns': 'jalón al pecho',
  'pullover': 'pullover',
  'face pull': 'face pull',
  'pull through': 'pull through',
  'lat pull': 'jalón al pecho',

  // piernas y cadera
  'hack squat': 'sentadilla hack',
  'front squat': 'sentadilla frontal',
  'overhead squat': 'sentadilla sobre la cabeza',
  'split squat': 'zancada estática',
  'squat': 'sentadilla',
  'squats': 'sentadilla',
  'romanian deadlift': 'peso muerto rumano',
  'sumo deadlift': 'peso muerto sumo',
  'deadlift': 'peso muerto',
  'good morning': 'buenos días',
  'good mornings': 'buenos días',
  'lunge': 'zancada',
  'lunges': 'zancada',
  'step-up': 'subida al cajón',
  'step up': 'subida al cajón',
  'hip thrust': 'empuje de cadera',
  'glute bridge': 'puente de glúteos',
  'bridge': 'puente',
  'leg extension': 'extensión de piernas',
  'leg curl': 'curl femoral',
  'calf raise': 'elevación de talones',
  'calf raises': 'elevación de talones',
  'adduction': 'aducción',
  'abduction': 'abducción',

  // brazos
  'preacher curl': 'curl en banco Scott',
  'hammer curl': 'curl martillo',
  'concentration curl': 'curl concentrado',
  'wrist curl': 'curl de muñeca',
  'spider curl': 'curl araña',
  'drag curl': 'curl drag',
  'curl': 'curl',
  'curls': 'curl',
  'pushdown': 'extensión de tríceps en polea',
  'kickback': 'patada de tríceps',
  'kickbacks': 'patada de tríceps',
  'skullcrusher': 'press francés',
  'triceps extension': 'extensión de tríceps',
  'tricep extension': 'extensión de tríceps',
  'extension': 'extensión',
  'extensions': 'extensión',

  // hombros y espalda alta
  'lateral raise': 'elevación lateral',
  'front raise': 'elevación frontal',
  'rear delt raise': 'elevación posterior',
  'shrug': 'encogimiento de hombros',
  'shrugs': 'encogimiento de hombros',
  'crossover': 'cruce de poleas',
  'flye': 'aperturas',
  'flyes': 'aperturas',
  'fly': 'aperturas',
  'flys': 'aperturas',
  'external rotation': 'rotación externa',
  'internal rotation': 'rotación interna',
  'rotation': 'rotación',
  'circles': 'círculos',

  // core
  'sit-up': 'abdominales',
  'sit up': 'abdominales',
  'situp': 'abdominales',
  'sit-ups': 'abdominales',
  'crunch': 'crunch',
  'crunches': 'crunch',
  'plank': 'plancha',
  'leg raise': 'elevación de piernas',
  'leg raises': 'elevación de piernas',
  'knee raise': 'elevación de rodillas',
  'hyperextension': 'hiperextensión',
  'back extension': 'hiperextensión',
  'rollout': 'rueda abdominal',
  'russian twist': 'giro ruso',
  'twist': 'giro',
  'twists': 'giro',
  'woodchop': 'leñador',
  'chop': 'leñador',
  'windmill': 'molino',
  'v-up': 'V-up',
  'toe touch': 'toque de puntas',
  'scissor kick': 'tijeras',
  'flutter kick': 'aleteo',
  'bicycle': 'bicicleta',

  // olímpicos y potencia
  'clean and jerk': 'cargada y envión',
  'power clean': 'cargada de potencia',
  'hang clean': 'cargada desde suspensión',
  'clean': 'cargada',
  'snatch': 'arranque',
  'jerk': 'envión',
  'thruster': 'thruster',
  'swing': 'swing',
  'turkish get-up': 'levantada turca',
  'get-up': 'levantada',
  'high pull': 'tirón alto',

  // pliometría y cardio
  'box jump': 'salto al cajón',
  'depth jump': 'salto en profundidad',
  'jump': 'salto',
  'jumps': 'salto',
  'jumping jack': 'jumping jacks',
  'burpee': 'burpee',
  'burpees': 'burpees',
  'mountain climber': 'escalador',
  'sprint': 'sprint',
  'sprints': 'sprint',
  'run': 'correr',
  'running': 'correr',
  'jog': 'trote',
  'walk': 'caminata',
  'walking': 'caminata',
  'rope jumping': 'saltar la cuerda',
  'skipping': 'skipping',
  'hop': 'saltos',
  'hops': 'saltos',
  'bound': 'saltos largos',
  'throw': 'lanzamiento',
  'toss': 'lanzamiento',
  'slam': 'golpe contra el suelo',
  'sled drag': 'arrastre de trineo',
  'sled push': 'empuje de trineo',
  'drag': 'arrastre',
  'carry': 'traslado',
  'farmer\'s walk': 'paseo del granjero',
  'lift': 'levantamiento',
  'raise': 'elevación',
  'raises': 'elevación',
  'pull': 'tirón',
  'kick': 'patada',
  'hold': 'isométrico',

  // movilidad
  'stretch': 'estiramiento',
  'smr': 'automasaje'
};

// Partes del cuerpo: sirven de complemento ("hamstring stretch" →
// "estiramiento de isquiotibiales") y dentro de nombres compuestos.
const CUERPO = {
  'lower back': 'lumbares',
  'upper back': 'espalda alta',
  'middle back': 'espalda media',
  'it band': 'banda iliotibial',
  'iliotibial tract': 'banda iliotibial',
  'hip flexor': 'flexor de cadera',
  'latissimus dorsi': 'dorsales',
  'anterior tibialis': 'tibial anterior',
  'posterior tibialis': 'tibial posterior',
  'rotator cuff': 'manguito rotador',
  hamstring: 'isquiotibiales',
  hamstrings: 'isquiotibiales',
  quad: 'cuádriceps',
  quads: 'cuádriceps',
  quadriceps: 'cuádriceps',
  calf: 'gemelos',
  calves: 'gemelos',
  chest: 'pecho',
  lat: 'dorsales',
  lats: 'dorsales',
  groin: 'aductores',
  adductor: 'aductores',
  abductor: 'abductores',
  hip: 'cadera',
  hips: 'cadera',
  shoulder: 'hombro',
  shoulders: 'hombros',
  triceps: 'tríceps',
  tricep: 'tríceps',
  biceps: 'bíceps',
  bicep: 'bíceps',
  brachialis: 'braquial',
  neck: 'cuello',
  glute: 'glúteos',
  glutes: 'glúteos',
  spine: 'columna',
  ankle: 'tobillo',
  wrist: 'muñeca',
  forearm: 'antebrazo',
  forearms: 'antebrazos',
  back: 'espalda',
  ab: 'abdomen',
  abs: 'abdomen',
  abdominal: 'abdominal',
  oblique: 'oblicuos',
  obliques: 'oblicuos',
  delt: 'deltoides',
  deltoid: 'deltoides',
  trap: 'trapecio',
  traps: 'trapecios',
  piriformis: 'piriforme',
  peroneals: 'peroneos',
  thigh: 'muslo',
  knee: 'rodilla',
  knees: 'rodillas',
  leg: 'pierna',
  legs: 'piernas',
  arm: 'brazo',
  arms: 'brazos',
  hand: 'mano',
  hands: 'manos',
  foot: 'pie',
  feet: 'pies',
  elbow: 'codo',
  elbows: 'codos',
  head: 'cabeza',
  torso: 'torso',
  body: 'cuerpo'
};

// Modificadores: van después del movimiento, en el orden en que aparecen.
const MODIFICADORES = {
  'behind the neck': 'tras nuca',
  'behind neck': 'tras nuca',
  'behind head': 'tras nuca',
  'close-grip': 'agarre cerrado',
  'close grip': 'agarre cerrado',
  'wide-grip': 'agarre ancho',
  'wide grip': 'agarre ancho',
  'medium-grip': 'agarre medio',
  'medium grip': 'agarre medio',
  'narrow grip': 'agarre estrecho',
  'reverse grip': 'agarre invertido',
  'neutral grip': 'agarre neutro',
  'mixed grip': 'agarre mixto',
  'one arm': 'a un brazo',
  'one-arm': 'a un brazo',
  'single-arm': 'a un brazo',
  'single arm': 'a un brazo',
  'two-arm': 'a dos brazos',
  'two arm': 'a dos brazos',
  'one leg': 'a una pierna',
  'one-legged': 'a una pierna',
  'single leg': 'a una pierna',
  'single-leg': 'a una pierna',
  'bent over': 'inclinado',
  'bent-over': 'inclinado',
  'bent-knee': 'rodillas flexionadas',
  'straight leg': 'piernas rectas',
  'straight-leg': 'piernas rectas',
  'stiff leg': 'piernas rígidas',
  'stiff-legged': 'piernas rígidas',
  'wide stance': 'postura ancha',
  'narrow stance': 'postura estrecha',
  'split stance': 'postura dividida',
  'palms up': 'palmas arriba',
  'palms down': 'palmas abajo',
  'palms in': 'palmas enfrentadas',
  'palm up': 'palmas arriba',
  'palm down': 'palmas abajo',
  'against wall': 'contra la pared',
  'on the floor': 'en el suelo',
  'band assisted': 'asistido con banda',
  'body weight': 'con peso corporal',
  'bodyweight': 'con peso corporal',
  'cross body': 'cruzado',
  seated: 'sentado',
  standing: 'de pie',
  lying: 'tumbado',
  incline: 'inclinado',
  decline: 'declinado',
  reverse: 'inverso',
  alternating: 'alternado',
  alternate: 'alternado',
  kneeling: 'de rodillas',
  prone: 'boca abajo',
  supine: 'boca arriba',
  weighted: 'con lastre',
  hanging: 'colgado',
  suspended: 'en suspensión',
  assisted: 'asistido',
  isometric: 'isométrico',
  explosive: 'explosivo',
  dynamic: 'dinámico',
  static: 'estático',
  elevated: 'elevado',
  overhead: 'sobre la cabeza',
  front: 'frontal',
  rear: 'posterior',
  side: 'lateral',
  lateral: 'lateral',
  vertical: 'vertical',
  horizontal: 'horizontal',
  wall: 'en la pared',
  floor: 'en el suelo',
  box: 'en cajón',
  chair: 'en silla',
  bench: 'en banco',
  sumo: 'sumo',
  split: 'dividido',
  full: 'completo',
  half: 'medio',
  low: 'bajo',
  high: 'alto',
  wide: 'ancho',
  close: 'cerrado',
  narrow: 'estrecho',
  double: 'doble',
  single: 'a un lado',
  power: 'de potencia',
  hang: 'desde suspensión',
  walking: 'caminando',
  jumping: 'con salto',
  rotating: 'con rotación',
  underhand: 'agarre supino',
  overhand: 'agarre prono',
  'v-bar': 'con barra en V',
  'v bar': 'con barra en V',
  rope: 'con cuerda',
  plate: 'con disco',
  chains: 'con cadenas',
  smith: 'en multipower',
  leverage: 'en máquina de palanca',
  pulley: 'en polea',
  band: 'con banda',
  bands: 'con bandas',
  ball: 'con pelota',
  cone: 'con conos',
  sled: 'con trineo',
  treadmill: 'en cinta',
  rack: 'en rack',
  blocks: 'desde bloques',
  partner: 'con compañero',
  barbell: 'con barra',
  barbells: 'con barra',
  dumbbell: 'con mancuernas',
  dumbbells: 'con mancuernas',
  kettlebell: 'con kettlebell',
  kettlebells: 'con kettlebell',
  cable: 'en polea',
  cables: 'en polea',
  machine: 'en máquina',
  intermediate: 'intermedio',
  advanced: 'avanzado',
  beginner: 'inicial'
};

// Equipo: viene del campo `equipment` del dataset, no del nombre.
const EQUIPO = {
  'body only': '',
  barbell: 'con barra',
  dumbbell: 'con mancuernas',
  cable: 'en polea',
  machine: 'en máquina',
  kettlebells: 'con kettlebell',
  bands: 'con banda',
  'medicine ball': 'con balón medicinal',
  'exercise ball': 'con fitball',
  'e-z curl bar': 'con barra Z',
  'foam roll': 'con rodillo',
  other: '',
  null: ''
};

// Nombres que las reglas dejan feos y que igual se van a usar seguido.
const A_MANO = {
  Pullups: 'Dominadas',
  'Chin-Up': 'Dominadas supinas',
  Pushups: 'Flexiones',
  Dips: 'Fondos',
  'Bench Dips': 'Fondos en banco',
  'Chair Dips': 'Fondos en silla',
  'Bodyweight Squat': 'Sentadilla con peso corporal',
  Plank: 'Plancha',
  'Side Bridge': 'Plancha lateral',
  Burpee: 'Burpee',
  Crunches: 'Abdominales crunch',
  'Hanging Leg Raise': 'Elevación de piernas colgado',
  'Hanging Knee Raise': 'Elevación de rodillas colgado',
  'Barbell Bench Press - Medium Grip': 'Press de banca con barra',
  'Barbell Squat': 'Sentadilla con barra',
  'Barbell Deadlift': 'Peso muerto con barra',
  'Barbell Curl': 'Curl con barra',
  'Dumbbell Bench Press': 'Press de banca con mancuernas',
  'Dumbbell Bicep Curl': 'Curl de bíceps con mancuernas',
  'Standing Military Press': 'Press militar de pie',
  'Wide-Grip Lat Pulldown': 'Jalón al pecho agarre ancho',
  'Seated Cable Rows': 'Remo sentado en polea',
  'Bent Over Barbell Row': 'Remo con barra inclinado',
  'Leg Press': 'Prensa de piernas',
  'Standing Calf Raises': 'Elevación de talones de pie',
  'Jumping rope': 'Saltar la cuerda',
  Running: 'Correr',
  'Walking, Treadmill': 'Caminata en cinta',
  'Stationary Bike Run V. 3': 'Bicicleta fija',
  Elliptical: 'Elíptica',
  'Rowing, Stationary': 'Remo ergómetro',
  Swimming: 'Natación'
};

// ---------- MET por tipo de ejercicio ----------
// Compendium of Physical Activities (Ainsworth 2011): calistenia vigorosa
// (dominadas, flexiones) 8.0; entrenamiento con pesas vigoroso 6.0; series de
// aislamiento 3.5; estiramientos 2.3. El cardio va por palabra clave porque
// entre caminar y correr hay un factor 3.
const MET_CARDIO = [
  [/rope|skipping/, 11],
  [/sprint|run|jog/, 9],
  [/stair|climb/, 8],
  [/bike|cycl|spinning/, 7],
  [/row/, 7],
  [/swim/, 6],
  [/elliptical/, 5],
  [/walk|treadmill/, 4]
];

function metDe(ex) {
  const n = ex.name.toLowerCase();
  if (ex.category === 'stretching') return 2.3;
  if (ex.category === 'cardio') {
    for (const [re, met] of MET_CARDIO) if (re.test(n)) return met;
    return 7;
  }
  if (ex.category === 'plyometrics') return 8;
  if (ex.category === 'strongman') return 8;
  if (ex.category === 'powerlifting' || ex.category === 'olympic weightlifting') return 6;
  // strength
  if (ex.equipment === 'body only') return ex.mechanic === 'isolation' ? 4 : 8;
  return ex.mechanic === 'isolation' ? 3.5 : 5;
}

// Los tipos son los que ya usa la app, más dos que faltaban.
const SUPERIOR = new Set(['chest', 'lats', 'middle back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'neck']);
const INFERIOR = new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors']);

function tipoDe(ex) {
  if (ex.category === 'stretching') return 'movilidad';
  if (ex.category === 'cardio') return 'cardio bajo impacto';
  const m = ex.primaryMuscles[0];
  if (m === 'abdominals' || m === 'lower back') return 'core';
  if (SUPERIOR.has(m)) return 'tren superior';
  if (INFERIOR.has(m)) return 'tren inferior';
  return 'otro';
}

const unidadDe = (ex) =>
  ex.category === 'cardio' || ex.category === 'stretching' ? 'minutos' : 'series';

// ---------- Traducción ----------

// Match más largo primero: sin esto "press" se comería "bench press".
const normalizar = (s) =>
  s.toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\s*[-/]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Las claves se normalizan igual que los nombres: así 'one-arm' y 'one arm'
// son la misma entrada y ninguna queda muerta por un guion.
const normalizarDic = (dic) => {
  const out = {};
  for (const [k, v] of Object.entries(dic)) out[normalizar(k)] = v;
  return out;
};
const porLargo = (dic) => Object.keys(dic).sort((a, b) => b.split(' ').length - a.split(' ').length || b.length - a.length);

// Busca `frase` como secuencia completa de palabras dentro de `tokens`.
// Devuelve el índice donde arranca, o -1.
const MOV = normalizarDic(MOVIMIENTOS);
const CUERPO_N = normalizarDic(CUERPO);
const MOD = normalizarDic(MODIFICADORES);
const MOV_CLAVES = porLargo(MOV);
const CUERPO_CLAVES = porLargo(CUERPO_N);
const MOD_CLAVES = porLargo(MOD);

function buscarFrase(tokens, frase) {
  const partes = frase.split(' ');
  for (let i = 0; i + partes.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < partes.length; j++) {
      if (tokens[i + j] !== partes[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

const capitalizar = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Preposiciones y artículos: no aportan nada al nombre en español.
const RELLENO = new Set([
  'with', 'the', 'a', 'an', 'and', 'to', 'on', 'in', 'of', 'or', 'from', 'for',
  'your', 'over', 'off', 'up', 'down', 'at', 'by', 'between', 'each', 'exercise'
]);

function traducir(ex) {
  if (A_MANO[ex.name]) return A_MANO[ex.name];

  const tokens = normalizar(ex.name).split(' ');
  const usados = new Array(tokens.length).fill(false);
  // Los tokens ya consumidos se tapan con un centinela que no puede aparecer
  // en un nombre, para que no los vuelva a matchear otro diccionario.
  const libres = () => tokens.map((t, k) => (usados[k] ? '' : t));
  const marcar = (i, largo) => { for (let j = 0; j < largo; j++) usados[i + j] = true; };

  // 1. El movimiento: el match más largo del diccionario.
  let movimiento = null;
  let posMovimiento = -1;
  for (const clave of MOV_CLAVES) {
    const i = buscarFrase(libres(), clave);
    if (i === -1) continue;
    movimiento = MOV[clave];
    posMovimiento = i;
    marcar(i, clave.split(' ').length);
    break;
  }

  // 2. Modificadores. Van antes que las partes del cuerpo porque "one arm"
  //    tiene que ganarle a "arm".
  const mods = [];
  for (const clave of MOD_CLAVES) {
    let i;
    while ((i = buscarFrase(libres(), clave)) !== -1) {
      marcar(i, clave.split(' ').length);
      mods.push({ i, es: MOD[clave] });
    }
  }

  // 3. Partes del cuerpo. Pegada justo antes del movimiento es su complemento
  //    ("hamstring stretch" -> "estiramiento de isquiotibiales").
  const cuerpos = [];
  let complemento = null;
  for (const clave of CUERPO_CLAVES) {
    let i;
    while ((i = buscarFrase(libres(), clave)) !== -1) {
      const largo = clave.split(' ').length;
      marcar(i, largo);
      if (posMovimiento !== -1 && i + largo === posMovimiento && !complemento) complemento = CUERPO_N[clave];
      else cuerpos.push({ i, es: CUERPO_N[clave] });
    }
  }

  // 4. Lo que quedó sin reconocer, salvo palabras de relleno.
  const sueltos = [];
  tokens.forEach((t, i) => {
    if (!usados[i] && !RELLENO.has(t)) sueltos.push({ i, es: t });
  });

  if (!movimiento) {
    // Sin movimiento reconocido no hay frase que armar: se deja el nombre
    // original. Es mejor un nombre en inglés que uno inventado.
    return ex.name;
  }

  const nucleo = complemento ? `${movimiento} de ${complemento}` : movimiento;
  const cola = [...mods, ...cuerpos, ...sueltos].sort((a, b) => a.i - b.i).map((x) => x.es);

  const equipo = EQUIPO[String(ex.equipment)] ?? '';
  // Duplicados: el equipo suele estar dicho también en el nombre
  // ("Smith Machine Squat"), y "Side Lateral Raise" repite "lateral".
  const partes = [];
  for (const parte of [nucleo, ...cola, equipo]) {
    if (parte && !partes.includes(parte)) partes.push(parte);
  }

  return capitalizar(partes.join(' ').replace(/\s+/g, ' ').trim());
}

// ---------- Generación ----------

if (!fs.existsSync(ORIGEN)) {
  console.error(`No encontré ${ORIGEN}.\nCloná github.com/yuhonas/free-exercise-db o pasá la ruta como argumento.`);
  process.exit(1);
}

const crudos = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'));
const lista = Array.isArray(crudos) ? crudos : crudos.exercises;

const catalogo = lista.map((ex) => ({
  id: ex.id,
  nombre: traducir(ex),
  en: ex.name,
  tipo: tipoDe(ex),
  met: metDe(ex),
  unidad: unidadDe(ex),
  primary: ex.primaryMuscles || [],
  secondary: ex.secondaryMuscles || [],
  equipo: ex.equipment || null,
  categoria: ex.category,
  nivel: ex.level || null
})).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

fs.writeFileSync(DESTINO, JSON.stringify(catalogo));

const sinTraducir = catalogo.filter((e) => e.nombre === e.en).length;
console.log(`${catalogo.length} ejercicios → ${path.relative(process.cwd(), DESTINO)}`);
console.log(`${sinTraducir} quedaron con el nombre en inglés (${Math.round((sinTraducir / catalogo.length) * 100)} %)`);
