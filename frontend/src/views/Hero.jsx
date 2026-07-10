import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import LevelUpFx from '../components/LevelUpFx.jsx';
import { playLevelUp } from '../levelUpSound.js';

const PILLAR_LABELS = {
  fisico: 'Físico',
  alimentacion: 'Alimentación',
  habitos: 'Hábitos',
  oracion: 'Oración',
  trabajo: 'Trabajo'
};

const PILLAR_ICONS = {
  fisico: '💪',
  alimentacion: '🥦',
  habitos: '🛡️',
  oracion: '🙏',
  trabajo: '⚔️'
};

const fmt = (n) => (n ?? 0).toLocaleString('es-AR');

const RANK_STEPS = [
  [100, 'Guerrero Celestial'],
  [85, 'Guerrero Veterano'],
  [70, 'Guerrero'],
  [55, 'Guerrero Novato'],
  [40, 'Escudero'],
  [25, 'Aspirante'],
  [10, 'Civil'],
  [1, 'Pordiosero']
];

export default function Hero() {
  const [character, setCharacter] = useState(null);
  const [habits, setHabits] = useState([]);
  const [gain, setGain] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  // stepper de desarrollo: simula niveles para previsualizar la progresión
  // visual del avatar sin tocar la XP real (0 = datos reales)
  const [devOffset, setDevOffset] = useState(0);
  const prevLevel = useRef(null);

  const refresh = useCallback(() => {
    Promise.all([api.get('/api/character'), api.get('/api/habits')])
      .then(([c, h]) => {
        if (prevLevel.current != null && c.level > prevLevel.current) {
          setLevelUp(c.level);
          playLevelUp();
        }
        prevLevel.current = c.level;
        setCharacter(c);
        setHabits(h);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = async (habit) => {
    // actualización optimista para que el check responda al instante
    setHabits((hs) => hs.map((h) => (h.id === habit.id ? { ...h, done: h.done ? 0 : 1 } : h)));
    try {
      const r = await api.post(`/api/habits/${habit.id}/toggle`, {});
      if (r.done) setGain({ amount: r.xp, t: Date.now() });
    } finally {
      refresh();
    }
  };

  if (!character) return <h1>Héroe</h1>;

  const c = character;
  const preview = devOffset !== 0;
  const shownLevel = Math.max(1, Math.min(100, c.level + devOffset));
  // en vista previa, los tiers se derivan del nivel simulado
  const t = (shownLevel - 1) / 99;
  const shown = preview
    ? {
        level: shownLevel,
        rank: RANK_STEPS.find(([min]) => shownLevel >= min)[1],
        body: Math.round(t * 20),
        spirit: Math.round(t * 10),
        gear: 1 + Math.round(t * 5)
      }
    : { level: c.level, rank: c.rank, body: c.body.tier, spirit: c.spirit.tier, gear: c.gear.tier };
  const bump = (n) => {
    setDevOffset((o) => {
      const next = Math.max(1 - c.level, Math.min(100 - c.level, o + n));
      if (next > o) {
        // subir con el stepper también dispara el efecto, para poder probarlo
        setLevelUp(Math.min(100, c.level + next));
        playLevelUp();
      }
      return next;
    });
  };
  const pct = c.xpNext ? Math.round((c.xpInto / c.xpNext) * 100) : 100;
  const byPillar = {};
  for (const h of habits) (byPillar[h.pillar] = byPillar[h.pillar] || []).push(h);
  const maxPillarXp = Math.max(1, ...Object.values(c.pillars).map((p) => p.xp));

  return (
    <>
      <div className="hero-head">
        <h1>Héroe</h1>
        {c.streak.current > 0 && (
          <span className="streak" title={`Mejor racha: ${c.streak.best} días`}>
            🔥 {c.streak.current} {c.streak.current === 1 ? 'día' : 'días'}
          </span>
        )}
      </div>

      {levelUp && <LevelUpFx level={levelUp} onDone={() => setLevelUp(null)} />}

      <div className="card hero-card">
        {gain && <span key={gain.t} className="gain-float">+{gain.amount} XP</span>}
        <div className="dev-stepper">
          <button className="ghost" onClick={() => bump(10)} title="+10 niveles">»</button>
          <button className="ghost" onClick={() => bump(1)} title="+1 nivel">+</button>
          <button className="ghost" onClick={() => bump(-1)} title="-1 nivel">−</button>
          <button className="ghost" onClick={() => bump(-10)} title="-10 niveles">«</button>
          {preview && (
            <button className="ghost reset" onClick={() => setDevOffset(0)} title="Volver a datos reales">↺</button>
          )}
        </div>
        <Avatar
          body={shown.body}
          spirit={shown.spirit}
          gear={shown.gear}
          accessories={preview ? [] : c.accessories}
        />
        <div className="hero-identity">
          <span className="hero-level">Nivel {shown.level}</span>
          <span className="hero-rank">{shown.rank}</span>
        </div>
        {!preview && (
          <>
            <div className="xp-bar-track">
              <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="xp-bar-caption">
              {c.level < 100
                ? `${fmt(c.xpInto)} / ${fmt(c.xpNext)} XP para nivel ${c.level + 1}`
                : '¡Nivel máximo alcanzado!'}
              {c.todayXp > 0 ? ` · hoy +${fmt(c.todayXp)}` : ''}
            </div>
          </>
        )}
        <div className="tier-chips">
          <span className="tag">Cuerpo {shown.body}/20</span>
          <span className="tag">Espíritu {shown.spirit}/10</span>
          <span className="tag">Equipo {shown.gear}/6</span>
        </div>
        {preview ? (
          <p className="muted center">Vista previa de desarrollo · nivel simulado, tu XP real no cambia.</p>
        ) : c.body.startWeight && c.body.goalWeight ? (
          <p className="muted center">
            {c.body.startWeight} → <strong>{c.body.currentWeight} kg</strong> · objetivo{' '}
            {c.body.goalWeight} kg ({c.body.progressPct}%)
          </p>
        ) : (
          <p className="muted center">Registrá tu peso y objetivo en Progreso para que el cuerpo evolucione.</p>
        )}
      </div>

      <div className="card">
        <h2>Misiones de hoy</h2>
        <p className="muted">
          El físico también suma solo: cada ejercicio registrado y cada nuevo mínimo de peso dan XP.
        </p>
        {Object.entries(byPillar).map(([pillar, list]) => (
          <div key={pillar} className="mission-group">
            <div className="mission-pillar">
              <span>
                {PILLAR_ICONS[pillar]} {PILLAR_LABELS[pillar] || pillar}
              </span>
              {c.pillars[pillar]?.today > 0 && <span className="mission-today">+{c.pillars[pillar].today} XP hoy</span>}
            </div>
            {list.map((h) => (
              <button key={h.id} className={`mission ${h.done ? 'done' : ''}`} onClick={() => toggle(h)}>
                <span className="mission-check">{h.done ? '✓' : ''}</span>
                <span className="mission-name">{h.name}</span>
                <span className="mission-xp">+{h.xp}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Pilares</h2>
        {Object.entries(c.pillars).map(([pillar, p]) => (
          <div key={pillar} className="pillar-row">
            <span className="pillar-name">
              {PILLAR_ICONS[pillar]} {PILLAR_LABELS[pillar]}
            </span>
            <div className="pillar-track">
              <div className="pillar-fill" style={{ width: `${Math.max(3, Math.round((p.xp / maxPillarXp) * 100))}%` }} />
            </div>
            <span className="pillar-xp">{fmt(p.xp)}</span>
          </div>
        ))}
        <p className="note">
          Oración forja tu <strong>espíritu</strong>
          {c.spirit.nextAt ? ` (próximo tier a ${fmt(c.spirit.nextAt)} XP)` : ' (máximo)'} · Trabajo mejora tu{' '}
          <strong>equipo</strong>
          {c.gear.nextAt ? ` (próximo tier a ${fmt(c.gear.nextAt)} XP)` : ' (máximo)'} · Físico transforma tu{' '}
          <strong>cuerpo</strong> con cada kilo.
        </p>
      </div>
    </>
  );
}
