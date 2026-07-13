import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Flujo guiado para momentos de ansiedad: primero el cuerpo (respiración),
// después una acción concreta, y recién al final el registro. La idea es
// interrumpir el impulso, no analizarlo.

const PHASES = [
  { label: 'Inhalá', secs: 4, scale: 1.45 },
  { label: 'Sostené', secs: 4, scale: 1.45 },
  { label: 'Exhalá', secs: 6, scale: 1 }
];
const CYCLES = 4;

const ACTIONS = [
  'Tomar un vaso grande de agua',
  'Caminar 5 minutos',
  '10 flexiones o sentadillas',
  'Lavarme la cara con agua fría',
  'Salir a tomar aire',
  'Orar / meditar 2 minutos'
];

function Breathe({ onDone }) {
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (cycle >= CYCLES) {
      onDone();
      return;
    }
    const t = setTimeout(() => {
      const next = (phase + 1) % PHASES.length;
      setPhase(next);
      if (next === 0) setCycle((c) => c + 1);
    }, PHASES[phase].secs * 1000);
    return () => clearTimeout(t);
  }, [phase, cycle, onDone]);

  const p = PHASES[phase];
  return (
    <>
      <h2 className="center">Respirá conmigo</h2>
      <div className="breath-wrap">
        <div
          className="breath-circle"
          style={{ transform: `scale(${p.scale})`, transition: `transform ${p.secs}s ease-in-out` }}
        />
        <span className="breath-label">{p.label}</span>
      </div>
      <p className="muted center">
        {p.secs} segundos · ronda {Math.min(cycle + 1, CYCLES)} de {CYCLES}
      </p>
      <button className="ghost" onClick={onDone}>Ya estoy mejor, seguir</button>
    </>
  );
}

function PickAction({ onDone }) {
  const [picked, setPicked] = useState(null);
  return (
    <>
      <h2 className="center">Ahora hacé una cosa</h2>
      <p className="muted center">Una sola. El impulso dura menos que la acción.</p>
      <div className="chip-grid">
        {ACTIONS.map((a) => (
          <button
            key={a}
            className={`chip ${picked === a ? 'selected' : ''}`}
            onClick={() => setPicked(picked === a ? null : a)}
          >
            {a}
          </button>
        ))}
      </div>
      {picked ? (
        <>
          <p className="note center">Hacelo ahora. Acá te espero.</p>
          <button className="primary" onClick={() => onDone(picked)}>Listo, lo hice</button>
        </>
      ) : (
        <button className="ghost" onClick={() => onDone(null)}>Prefiero solo registrar</button>
      )}
    </>
  );
}

function LogEpisode({ action, onSaved }) {
  const [intensity, setIntensity] = useState(3);
  const [cause, setCause] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (resisted) => {
    setSaving(true);
    try {
      const r = await api.post('/api/anxiety', { intensity, cause, action, resisted });
      onSaved(r.xp, resisted);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h2 className="center">¿Cómo fue?</h2>
      <label className="center-block">
        Intensidad
        <div className="intensity-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`chip ${intensity === n ? 'selected' : ''}`}
              onClick={() => setIntensity(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </label>
      <label>
        ¿Qué la disparó? (opcional)
        <input
          value={cause}
          onChange={(e) => setCause(e.target.value)}
          placeholder="ej. aburrimiento, una discusión, ver comida"
        />
      </label>
      <div className="row">
        <button className="primary" disabled={saving} onClick={() => save(true)}>
          Pasó el impulso
        </button>
        <button className="ghost" disabled={saving} onClick={() => save(false)}>
          Caí igual
        </button>
      </div>
      <p className="muted center">Registrarlo también suma. Sin culpa: es un dato.</p>
    </>
  );
}

export default function AnxietyFlow({ onClose }) {
  const [step, setStep] = useState('breathe');
  const [action, setAction] = useState(null);
  const [result, setResult] = useState(null);

  return (
    <div className="anx-overlay" role="dialog" aria-label="Centro de ansiedad">
      <div className="anx-card card">
        <button className="anx-close" aria-label="Cerrar" onClick={onClose}>×</button>
        {step === 'breathe' && <Breathe onDone={() => setStep('action')} />}
        {step === 'action' && (
          <PickAction
            onDone={(a) => {
              setAction(a);
              setStep('log');
            }}
          />
        )}
        {step === 'log' && (
          <LogEpisode
            action={action}
            onSaved={(xp, resisted) => {
              setResult({ xp, resisted });
              setStep('done');
            }}
          />
        )}
        {step === 'done' && (
          <>
            <h2 className="center">{result.resisted ? 'Bien ahí. Lo superaste.' : 'Quedó registrado.'}</h2>
            <p className="anx-xp center">+{result.xp} XP</p>
            <p className="muted center">
              {result.resisted
                ? 'Cada impulso superado entrena al que sigue.'
                : 'Mañana es otra ronda. El patrón ya está anotado.'}
            </p>
            <button className="primary" onClick={onClose}>Volver</button>
          </>
        )}
      </div>
    </div>
  );
}
