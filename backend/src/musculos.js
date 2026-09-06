// Taxonomía muscular y a qué músculo apunta cada ejercicio.
//
// Derivado de free-exercise-db (github.com/yuhonas/free-exercise-db), commit
// a859101d633a01c4a1a920d6a8ce41dabba0705f del 2026-08-30. Ese dataset está
// bajo Unlicense (dominio público), así que se puede copiar sin ataduras —
// a diferencia de otras bases de ejercicios, donde las imágenes vienen con
// la propiedad en disputa.
//
// Son los 17 grupos de su taxonomía, con etiqueta en español y de qué lado
// del cuerpo se dibujan. "neck" no se dibuja: ningún ejercicio de la app lo
// usa y una mancha en el cuello se lee como un error, no como un dato.

const MUSCLES = {
  abdominals:    { label: 'Abdominales',   view: 'front' },
  abductors:     { label: 'Abductores',    view: 'front' },
  adductors:     { label: 'Aductores',     view: 'front' },
  biceps:        { label: 'Bíceps',        view: 'front' },
  calves:        { label: 'Pantorrillas',  view: 'back'  },
  chest:         { label: 'Pecho',         view: 'front' },
  forearms:      { label: 'Antebrazos',    view: 'front' },
  glutes:        { label: 'Glúteos',       view: 'back'  },
  hamstrings:    { label: 'Isquiotibiales', view: 'back' },
  lats:          { label: 'Dorsales',      view: 'back'  },
  'lower back':  { label: 'Lumbares',      view: 'back'  },
  'middle back': { label: 'Espalda media', view: 'back'  },
  neck:          { label: 'Cuello',        view: null    },
  quadriceps:    { label: 'Cuádriceps',    view: 'front' },
  shoulders:     { label: 'Hombros',       view: 'front' },
  traps:         { label: 'Trapecios',     view: 'back'  },
  triceps:       { label: 'Tríceps',       view: 'back'  }
};

// Ejercicios base de la app → su entrada en free-exercise-db.
// Los dos marcados "a mano" no existen en el dataset (busqué "swim": cero
// resultados) y van asignados por criterio, no copiados.
const EXERCISE_MUSCLES = {
  'Dominadas':                      { primary: ['lats'],       secondary: ['biceps', 'middle back'] },
  'Fondos en silla':                { primary: ['triceps'],    secondary: ['chest', 'shoulders'] },
  'Flexiones':                      { primary: ['chest'],      secondary: ['shoulders', 'triceps'] },
  'Plancha':                        { primary: ['abdominals'], secondary: [] },
  'Elevación de piernas colgado':   { primary: ['abdominals'], secondary: [] },
  'Bici fija':                      { primary: ['quadriceps'], secondary: ['calves', 'glutes', 'hamstrings'] },
  'Caminata':                       { primary: ['quadriceps'], secondary: ['calves', 'glutes', 'hamstrings'] },
  // a mano: no está en el dataset. Crol carga dorsales, hombros y pecho.
  'Natación':                       { primary: ['lats', 'shoulders'], secondary: ['chest', 'triceps', 'abdominals'] },
  // a mano: un isométrico de cuádriceps es exactamente eso y nada más.
  'Isométricos de cuádriceps':      { primary: ['quadriceps'], secondary: [] }
};

const MUSCLE_KEYS = Object.keys(MUSCLES);
const esMusculoValido = (k) => Object.prototype.hasOwnProperty.call(MUSCLES, k);

module.exports = { MUSCLES, MUSCLE_KEYS, EXERCISE_MUSCLES, esMusculoValido };
