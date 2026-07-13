import { useState } from 'react';
import Today from './views/Today.jsx';
import Exercises from './views/Exercises.jsx';
import Foods from './views/Foods.jsx';
import Progress from './views/Progress.jsx';
import Hero from './views/Hero.jsx';
import AnxietyFlow from './components/AnxietyFlow.jsx';

const ICONS = {
  heroe: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M12 8v5M9.5 10.5h5" />
    </svg>
  ),
  hoy: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9h13v-9" />
    </svg>
  ),
  ejercicio: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 9v6M8 7v10M16 7v10M20 9v6M8 12h8" />
    </svg>
  ),
  comida: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M7 3v7a2 2 0 0 0 2 2v9M5 3v4M9 3v4M16 3c-1.5 1.5-2 3.5-2 6h4v12" />
    </svg>
  ),
  progreso: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19h16" /><path d="M5 15l4-4 3 3 6-6" />
    </svg>
  )
};

const TABS = [
  { id: 'heroe', label: 'Héroe', View: Hero },
  { id: 'hoy', label: 'Hoy', View: Today },
  { id: 'ejercicio', label: 'Ejercicio', View: Exercises },
  { id: 'comida', label: 'Comida', View: Foods },
  { id: 'progreso', label: 'Progreso', View: Progress }
];

export default function App() {
  const [tab, setTab] = useState('hoy');
  const [sos, setSos] = useState(false);
  // sube al cerrar el SOS: remonta la vista activa para que refresque su data
  const [sosSeq, setSosSeq] = useState(0);
  const { View } = TABS.find((t) => t.id === tab);

  const closeSos = () => {
    setSos(false);
    setSosSeq((s) => s + 1);
  };

  return (
    <div className="app">
      <main className="content">
        <View key={`${tab}-${sosSeq}`} />
      </main>
      <button className="sos-btn" onClick={() => setSos(true)}>SOS</button>
      {sos && <AnxietyFlow onClose={closeSos} />}
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {ICONS[t.id]}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
