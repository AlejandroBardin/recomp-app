// Registro del service worker (public/sw.js), solo en el build de produccion:
// en dev estorba al hot-reload de Vite y no aporta nada.
export function registrarSW() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('No se pudo registrar el service worker:', err);
    });
  });
}
