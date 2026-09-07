import { useState } from 'react';
import { api } from '../api.js';

// "Hoy te toca": las rutinas asignadas al día de la semana, con cada ejercicio
// tildable. Tildar no inventa nada — crea un exercise_log normal con el plan
// que la rutina ya tenía, así las calorías, el XP y el mapa muscular siguen
// saliendo del mismo lugar de siempre.
export default function TodayRoutine({ data, weight, onSaved }) {
  const [guardando, setGuardando] = useState(null);

  if (!data || data.routines.length === 0) return null;

  const marcar = async (ex) => {
    setGuardando(ex.id);
    try {
      const body = { exercise_id: ex.exercise_id };
      if (ex.unit === 'series') {
        body.sets = ex.sets ?? 3;
        body.reps = ex.reps ?? 10;
      } else {
        body.minutes = ex.minutes ?? 15;
      }
      await api.post('/api/logs', body);
      onSaved();
    } finally {
      setGuardando(null);
    }
  };

  const plan = (ex) =>
    ex.unit === 'series'
      ? `${ex.sets ?? 3}×${ex.reps ?? 10}`
      : `${ex.minutes ?? 15} min`;

  return (
    <>
      {data.routines.map((r) => {
        const listo = r.pendientes === 0;
        return (
          <div className="card" key={r.id}>
            <div className="card-head">
              <h2>Hoy te toca: {r.name}</h2>
              <span className={`tag ${listo ? 'ok' : ''}`}>
                {listo ? 'completa ✓' : `${r.pendientes} pendiente${r.pendientes === 1 ? '' : 's'}`}
              </span>
            </div>

            {!weight && (
              <p className="warn">
                Sin tu peso cargado estos registros quedan en 0 kcal. Cargalo en{' '}
                <strong>Progreso</strong> y se recalculan solos.
              </p>
            )}

            <div className="mission-group">
              {r.exercises.map((ex) => (
                <button
                  key={ex.id}
                  className={`mission ${ex.done ? 'done' : ''}`}
                  disabled={ex.done || guardando === ex.id}
                  onClick={() => marcar(ex)}
                >
                  <span className="mission-check">{ex.done ? '✓' : ''}</span>
                  <span className="mission-name">{ex.name}</span>
                  <span className="mission-xp">{plan(ex)}</span>
                </button>
              ))}
            </div>

            {listo && <p className="muted center">Rutina terminada. Andá tranquilo.</p>}
          </div>
        );
      })}
    </>
  );
}
