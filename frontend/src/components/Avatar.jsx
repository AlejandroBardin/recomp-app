import { useEffect, useState } from 'react';

// Avatar modular por capas. Cada capa busca su render en /avatar/:
//   body-00.png … body-20.png      (cuerpo, según progreso de peso)
//   gear-1.png  … gear-6.png       (equipo, según XP de trabajo)
//   spirit-01.png … spirit-10.png  (espíritu, según XP de oración)
//   acc-<key>.png                  (accesorios de misiones del día)
// Si el cuerpo base no existe todavía, dibuja un héroe SVG de placeholder
// que igual evoluciona: adelgaza, mejora su ropa y gana aura y alas.

const pad2 = (n) => String(n).padStart(2, '0');

// Colores de ropa por tier de equipo: harapos → lino → cuero → cuero
// reforzado → acero → oro celestial.
const GEAR_COLORS = ['#7a6a55', '#a89a80', '#8a6844', '#6e552f', '#8f9dad', '#e3bd4f'];
const GEAR_DARK = ['#5d5142', '#8a7d66', '#6d5236', '#54401f', '#6f7d8d', '#c19a2b'];

function PlaceholderHero({ body, spirit, gear }) {
  const belly = 46 - body; // 46 (tier 0) → 26 (tier 20)
  const shoulder = 25 + body * 0.65; // hombros más anchos al progresar
  const cloth = GEAR_COLORS[Math.max(0, gear - 1)];
  const dark = GEAR_DARK[Math.max(0, gear - 1)];
  const auraOpacity = spirit >= 3 ? 0.12 + spirit * 0.05 : 0;
  const cx = 110;

  return (
    <svg className="avatar-layer" viewBox="0 0 220 290" role="img" aria-label="Avatar del héroe">
      <defs>
        <radialGradient id="aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd75e" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#ffd75e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffd75e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {auraOpacity > 0 && <circle cx={cx} cy="150" r="120" fill="url(#aura)" opacity={auraOpacity} />}

      {/* alas: nacientes (7-8) y celestiales (9-10) */}
      {spirit >= 7 && (
        <g fill="#fff" opacity={spirit >= 9 ? 0.95 : 0.7} stroke="#e8d9a0" strokeWidth="1">
          <path d={spirit >= 9
            ? `M${cx - 38} 100 C 30 60, 8 120, 30 190 C 45 160, 60 135, ${cx - 34} 130 Z`
            : `M${cx - 36} 105 C 60 85, 48 125, 58 165 C 70 140, 80 125, ${cx - 32} 125 Z`} />
          <path d={spirit >= 9
            ? `M${cx + 38} 100 C 190 60, 212 120, 190 190 C 175 160, 160 135, ${cx + 34} 130 Z`
            : `M${cx + 36} 105 C 160 85, 172 125, 162 165 C 150 140, 140 125, ${cx + 32} 125 Z`} />
        </g>
      )}

      {/* aureola */}
      {spirit >= 4 && (
        <ellipse cx={cx} cy="24" rx="22" ry="6" fill="none" stroke="#ffd75e" strokeWidth={spirit >= 10 ? 4 : 2.5} opacity="0.9" />
      )}

      {/* cabeza */}
      <circle cx={cx} cy="52" r="20" fill="#d9b48f" />
      {/* barba descuidada en tiers bajos */}
      {body < 6 && <path d={`M${cx - 12} 58 Q ${cx} 78 ${cx + 12} 58 Q ${cx} 68 ${cx - 12} 58`} fill="#6b5744" />}
      {/* pelo */}
      <path d={`M${cx - 18} 46 Q ${cx} ${body < 6 ? 24 : 28} ${cx + 18} 46 Q ${cx} ${body < 6 ? 34 : 38} ${cx - 18} 46`} fill="#4a3b2c" />

      {/* brazos */}
      <line x1={cx - shoulder} y1="92" x2={cx - belly - 10} y2="150" stroke={cloth} strokeWidth="13" strokeLinecap="round" />
      <line x1={cx + shoulder} y1="92" x2={cx + belly + 10} y2="150" stroke={cloth} strokeWidth="13" strokeLinecap="round" />
      <circle cx={cx - belly - 10} cy="152" r="7" fill="#d9b48f" />
      <circle cx={cx + belly + 10} cy="152" r="7" fill="#d9b48f" />

      {/* torso: la panza se reduce con cada tier de cuerpo */}
      <rect x={cx - shoulder} y="80" width={shoulder * 2} height="24" rx="12" fill={cloth} />
      <ellipse cx={cx} cy="130" rx={belly} ry="46" fill={cloth} />
      {/* cinturón desde tier 2 de equipo */}
      {gear >= 2 && <rect x={cx - belly + 4} y="158" width={belly * 2 - 8} height="9" rx="4" fill={dark} />}

      {/* piernas */}
      <rect x={cx - 20} y="172" width="15" height="62" rx="7" fill={dark} />
      <rect x={cx + 5} y="172" width="15" height="62" rx="7" fill={dark} />
      <ellipse cx={cx - 12} cy="240" rx="13" ry="7" fill="#3b342b" />
      <ellipse cx={cx + 13} cy="240" rx="13" ry="7" fill="#3b342b" />

      {/* espada desde tier 4, escudo desde tier 5 */}
      {gear >= 4 && (
        <g>
          <line x1={cx + belly + 10} y1="148" x2={cx + belly + 34} y2="70" stroke={gear >= 6 ? '#ffe9a0' : '#c7cdd6'} strokeWidth="6" strokeLinecap="round" />
          <line x1={cx + belly + 4} y1="132" x2={cx + belly + 22} y2="140" stroke={dark} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {gear >= 5 && (
        <path
          d={`M${cx - belly - 28} 118 h30 v26 q0 16 -15 22 q-15 -6 -15 -22 Z`}
          fill={gear >= 6 ? '#f4d675' : '#aab4c2'} stroke={dark} strokeWidth="2"
        />
      )}
    </svg>
  );
}

export default function Avatar({ body = 0, spirit = 0, gear = 1, accessories = [] }) {
  const [missing, setMissing] = useState({});
  // Si el render exacto del tier no existe todavía, se usa el más cercano
  // hacia abajo (body-02 → body-01 → body-00). Sin ninguno, placeholder SVG.
  const [bodyTier, setBodyTier] = useState(body);
  useEffect(() => {
    setMissing({});
    setBodyTier(body);
  }, [body, spirit, gear]);

  const layer = (src, key, alt = '') =>
    missing[key] ? null : (
      <img
        key={key}
        className="avatar-layer"
        src={src}
        alt={alt}
        onError={() => setMissing((m) => ({ ...m, [key]: true }))}
      />
    );

  const hasRealBody = bodyTier >= 0;

  return (
    <div className={`avatar-box ${spirit >= 3 ? 'glowing' : ''}`}>
      {!hasRealBody && <PlaceholderHero body={body} spirit={spirit} gear={gear} />}
      {hasRealBody && (
        <img
          className="avatar-layer"
          src={`/avatar/body-${pad2(bodyTier)}.png`}
          alt="Cuerpo"
          onError={() => setBodyTier((t) => t - 1)}
        />
      )}
      {hasRealBody && layer(`/avatar/gear-${gear}.png`, `gear-${gear}`)}
      {hasRealBody && spirit > 0 && layer(`/avatar/spirit-${pad2(spirit)}.png`, `spirit-${spirit}`)}
      {hasRealBody && accessories.map((key) => layer(`/avatar/acc-${key}.png`, `acc-${key}`))}
    </div>
  );
}
