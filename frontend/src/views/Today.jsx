import { useCallback, useEffect, useState } from 'react';
import { api, todayStr } from '../api.js';
import FoodForm from '../components/FoodForm.jsx';
import TodayRoutine from '../components/TodayRoutine.jsx';

function StatTile({ label, value, hint }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {hint ? <span className="tile-hint">{hint}</span> : null}
    </div>
  );
}

function QuickExercise({ exercises, onSaved, weight }) {
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
      {!weight && (
        // Las calorías salen de MET × peso × tiempo: sin un peso cargado la
        // cuenta da 0 y el registro queda así guardado. Antes esto pasaba en
        // silencio y el número quedaba roto sin que nadie se enterara.
        <p className="warn">
          Cargá tu peso en <strong>Progreso</strong> antes de registrar: sin él no se pueden
          calcular las calorías. Los registros que hagas ahora quedan en 0 kcal, y se recalculan
          solos apenas cargues el primero.
        </p>
      )}
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
  const [character, setCharacter] = useState(null);
  const [routine, setRoutine] = useState(null);

  const refresh = useCallback(() => {
    api.get('/api/routines/today').then(setRoutine).catch(() => {});
    Promise.all([api.get('/api/summary'), api.get('/api/food'), api.get('/api/logs')])
      .then(([s, f, l]) => {
        setSummary(s);
        setFoods(f);
        setLogs(l);
      })
      .catch(() => {});
    api.get('/api/character').then(setCharacter).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    api.get('/api/exercises').then(setExercises).catch(() => {});
  }, [refresh]);

  const t = summary?.targets;
  const margin = t ? t.targetCalories - summary.net : null;
  // déficit real de hoy contra el gasto total: negativo = quemando grasa
  const todayDeficit = t ? t.tdee + summary.burned - summary.consumed : null;

  const calPct = t && t.targetCalories > 0 ? Math.round((summary.net / t.targetCalories) * 100) : null;
  const m = summary?.macros;
  const perKg = summary?.perKg;

  return (
    <>
      <div className="hero-head">
        <h1>Hoy</h1>
        {character && (
          <div className="today-chips">
            {character.streak.current > 0 && (
              <span className="streak">🔥 {character.streak.current}</span>
            )}
            {character.todayXp > 0 && <span className="streak xp">+{character.todayXp} XP</span>}
          </div>
        )}
      </div>

      {t ? (
        <div className="card cal-card">
          <div className="cal-head">
            <span>
              <strong>{summary.net}</strong> / {t.targetCalories} kcal netas
            </span>
            <span className={`cal-pct ${calPct > 100 ? 'over' : ''}`}>{calPct}%</span>
          </div>
          <div className="cal-bar-track">
            <div
              className={`cal-bar-fill ${calPct > 100 ? 'over' : ''}`}
              style={{ width: `${Math.min(100, Math.max(0, calPct))}%` }}
            />
          </div>
          <span className="muted">
            {margin >= 0
              ? `Te quedan ${margin} kcal de margen para hoy.`
              : `Te pasaste ${-margin} kcal del objetivo. Una caminata ayuda.`}
          </span>
        </div>
      ) : null}

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

      {m && summary.consumed > 0 ? (
        <div className="card">
          <div className="card-head">
            <h2>Macros de hoy</h2>
            {m.cubierto != null && m.cubierto < 100 ? (
              <span className="tag">{m.cubierto}% de las kcal con macros</span>
            ) : null}
          </div>
          <div className="macro-grid">
            {[
              ['Proteína', m.protein, t?.proteinTarget, 'g'],
              ['Carbos', m.carbs, null, 'g'],
              ['Grasas', m.fat, null, 'g'],
              ['Fibra', m.fiber, 25, 'g']
            ].map(([etiqueta, valor, objetivo, u]) => (
              <div className="tile" key={etiqueta}>
                <span className="tile-label">{etiqueta}</span>
                <span className="tile-value">{Math.round(valor)}</span>
                <span className="tile-hint">
                  {objetivo ? `${u} · objetivo ${objetivo}` : u}
                  {perKg && etiqueta === 'Proteína' ? ` · ${perKg.protein} g/kg` : ''}
                </span>
              </div>
            ))}
          </div>
          {m.cubierto != null && m.cubierto < 100 ? (
            <p className="muted">
              Es un piso, no el total: {100 - m.cubierto}% de lo que comiste hoy se cargó sin
              macros. Elegí el alimento del autocompletado o poné los gramos a mano para que
              cuente.
            </p>
          ) : null}
        </div>
      ) : null}

      {todayDeficit != null && summary.consumed > 0 ? (
        <p className="note">
          {todayDeficit > 0
            ? `Hoy vas ${todayDeficit} kcal por debajo de tu gasto total ≈ ${Math.round(todayDeficit / 7.7)} g de grasa quemada.`
            : `Hoy vas ${-todayDeficit} kcal por encima de tu gasto total.`}
        </p>
      ) : null}

      <FoodForm date={todayStr()} onSaved={refresh} />
      <TodayRoutine data={routine} weight={summary?.weight} onSaved={refresh} />

      <QuickExercise exercises={exercises} weight={summary?.weight} onSaved={refresh} />

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
                  <div className="entry-sub">
                    {f.time}
                    {f.qty ? ` · ${f.qty} ${f.unit === 'porcion' ? 'porción' : f.unit}` : ''}
                    {f.protein != null ? ` · ${f.protein} g prot.` : ''}
                  </div>
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
