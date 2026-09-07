import { useState } from 'react';
import { api } from '../api.js';

// Domingo es 0 para que coincida con Date.getDay() y no haya que convertir,
// pero se muestra al final: acá la semana arranca el lunes.
const DIAS = [
  [1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom']
];
const nombreDia = (d) => (d === null || d === undefined ? 'sin día fijo' : DIAS.find(([n]) => n === d)[1]);

function Editor({ inicial, exercises, onDone, onCancel }) {
  const [name, setName] = useState(inicial.name || '');
  const [weekday, setWeekday] = useState(inicial.weekday ?? null);
  const [lista, setLista] = useState(
    (inicial.exercises || []).map((e) => ({
      exercise_id: e.exercise_id, sets: e.sets, reps: e.reps, minutes: e.minutes,
      name: e.name, unit: e.unit
    }))
  );

  const agregar = (ex) => {
    if (lista.some((x) => x.exercise_id === ex.id)) return;
    setLista([...lista, {
      exercise_id: ex.id, name: ex.name, unit: ex.unit,
      sets: ex.unit === 'series' ? 3 : null,
      reps: ex.unit === 'series' ? 10 : null,
      minutes: ex.unit === 'series' ? null : 15
    }]);
  };

  const editar = (i, campo, valor) =>
    setLista(lista.map((x, k) => (k === i ? { ...x, [campo]: valor === '' ? null : Number(valor) } : x)));

  const mover = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const copia = [...lista];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setLista(copia);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const cuerpo = { name, weekday, exercises: lista };
    if (inicial.id) await api.put(`/api/routines/${inicial.id}`, cuerpo);
    else await api.post('/api/routines', cuerpo);
    onDone();
  };

  return (
    <form className="routine-edit" onSubmit={guardar}>
      <label>
        Nombre
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. tren superior" />
      </label>

      <div>
        <span className="musc-pick-label">Día de la semana</span>
        <div className="chip-grid">
          {DIAS.map(([n, etiqueta]) => (
            <button
              type="button" key={n}
              className={`chip ${weekday === n ? 'selected' : ''}`}
              onClick={() => setWeekday(weekday === n ? null : n)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <p className="muted">
          {weekday === null
            ? 'Sin día fijo: no aparece en "hoy te toca", queda como lista para cuando quieras.'
            : `Los ${nombreDia(weekday).toLowerCase()} la app te la va a proponer en Hoy.`}
        </p>
      </div>

      {lista.length > 0 && (
        <div className="entry-list">
          {lista.map((x, i) => (
            <div className="entry" key={x.exercise_id}>
              <div className="entry-main">
                <div className="entry-name">{x.name}</div>
                <div className="entry-sub">{x.unit}</div>
              </div>
              {x.unit === 'series' ? (
                <>
                  <input className="mini" type="number" min="1" value={x.sets ?? ''}
                         onChange={(e) => editar(i, 'sets', e.target.value)} aria-label="Series" />
                  <span className="muted">×</span>
                  <input className="mini" type="number" min="1" value={x.reps ?? ''}
                         onChange={(e) => editar(i, 'reps', e.target.value)} aria-label="Reps" />
                </>
              ) : (
                <>
                  <input className="mini" type="number" min="1" value={x.minutes ?? ''}
                         onChange={(e) => editar(i, 'minutes', e.target.value)} aria-label="Minutos" />
                  <span className="muted">min</span>
                </>
              )}
              <button type="button" className="entry-del" aria-label="Subir" onClick={() => mover(i, -1)}>↑</button>
              <button type="button" className="entry-del" aria-label="Bajar" onClick={() => mover(i, 1)}>↓</button>
              <button type="button" className="entry-del" aria-label="Quitar"
                      onClick={() => setLista(lista.filter((_, k) => k !== i))}>×</button>
            </div>
          ))}
        </div>
      )}

      <div>
        <span className="musc-pick-label">Agregar ejercicio</span>
        <div className="chip-grid">
          {exercises.filter((ex) => !lista.some((x) => x.exercise_id === ex.id)).map((ex) => (
            <button type="button" key={ex.id} className="chip" onClick={() => agregar(ex)}>
              + {ex.name}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <button className="primary shrink" disabled={!name.trim() || lista.length === 0}>Guardar</button>
        <button type="button" className="ghost shrink" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export default function RoutineEditor({ routines, exercises, onChange }) {
  const [editando, setEditando] = useState(null); // null | 'new' | rutina
  const [confirmId, setConfirmId] = useState(null);

  const cerrar = () => { setEditando(null); onChange(); };

  return (
    <div className="card">
      <h2>Rutinas</h2>
      <p className="muted">
        Un conjunto de ejercicios con su plan. Si le asignás un día, la app te lo propone en Hoy
        en vez de esperar a que te acuerdes.
      </p>

      {routines.length === 0 && editando !== 'new' && (
        <p className="muted">Todavía no armaste ninguna.</p>
      )}

      <div className="entry-list">
        {routines.map((r) => (
          <div key={r.id}>
            <div className="entry">
              <div className="entry-main">
                <div className="entry-name">{r.name}</div>
                <div className="entry-sub">
                  {nombreDia(r.weekday)} · {r.exercises.length} ejercicio{r.exercises.length === 1 ? '' : 's'}
                </div>
              </div>
              <button className="ghost shrink" onClick={() => setEditando(editando?.id === r.id ? null : r)}>
                Editar
              </button>
              {confirmId === r.id ? (
                <span className="del-confirm">
                  <button className="ghost danger"
                          onClick={() => { setConfirmId(null); api.del(`/api/routines/${r.id}`).then(onChange); }}>
                    Borrar
                  </button>
                  <button className="ghost" onClick={() => setConfirmId(null)}>No</button>
                </span>
              ) : (
                <button className="entry-del" aria-label="Borrar" onClick={() => setConfirmId(r.id)}>×</button>
              )}
            </div>
            {editando?.id === r.id && (
              <Editor inicial={r} exercises={exercises} onDone={cerrar} onCancel={() => setEditando(null)} />
            )}
          </div>
        ))}
      </div>

      {editando === 'new' ? (
        <Editor inicial={{ name: '', weekday: null, exercises: [] }} exercises={exercises}
                onDone={cerrar} onCancel={() => setEditando(null)} />
      ) : (
        <button className="ghost" onClick={() => setEditando('new')}>+ Armar una rutina</button>
      )}
    </div>
  );
}
