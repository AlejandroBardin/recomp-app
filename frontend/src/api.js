async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

const json = (method) => (url, body) =>
  request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

export const api = {
  get: (url) => request(url),
  post: json('POST'),
  put: json('PUT'),
  patch: json('PATCH'),
  del: (url) => request(url, { method: 'DELETE' })
};

// El día de la app es el día en Buenos Aires, igual que en el backend. Con la
// hora del navegador, abrirla desde otro huso mostraría un "hoy" distinto del
// que guarda el servidor y el día aparecería vacío.
const ZONA = 'America/Argentina/Buenos_Aires';
const fFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit'
});

export const todayStr = () => fFecha.format(new Date());

export const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
};
