// Mapa muscular: dos siluetas (frente y espalda) con una mancha por músculo,
// más oscura cuanto más volumen le pusiste en el período.
//
// No es una lámina de anatomía. Son formas simples puestas donde uno espera
// encontrar cada músculo: alcanza para leer de un vistazo qué venís castigando
// y qué no tocás hace semanas, que es la única pregunta que el mapa responde.
// Dibujado a mano con SVG, sin librerías, como el resto de la app.

// DSL corto para no repetir JSX: ['r', x, y, ancho, alto, radio],
// ['e', cx, cy, rx, ry] y ['p', d]. El cuerpo tiene dos de casi todo, así que
// casi todos los músculos son dos formas espejadas.
const forma = (f, i, props) => {
  if (f[0] === 'e') return <ellipse key={i} cx={f[1]} cy={f[2]} rx={f[3]} ry={f[4]} {...props} />;
  if (f[0] === 'p') return <path key={i} d={f[1]} {...props} />;
  return <rect key={i} x={f[1]} y={f[2]} width={f[3]} height={f[4]} rx={f[5]} {...props} />;
};

// Silueta de fondo, igual para los dos lados. El torso es un path y no un
// rectángulo: con la cintura recta la figura se leía como un robot.
const SILUETA = [
  ['e', 50, 16, 9, 10],                                    // cabeza
  ['r', 46, 23, 8, 11, 3],                                 // cuello
  ['p', 'M34,42 C34,35 39,32 44,32 L56,32 C61,32 66,35 66,42 L63,84 L65,106 C66,118 65,124 60,124 L40,124 C35,124 34,118 35,106 L37,84 Z'],
  ['r', 22, 38, 9.5, 40, 5], ['r', 68.5, 38, 9.5, 40, 5],  // brazos
  ['r', 21, 74, 8.5, 34, 4], ['r', 70.5, 74, 8.5, 34, 4],  // antebrazos
  ['r', 35, 118, 13.5, 56, 7], ['r', 51.5, 118, 13.5, 56, 7], // muslos
  ['r', 37, 170, 11, 46, 5], ['r', 52, 170, 11, 46, 5]     // piernas
];

const REGIONES = {
  front: {
    shoulders:  [['e', 29, 42, 7.5, 8], ['e', 71, 42, 7.5, 8]],
    chest:      [['r', 36, 40, 13, 17, 5], ['r', 51, 40, 13, 17, 5]],
    biceps:     [['r', 22.5, 50, 8.5, 26, 4], ['r', 69, 50, 8.5, 26, 4]],
    forearms:   [['r', 21.5, 76, 7.5, 30, 4], ['r', 71, 76, 7.5, 30, 4]],
    abdominals: [['r', 41, 60, 18, 44, 5]],
    abductors:  [['r', 34, 104, 7, 20, 4], ['r', 59, 104, 7, 20, 4]],
    quadriceps: [['r', 36, 122, 11.5, 48, 6], ['r', 52.5, 122, 11.5, 48, 6]],
    adductors:  [['r', 45.5, 126, 3.5, 38, 2], ['r', 51, 126, 3.5, 38, 2]]
  },
  back: {
    traps:         [['r', 40, 33, 20, 17, 5]],
    lats:          [['r', 35, 50, 11, 30, 5], ['r', 54, 50, 11, 30, 5]],
    'middle back': [['r', 45, 48, 10, 24, 4]],
    'lower back':  [['r', 40, 76, 20, 26, 5]],
    triceps:       [['r', 22.5, 50, 8.5, 26, 4], ['r', 69, 50, 8.5, 26, 4]],
    glutes:        [['r', 36, 102, 13, 22, 7], ['r', 51, 102, 13, 22, 7]],
    hamstrings:    [['r', 36, 124, 11.5, 44, 6], ['r', 52.5, 124, 11.5, 44, 6]],
    calves:        [['r', 37.5, 174, 10, 38, 5], ['r', 52.5, 174, 10, 38, 5]]
  }
};

function Figura({ view, titulo, porClave }) {
  return (
    <figure className="mmap-fig">
      <svg viewBox="0 0 100 226" role="img" aria-label={`Músculos, vista ${titulo.toLowerCase()}`}>
        <g fill="var(--grid)">
          {SILUETA.map((f, i) => forma(f, i, {}))}
        </g>
        {Object.entries(REGIONES[view]).map(([clave, formas]) => {
          const m = porClave[clave];
          const activo = m && m.value > 0;
          return (
            <g
              key={clave}
              fill={activo ? 'var(--accent)' : 'var(--axis)'}
              // Un músculo apenas tocado ya tiene que verse distinto del que no
              // tocaste, por eso el piso de 0.3 en vez de arrancar en 0.
              fillOpacity={activo ? 0.3 + m.intensity * 0.7 : 0.45}
            >
              {formas.map((f, i) => forma(f, i, {}))}
              <title>
                {m ? `${m.label}: ${m.value === 0 ? 'sin trabajar' : `${m.value} series equiv.`}` : clave}
              </title>
            </g>
          );
        })}
      </svg>
      <figcaption className="muted">{titulo}</figcaption>
    </figure>
  );
}

export default function MuscleMap({ data }) {
  if (!data) return null;

  const porClave = Object.fromEntries(data.muscles.map((m) => [m.key, m]));
  const trabajados = data.muscles.filter((m) => m.value > 0);

  if (trabajados.length === 0) {
    return (
      <p className="muted">
        Todavía no hay ejercicio registrado en este período. Cargá alguno y el mapa se pinta solo.
      </p>
    );
  }

  return (
    <>
      <div className="mmap">
        <Figura view="front" titulo="Frente" porClave={porClave} />
        <Figura view="back" titulo="Espalda" porClave={porClave} />
      </div>

      <div className="entry-list">
        {trabajados.map((m) => (
          <div className="pattern-row" key={m.key}>
            <span className="mmap-name">{m.label}</span>
            <div className="pattern-bar-track">
              <div className="pattern-bar" style={{ width: `${Math.max(4, m.intensity * 100)}%` }} />
            </div>
            <span className="pattern-count">{m.value}</span>
          </div>
        ))}
      </div>

      {data.untrained.length > 0 && (
        <p className="note">
          Sin tocar en {data.days} días: {data.untrained.join(', ')}.
        </p>
      )}

      {data.sinAsignar > 0 && (
        <p className="muted">
          {data.sinAsignar} series equivalentes quedaron fuera del mapa: son de ejercicios propios
          sin músculos asignados.
        </p>
      )}
    </>
  );
}
