import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate } from '../api.js';

const TYPES = ['tren superior', 'cardio bajo impacto', 'core', 'otro'];

const EMPTY = { name: '', type: 'tren superior', met: '4', unit: 'series' };

function ExerciseForm({ initial, onDone, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

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

  const refresh = useCallback(() => {
    api.get('/api/exercises').then(setExercises).catch(() => {});
    api.get('/api/logs/history?days=14').then(setHistory).catch(() => {});
  }, []);

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
                  initial={{ ...ex, met: String(ex.met) }}
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
