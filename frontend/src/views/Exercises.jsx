import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '../api.js';
import MuscleMap from '../components/MuscleMap.jsx';

const TYPES = ['tren superior', 'cardio bajo impacto', 'core', 'otro'];

const EMPTY = {
  name: '', type: 'tren superior', met: '4', unit: 'series',
  primary_muscles: [], secondary_muscles: []
};

// Las columnas vienen como JSON de la base; el formulario trabaja con arrays.
const parseMusculos = (v) => {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v) || []; } catch { return []; }
};

function ExerciseForm({ initial, catalogo, onDone, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Un músculo está en principal o en secundario, nunca en los dos: marcarlo
  // en uno lo saca del otro.
  const toggleMusculo = (campo, clave) => {
    const otro = campo === 'primary_muscles' ? 'secondary_muscles' : 'primary_muscles';
    const actual = form[campo] || [];
    setForm({
      ...form,
      [campo]: actual.includes(clave) ? actual.filter((k) => k !== clave) : [...actual, clave],
      [otro]: (form[otro] || []).filter((k) => k !== clave)
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.id) {
      await api.put(`/api/exercises/${form.id}`, form);
    } else {
      await api.post('/api/exercises', form);
    }
    onDone();
  };

  return (
    <form className="inline-form" style={{ flexWrap: 'wrap' }} onSubmit={save}>
      <label style={{ flexBasis: '100%' }}>
        Nombre
        <input value={form.name} onChange={set('name')} placeholder="ej. remo con banda" />
      </label>
      <label>
        Tipo
        <select value={form.type} onChange={set('type')}>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label style={{ flex: '0 0 72px' }}>
        MET
        <input type="number" inputMode="decimal" step="0.1" min="1" value={form.met} onChange={set('met')} />
      </label>
      <label style={{ flex: '0 0 110px' }}>
        Se mide en
        <select value={form.unit} onChange={set('unit')}>
          <option value="series">series</option>
          <option value="minutos">minutos</option>
        </select>
      </label>
      {catalogo.length > 0 && (
        <div style={{ flexBasis: '100%' }}>
          {[
            ['primary_muscles', 'Músculo principal'],
            ['secondary_muscles', 'Secundarios (cuentan la mitad)']
          ].map(([campo, etiqueta]) => (
            <div key={campo} className="musc-pick">
              <span className="musc-pick-label">{etiqueta}</span>
              <div className="chip-grid">
                {catalogo.map((m) => (
                  <button
                    type="button"
                    key={m.key}
                    className={`chip ${(form[campo] || []).includes(m.key) ? 'selected' : ''}`}
                    onClick={() => toggleMusculo(campo, m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="primary shrink">Guardar</button>
      <button type="button" className="ghost shrink" onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
}

export default function Exercises() {
  const [exercises, setExercises] = useState([]);
  const [history, setHistory] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | exercise
  const [muscles, setMuscles] = useState(null);
  const [dias, setDias] = useState(30);

  const refresh = useCallback(() => {
    api.get('/api/exercises').then(setExercises).catch(() => {});
    api.get('/api/logs/history?days=14').then(setHistory).catch(() => {});
  }, []);

  // El endpoint devuelve los 16 músculos dibujables con su etiqueta, así que
  // sirve de mapa y de catálogo para el selector: no hace falta repetir la
  // taxonomía acá.
  useEffect(() => {
    api.get(`/api/muscles?days=${dias}`).then(setMuscles).catch(() => {});
    // `history` cambia cada vez que se guarda un registro o un ejercicio, que
    // es exactamente cuando el mapa quedó viejo.
  }, [dias, history]);

  useEffect(refresh, [refresh]);

  const remove = async (ex) => {
    await api.del(`/api/exercises/${ex.id}`);
    refresh();
  };

  const byDate = history.reduce((acc, log) => {
    (acc[log.date] = acc[log.date] || []).push(log);
    return acc;
  }, {});

  return (
    <>
      <h1>Ejercicio</h1>

      <div className="card">
        <h2>Mis ejercicios</h2>
        <div className="entry-list">
          {exercises.map((ex) => (
            <div key={ex.id}>
              <div className="entry">
                <div className="entry-main">
                  <div className="entry-name">{ex.name}</div>
                  <div className="entry-sub">
                    {ex.type} · MET {ex.met} · por {ex.unit}
                  </div>
                </div>
                <button className="ghost shrink" onClick={() => setEditing(editing?.id === ex.id ? null : ex)}>
                  Editar
                </button>
                <button className="entry-del" aria-label="Borrar" onClick={() => remove(ex)}>
                  ×
                </button>
              </div>
              {editing?.id === ex.id ? (
                <ExerciseForm
                  catalogo={muscles?.muscles ?? []}
                  initial={{
                    ...ex,
                    met: String(ex.met),
                    primary_muscles: parseMusculos(ex.primary_muscles),
                    secondary_muscles: parseMusculos(ex.secondary_muscles)
                  }}
                  onDone={() => {
                    setEditing(null);
                    refresh();
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : null}
            </div>
          ))}
        </div>
        {editing === 'new' ? (
          <ExerciseForm
            catalogo={muscles?.muscles ?? []}
            initial={EMPTY}
            onDone={() => {
              setEditing(null);
              refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <button className="ghost" onClick={() => setEditing('new')}>
            + Agregar ejercicio
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Mapa muscular</h2>
          <div className="seg">
            {[30, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                className={`seg-btn ${dias === d ? 'on' : ''}`}
                onClick={() => setDias(d)}
              >
                {d === 365 ? 'año' : `${d}d`}
              </button>
            ))}
          </div>
        </div>
        <p className="muted">
          Volumen en series equivalentes: un ejercicio por tiempo cuenta un décimo de sus minutos,
          y el músculo secundario, la mitad.
        </p>
        <MuscleMap data={muscles} />
      </div>

      <div className="card">
        <h2>Últimos 14 días</h2>
        {Object.keys(byDate).length === 0 ? (
          <p className="muted">Sin registros todavía.</p>
        ) : (
          Object.entries(byDate).map(([date, logs]) => (
            <div className="day-group" key={date}>
              <div className="day-title">{fmtDate(date)}</div>
              {logs.map((l) => (
                <div className="entry" key={l.id}>
                  <div className="entry-main">
                    <div className="entry-name">{l.exercise_name}</div>
                    <div className="entry-sub">
                      {l.sets ? `${l.sets}×${l.reps ?? '—'}` : ''}
                      {l.minutes ? `${l.sets ? ' · ' : ''}${l.minutes} min` : ''}
                    </div>
                  </div>
                  <span className="entry-kcal">~{Math.round(l.calories)} kcal</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}
