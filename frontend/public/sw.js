/* Service worker de Recomp — cache en runtime, sin lista de precarga.
   Vite le pone un hash al nombre de cada asset, asi que no hace falta enumerar
   nada de antemano: se cachea lo que se va pidiendo.

   Dos politicas:
   - Inmutables (assets con hash, avatar, iconos): cache-first. Nunca cambian
     bajo el mismo nombre, y el avatar son PNG grandes que no conviene volver
     a bajar.
   - Todo lo demas: network-first con la cache de respaldo. Estando online
     siempre se ve la version fresca; sin conexion, la ultima que se vio.

   La API queda afuera a proposito: son los datos del dia y sirven de cero.
   Una respuesta vieja de /api/summary miente sobre las calorias de hoy, que es
   peor que un error de red honesto. */

const CACHE = 'recomp-v1';

// Sin conexion y sin nada cacheado: html minimo para que la navegacion no
// muera en el error del navegador.
const OFFLINE = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recomp — sin conexión</title>
<style>body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f9f9f7;
color:#0b0b0b;display:grid;place-items:center;min-height:100dvh;margin:0;padding:24px;
text-align:center;line-height:1.45}p{color:#898781;font-size:.9rem;margin-top:8px}
@media(prefers-color-scheme:dark){body{background:#0d0d0d;color:#fff}}</style>
</head><body><div><strong>Sin conexión</strong><p>Abrí la app de nuevo cuando vuelvas a tener red.</p></div></body></html>`;

const esInmutable = (url) =>
  url.pathname.startsWith('/assets/') ||
  url.pathname.startsWith('/avatar/') ||
  url.pathname.startsWith('/icon-');

// La primera carga de la pagina no la controla todavia el service worker, asi
// que si no guardaramos nada al instalar, instalar la app e irse sin señal
// dejaria la cache vacia. Bajamos la shell y los assets que ese HTML nombra:
// los nombres los pone Vite con un hash, asi que se leen del propio HTML en
// vez de mantener una lista a mano que se desactualiza en cada build.
async function precargar() {
  const cache = await caches.open(CACHE);
  const res = await fetch('/', { cache: 'reload' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put('/', res);
  const assets = [...new Set(
    [...html.matchAll(/(?:src|href)="(\/(?:assets|icon-)[^"]+)"/g)].map((m) => m[1])
  )];
  await Promise.all(assets.map((u) => cache.add(u).catch(() => {})));
}

self.addEventListener('install', (e) => {
  // Sin red al instalar no es motivo para abortar: la cache se llena sola despues.
  e.waitUntil(precargar().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Guarda una copia sin frenar la respuesta que ya va camino a la pagina.
function guardar(req, res) {
  if (res && res.ok && res.type === 'basic') {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/up') return;

  if (esInmutable(url)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => guardar(req, res)))
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => guardar(req, res))
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          // Una navegacion a cualquier ruta la resuelve el mismo index.html
          // (el backend hace lo mismo con su catch-all).
          // Cualquier ruta interna la resuelve la misma shell, que vive en la
          // cache bajo "/" (el backend hace lo mismo con su catch-all).
          if (req.mode === 'navigate') {
            return caches.match('/').then((shell) =>
              shell || new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
            );
          }
          return Response.error();
        })
      )
  );
});
