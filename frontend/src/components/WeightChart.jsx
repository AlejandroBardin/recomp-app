import { useRef, useState } from 'react';

// Línea de peso en el tiempo: SVG inline, una sola serie (sin leyenda),
// tooltip al pasar el dedo/mouse, línea de referencia del peso objetivo.
export default function WeightChart({ entries, goal }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);

  if (!entries || entries.length < 2) {
    return <p className="muted">Cargá al menos dos pesos para ver la evolución.</p>;
  }

  const W = 360;
  const H = 190;
  const P = { top: 14, right: 14, bottom: 26, left: 40 };

  const xs = entries.map((e) => new Date(e.date + 'T00:00:00').getTime());
  const ys = entries.map((e) => e.weight);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  let yMin = Math.min(...ys, goal || Infinity);
  let yMax = Math.max(...ys, goal || -Infinity);
  const pad = Math.max((yMax - yMin) * 0.15, 0.5);
  yMin -= pad;
  yMax += pad;

  const x = (t) => P.left + ((t - xMin) / (xMax - xMin || 1)) * (W - P.left - P.right);
  const y = (w) => P.top + (1 - (w - yMin) / (yMax - yMin || 1)) * (H - P.top - P.bottom);

  const points = entries.map((e, i) => ({ cx: x(xs[i]), cy: y(ys[i]), ...e }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');

  // 4 líneas de grilla horizontales
  const ticks = Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) * (i + 1)) / 5);

  const fmtShort = (iso) => {
    const [, m, d] = iso.split('-').map(Number);
    return `${d}/${m}`;
  };

  const onMove = (clientX) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.cx - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIdx(best);
  };

  const hover = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'pan-y' }}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHoverIdx(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => setHoverIdx(null)}
      >
        {/* grilla */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.left} x2={W - P.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={P.left - 6} y={y(t) + 3} fontSize="9" fill="var(--muted)" textAnchor="end">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {/* eje base */}
        <line x1={P.left} x2={W - P.right} y1={H - P.bottom} y2={H - P.bottom} stroke="var(--axis)" strokeWidth="1" />

        {/* línea de referencia: peso objetivo */}
        {goal && goal > yMin && goal < yMax ? (
          <g>
            <line
              x1={P.left}
              x2={W - P.right}
              y1={y(goal)}
              y2={y(goal)}
              stroke="var(--axis)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={W - P.right} y={y(goal) - 4} fontSize="9" fill="var(--muted)" textAnchor="end">
              objetivo {goal} kg
            </text>
          </g>
        ) : null}

        {/* serie */}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* crosshair + marcador */}
        {hover ? (
          <g>
            <line x1={hover.cx} x2={hover.cx} y1={P.top} y2={H - P.bottom} stroke="var(--axis)" strokeWidth="1" />
            <circle cx={hover.cx} cy={hover.cy} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        ) : null}

        {/* etiquetas de fechas: primera y última */}
        <text x={P.left} y={H - 8} fontSize="9" fill="var(--muted)">
          {fmtShort(entries[0].date)}
        </text>
        <text x={W - P.right} y={H - 8} fontSize="9" fill="var(--muted)" textAnchor="end">
          {fmtShort(entries[entries.length - 1].date)}
        </text>
      </svg>

      {hover ? (
        <div
          className="chart-tooltip"
          style={{ left: `${(hover.cx / W) * 100}%`, top: `${(hover.cy / H) * 100}%` }}
        >
          <strong>{hover.weight} kg</strong> · {fmtShort(hover.date)}
        </div>
      ) : null}
    </div>
  );
}
