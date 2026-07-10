import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

function StatTile({ label, value, hint }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {hint ? <span className="tile-hint">{hint}</span> : null}
    </div>
  );
}

function QuickFood({ onSaved }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [impulsive, setImpulsive] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/api/foods/suggest?q=${encodeURIComponent(name)}`)
        .then(setSuggestions)
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [name]);

  const handleName = (value) => {
    setName(value);
    const match = suggestions.find((s) => s.name.toLowerCase() === value.toLowerCase());
    if (match) setKcal(String(match.calories));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || kcal === '') return;
    setSaving(true);
    try {
      await api.post('/api/food', { name, calories: Number(kcal), impulsive });
      setName('');
      setKcal('');
      setImpulsive(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>Agregar comida</h2>
      <div className="row">
        <label>
          Qué comiste
          <input
            list="food-suggestions"
            value={name}
            onChange={(e) => handleName(e.target.value)}
            placeholder="ej. café con leche"
            autoComplete="off"
          />
        </label>
        <label style={{ flex: '0 0 96px' }}>
          kcal
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>
      <datalist id="food-suggestions">
        {suggestions.map((s) => (
          <option key={s.name} value={s.name}>{`${s.calories} kcal`}</option>
        ))}
      </datalist>
      <div className="row">
        <button
          type="button"
          className={`pill-toggle shrink ${impulsive ? 'on' : ''}`}
          onClick={() => setImpulsive(!impulsive)}
        >
          {impulsive ? '✓ ' : ''}fuera de hambre real
        </button>
        <button className="primary shrink" disabled={saving || !name.trim() || kcal === ''}>
          Guardar
        </button>
      </div>
    </form>
  );
}

function QuickExercise({ exercises, onSaved }) {
  const [openId, setOpenId] = useState(null);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8');
  const [minutes, setMinutes] = useState('15');
  const [saving, setSaving] = useState(false);

  const selected = exercises.find((e) => e.id === openId);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const body = { exercise_id: selected.id };
      if (selected.unit === 'series') {
        body.sets = Number(sets) || null;
        body.reps = Number(reps) || null;
      } else {
        body.minutes = Number(minutes) || null;
      }
      await api.post('/api/logs', body);
      setOpenId(null);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2>Marcar ejercicio</h2>
      <div className="chip-grid">
        {exercises.map((ex) => (
          <button
            key={ex.id}
            className={`chip ${openId === ex.id ? 'selected' : ''}`}
            onClick={() => setOpenId(openId === ex.id ? null : ex.id)}
          >
            {ex.name}
          </button>
        ))}
      </div>
      {selected ? (
        <div className="inline-form">
          {selected.unit === 'series' ? (
            <>
              <label>
                Series
                <input type="number" inputMode="numeric" min="1" value={sets} onChange={(e) => setSets(e.target.value)} />
              </label>
              <label>
                Reps
                <input type="number" inputMode="numeric" min="0" value={reps} onChange={(e) => setReps(e.target.value)} />
              </label>
            </>
          ) : (
            <label>
              Minutos
              <input type="number" inputMode="numeric" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </label>
          )}
          <button className="primary shrink" onClick={save} disabled={saving}>
            Guardar
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function Today() {
  const [summary, setSummary] = useState(null);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [exercises, setExercises] = useState([]);

  const refresh = useCallback(() => {
    Promise.all([api.get('/api/summary'), api.get('/api/food'), api.get('/api/logs')])
      .then(([s, f, l]) => {
        setSummary(s);
        setFoods(f);
        setLogs(l);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    api.get('/api/exercises').then(setExercises).catch(() => {});
  }, [refresh]);

  const t = summary?.targets;
  const margin = t ? t.targetCalories - summary.net : null;
  // déficit real de hoy contra el gasto total: negativo = quemando grasa
  const todayDeficit = t ? t.tdee + summary.burned - summary.consumed : null;

  return (
    <>
      <h1>Hoy</h1>
      <div className="tile-grid">
        <StatTile label="Consumidas" value={summary ? `${summary.consumed}` : '—'} hint="kcal" />
        <StatTile
          label="Objetivo del día"
          value={t ? `${t.targetCalories}` : '—'}
          hint={t ? 'kcal' : 'completá tu perfil en Progreso'}
        />
        <StatTile label="Quemadas (ejercicio)" value={summary ? `${summary.burned}` : '—'} hint="kcal" />
        <StatTile
          label="Balance neto"
          value={summary ? `${summary.net}` : '—'}
          hint={margin != null ? `margen: ${margin} kcal` : 'consumidas − quemadas'}
        />
      </div>

      {todayDeficit != null && summary.consumed > 0 ? (
        <p className="note">
          {todayDeficit > 0
            ? `Hoy vas ${todayDeficit} kcal por debajo de tu gasto total ≈ ${Math.round(todayDeficit / 7.7)} g de grasa quemada.`
            : `Hoy vas ${-todayDeficit} kcal por encima de tu gasto total.`}
        </p>
      ) : null}

      <QuickFood onSaved={refresh} />
      <QuickExercise exercises={exercises} onSaved={refresh} />

      <div className="card">
        <h2>Comidas de hoy</h2>
        {foods.length === 0 ? (
          <p className="muted">Todavía no registraste nada hoy.</p>
        ) : (
          <div className="entry-list">
            {foods.map((f) => (
              <div className="entry" key={f.id}>
                <div className="entry-main">
                  <div className="entry-name">{f.name}</div>
                  <div className="entry-sub">{f.time}</div>
                </div>
                {f.impulsive ? <span className="tag">fuera de hambre</span> : null}
                <span className="entry-kcal">{Math.round(f.calories)} kcal</span>
                <button
                  className="entry-del"
                  aria-label="Borrar"
                  onClick={() => api.del(`/api/food/${f.id}`).then(refresh)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Ejercicio de hoy</h2>
        {logs.length === 0 ? (
          <p className="muted">Sin registros por ahora.</p>
        ) : (
          <div className="entry-list">
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
                <button
                  className="entry-del"
                  aria-label="Borrar"
                  onClick={() => api.del(`/api/logs/${l.id}`).then(refresh)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
