import { useCallback, useEffect, useState } from 'react';
import { api, todayStr, fmtDate } from '../api.js';
import WeightChart from '../components/WeightChart.jsx';

const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Sedentario (poco o nada de ejercicio)' },
  { value: 1.375, label: 'Ligero (1–3 días/semana)' },
  { value: 1.55, label: 'Moderado (3–5 días/semana)' },
  { value: 1.725, label: 'Alto (6–7 días/semana)' }
];

const RATES = [
  { value: 0.25, label: '0.25% por semana (muy gradual)' },
  { value: 0.5, label: '0.5% por semana' },
  { value: 0.75, label: '0.75% por semana' },
  { value: 1, label: '1% por semana (máximo razonable)' }
];

export default function Progress() {
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [weights, setWeights] = useState([]);
  const [form, setForm] = useState(null);
  const [newWeight, setNewWeight] = useState('');
  const [weightDate, setWeightDate] = useState(todayStr());
  const [savedMsg, setSavedMsg] = useState(false);

  const refresh = useCallback(() => {
    api.get('/api/profile').then((p) => {
      setProfile(p);
      setForm({
        height_cm: p?.height_cm ?? '',
        age: p?.age ?? '',
        sex: p?.sex ?? 'M',
        activity: p?.activity ?? 1.375,
        goal_weight: p?.goal_weight ?? '',
        rate_pct: p?.rate_pct ?? 0.75
      });
    });
    api.get('/api/summary').then(setSummary).catch(() => {});
    api.get('/api/weights').then(setWeights).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    await api.put('/api/profile', form);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
    refresh();
  };

  const addWeight = async (e) => {
    e.preventDefault();
    if (!newWeight) return;
    await api.post('/api/weights', { date: weightDate, weight: Number(newWeight) });
    setNewWeight('');
    refresh();
  };

  const t = summary?.targets;

  return (
    <>
      <h1>Progreso</h1>

      <div className="card">
        <h2>Peso</h2>
        <WeightChart entries={weights} goal={profile?.goal_weight} />
        <form className="row" onSubmit={addWeight}>
          <label>
            Fecha
            <input type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value)} />
          </label>
          <label style={{ flex: '0 0 90px' }}>
            kg
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="0.0"
            />
          </label>
          <button className="primary shrink" disabled={!newWeight}>
            Guardar
          </button>
        </form>
        {weights.length > 0 ? (
          <details>
            <summary className="muted" style={{ cursor: 'pointer' }}>
              Ver todos los registros ({weights.length})
            </summary>
            <div className="entry-list">
              {[...weights].reverse().map((w) => (
                <div className="entry" key={w.id}>
                  <div className="entry-main">
                    <div className="entry-name">{w.weight} kg</div>
                    <div className="entry-sub">{fmtDate(w.date)}</div>
                  </div>
                  <button
                    className="entry-del"
                    aria-label="Borrar"
                    onClick={() => api.del(`/api/weights/${w.id}`).then(refresh)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {t ? (
        <div className="card">
          <h2>Tus números</h2>
          <div className="tile-grid">
            <div className="tile">
              <span className="tile-label">TMB (Mifflin-St Jeor)</span>
              <span className="tile-value">{t.bmr}</span>
              <span className="tile-hint">kcal en reposo</span>
            </div>
            <div className="tile">
              <span className="tile-label">Gasto diario total</span>
              <span className="tile-value">{t.tdee}</span>
              <span className="tile-hint">kcal con actividad</span>
            </div>
            <div className="tile">
              <span className="tile-label">Déficit sugerido</span>
              <span className="tile-value">{t.dailyDeficit}</span>
              <span className="tile-hint">≈ {t.weeklyLossKg} kg/semana</span>
            </div>
            <div className="tile">
              <span className="tile-label">Calorías objetivo</span>
              <span className="tile-value">{t.targetCalories}</span>
              <span className="tile-hint">kcal por día</span>
            </div>
          </div>
          {t.belowBmr ? (
            <p className="note">
              El objetivo quedó por debajo de tu TMB. Puede ser sostenible por poco tiempo, pero
              considerá un ritmo más gradual.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="note">Completá tu perfil y cargá al menos un peso para ver tus cálculos.</p>
      )}

      <form className="card" onSubmit={saveProfile}>
        <h2>Perfil</h2>
        {form ? (
          <>
            <div className="row">
              <label>
                Altura (cm)
                <input type="number" inputMode="numeric" min="100" value={form.height_cm} onChange={set('height_cm')} />
              </label>
              <label>
                Edad
                <input type="number" inputMode="numeric" min="10" value={form.age} onChange={set('age')} />
              </label>
              <label>
                Sexo
                <select value={form.sex} onChange={set('sex')}>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </label>
            </div>
            <label>
              Nivel de actividad general
              <select value={form.activity} onChange={set('activity')}>
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </label>
            <div className="row">
              <label>
                Peso objetivo (kg)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="30"
                  value={form.goal_weight}
                  onChange={set('goal_weight')}
                />
              </label>
              <label>
                Ritmo de pérdida
                <select value={form.rate_pct} onChange={set('rate_pct')}>
                  {RATES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="primary">{savedMsg ? 'Guardado ✓' : 'Guardar perfil'}</button>
          </>
        ) : null}
      </form>
    </>
  );
}
