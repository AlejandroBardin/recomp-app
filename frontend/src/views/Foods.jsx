import { useCallback, useEffect, useState } from 'react';
import { api, todayStr, fmtDate } from '../api.js';

export default function Foods() {
  const [date, setDate] = useState(todayStr());
  const [entries, setEntries] = useState([]);
  const [patterns, setPatterns] = useState(null);

  const refresh = useCallback(() => {
    api.get(`/api/food?date=${date}`).then(setEntries).catch(() => {});
    api.get('/api/food/patterns').then(setPatterns).catch(() => {});
  }, [date]);

  useEffect(refresh, [refresh]);

  const total = entries.reduce((sum, e) => sum + e.calories, 0);
  const maxCount = patterns?.byHour?.length ? Math.max(...patterns.byHour.map((h) => h.count)) : 0;

  const toggleImpulsive = async (entry) => {
    await api.patch(`/api/food/${entry.id}`, { impulsive: !entry.impulsive });
    refresh();
  };

  return (
    <>
      <h1>Comida</h1>

      <div className="card">
        <div className="row">
          <label>
            Fecha
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="tile shrink" style={{ border: 'none', padding: '0 8px' }}>
            <span className="tile-label">Total {fmtDate(date)}</span>
            <span className="tile-value">{Math.round(total)}</span>
            <span className="tile-hint">kcal</span>
          </div>
        </div>
        {entries.length === 0 ? (
          <p className="muted">Sin registros para esta fecha.</p>
        ) : (
          <div className="entry-list">
            {entries.map((f) => (
              <div className="entry" key={f.id}>
                <div className="entry-main">
                  <div className="entry-name">{f.name}</div>
                  <div className="entry-sub">{f.time}</div>
                </div>
                <button
                  className={`pill-toggle ${f.impulsive ? 'on' : ''}`}
                  style={{ minHeight: 32, padding: '4px 10px', fontSize: '0.7rem' }}
                  onClick={() => toggleImpulsive(f)}
                >
                  {f.impulsive ? '✓ fuera de hambre' : 'fuera de hambre'}
                </button>
                <span className="entry-kcal">{Math.round(f.calories)}</span>
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
        <h2>Patrones — comidas fuera de hambre real</h2>
        <p className="muted">
          A qué hora del día suelen aparecer. Solo información, para conocerte mejor.
        </p>
        {!patterns || patterns.total === 0 ? (
          <p className="muted">Sin datos todavía.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {patterns.byHour.map((h) => (
              <div className="pattern-row" key={h.hour}>
                <span className="pattern-hour">{String(h.hour).padStart(2, '0')}:00</span>
                <div className="pattern-bar-track">
                  <div className="pattern-bar" style={{ width: `${(h.count / maxCount) * 100}%` }} />
                </div>
                <span className="pattern-count">{h.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
