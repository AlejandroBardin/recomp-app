// El día de la app es el día en Buenos Aires, siempre.
//
// El contenedor corre en UTC, así que `new Date()` a las 22:30 de acá ya está
// en el día siguiente: una comida cargada de noche se sumaba al día que viene
// y "Hoy" aparecía vacío. Nada de esto puede depender de cómo esté configurado
// el servidor.
//
// La zona sale de Intl, no de la variable TZ: Intl trae su propia base de
// zonas horarias adentro de Node, así que esto da bien aunque el contenedor no
// tenga tzdata instalado. El TZ del Dockerfile es para lo otro — los
// `datetime('now','localtime')` que resuelve SQLite, que sí miran el sistema.

const ZONA = process.env.APP_TZ || 'America/Argentina/Buenos_Aires';

// en-CA da las fechas en YYYY-MM-DD, que es el formato que guarda la base.
const fFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit'
});
const fHora = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false
});

/** La fecha de hoy en Buenos Aires, 'YYYY-MM-DD'. */
const hoy = (d = new Date()) => fFecha.format(d);

/** La hora actual en Buenos Aires, 'HH:MM'. */
const ahora = (d = new Date()) => fHora.format(d);

/** Fecha y hora juntas, como las guarda SQLite: 'YYYY-MM-DD HH:MM:SS'. */
const ahoraCompleto = (d = new Date()) => {
  const segundos = String(d.getSeconds()).padStart(2, '0');
  return `${hoy(d)} ${ahora(d)}:${segundos}`;
};

/**
 * `n` días antes de `iso`. La cuenta va en UTC a propósito: sobre una fecha
 * sin hora, restar 86400000 ms es exacto y no lo corre ningún cambio de huso.
 */
const restarDias = (n, iso = hoy()) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

module.exports = { ZONA, hoy, ahora, ahoraCompleto, restarDias };
