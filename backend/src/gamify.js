// Motor de gamificación: XP, niveles, rangos y tiers del avatar.

// Curva de nivel 1→100: el costo por nivel crece linealmente.
// Total acumulado ≈ 49.500 XP. A ~250-300 XP por día completo,
// llegar a nivel 100 lleva ~8 meses (coherente con perder ~20 kg).
const xpToNext = (level) => 100 + level * 8;

function levelFromXp(totalXp) {
  let level = 1;
  let into = totalXp;
  while (level < 100 && into >= xpToNext(level)) {
    into -= xpToNext(level);
    level++;
  }
  return { level, into, next: level < 100 ? xpToNext(level) : 0 };
}

const RANKS = [
  [100, 'Guerrero Celestial'],
  [85, 'Guerrero Veterano'],
  [70, 'Guerrero'],
  [55, 'Guerrero Novato'],
  [40, 'Escudero'],
  [25, 'Aspirante'],
  [10, 'Civil'],
  [1, 'Pordiosero']
];
const rankFor = (level) => RANKS.find(([min]) => level >= min)[1];

// XP por sesión de ejercicio: 1 XP cada 5 kcal quemadas, entre 10 y 60.
const exerciseXp = (calories) => Math.max(10, Math.min(60, Math.round((calories || 0) / 5)));

// XP por bajar de peso: 10 XP por cada 100 g debajo del mejor peso histórico.
const weightXp = (bestPrev, weight) => Math.min(500, Math.round((bestPrev - weight) * 100));

// Cuerpo: 21 tiers (0 = peso inicial, 20 = peso objetivo), interpolados.
function bodyTier(startWeight, currentWeight, goalWeight) {
  if (!startWeight || !currentWeight || !goalWeight || startWeight <= goalWeight) {
    return {
      tier: 0,
      progressPct: 0,
      startWeight: startWeight || null,
      currentWeight: currentWeight || null,
      goalWeight: goalWeight || null
    };
  }
  const progress = Math.min(1, Math.max(0, (startWeight - currentWeight) / (startWeight - goalWeight)));
  return {
    tier: Math.round(progress * 20),
    progressPct: Math.round(progress * 100),
    startWeight,
    currentWeight,
    goalWeight
  };
}

// Espíritu: 10 tiers según XP acumulada del pilar oración.
const SPIRIT_THRESHOLDS = [100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500];

// Equipo: 6 tiers según XP acumulada del pilar trabajo.
const GEAR_THRESHOLDS = [0, 300, 900, 2000, 3800, 6000];

const tierFromThresholds = (xp, thresholds) => thresholds.filter((t) => xp >= t).length;

const PILLARS = ['fisico', 'alimentacion', 'habitos', 'oracion', 'trabajo'];

module.exports = {
  xpToNext,
  levelFromXp,
  rankFor,
  exerciseXp,
  weightXp,
  bodyTier,
  SPIRIT_THRESHOLDS,
  GEAR_THRESHOLDS,
  tierFromThresholds,
  PILLARS
};
