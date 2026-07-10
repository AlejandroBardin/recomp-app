import { useEffect } from 'react';

// Efecto de subida de nivel estilo MU Online: columna de luz dorada que
// envuelve al personaje, chispas ascendentes, destello y texto.
export default function LevelUpFx({ level, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2800);
    return () => clearTimeout(id);
  }, [onDone]);

  const sparks = Array.from({ length: 26 }, (_, i) => ({
    left: 50 + Math.sin(i * 2.4) * (12 + (i % 5) * 5),
    delay: (i % 13) * 0.12,
    size: 3 + (i % 4) * 2
  }));

  return (
    <div className="lvlfx" aria-hidden="true">
      <div className="lvlfx-flash" />
      <div className="lvlfx-pillar" />
      <div className="lvlfx-pillar core" />
      {sparks.map((s, i) => (
        <span
          key={i}
          className="lvlfx-spark"
          style={{ left: `${s.left}%`, animationDelay: `${s.delay}s`, width: s.size, height: s.size }}
        />
      ))}
      <div className="lvlfx-text">
        <span className="lvlfx-title">LEVEL UP!</span>
        <span className="lvlfx-level">Nivel {level}</span>
      </div>
    </div>
  );
}
