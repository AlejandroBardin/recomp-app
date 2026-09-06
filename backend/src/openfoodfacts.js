// Búsqueda de alimentos en Open Food Facts.
//
// Usa search.openfoodfacts.org ("search-a-licious"), que es el único de los
// tres buscadores de OFF que sirve acá:
//   - /api/v2/search ignora search_terms: devuelve la base entera (4,7 M de
//     productos) sin filtrar por el texto. Inservible.
//   - /cgi/search.pl sí busca por texto, pero está rate-limiteado y contesta
//     HTML en cuanto le pegás dos veces seguidas.
//   - search.openfoodfacts.org busca bien, acepta `fields` y devuelve un
//     `nutriments` compacto en vez del objeto de 100+ claves de los otros.
//
// Nada de esto es crítico: si OFF no contesta, el autocompletado sigue
// funcionando con los alimentos que ya usaste. Nunca propaga el error.
const BASE = 'https://search.openfoodfacts.org/search';

// OFF pide identificarse en el User-Agent. No mandamos nada del usuario: solo
// el texto que tipeó para buscar.
const UA = 'Recomp/1.0 (app personal de recomposición corporal; self-hosted)';

const TIMEOUT_MS = 3500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

const cache = new Map(); // consulta -> { t, items }

// Muchos productos vienen sin calorías cargadas, o con el código de barras en
// lugar del nombre. Sin esas dos cosas la sugerencia no sirve para nada.
const usable = (p) => {
  const kcal = p?.nutriments?.['energy-kcal_100g'];
  const name = (p?.product_name || '').trim();
  return name && !/^\d{6,}$/.test(name) && Number.isFinite(kcal) && kcal > 0;
};

const esArgentino = (p) => (p.countries_tags || []).includes('en:argentina');

/**
 * Busca `q` en Open Food Facts. Devuelve como mucho `limit` sugerencias
 * `{ source: 'off', name, brand, kcalPer100g }`, con los productos argentinos
 * primero. Ante cualquier error devuelve [].
 */
async function buscarAlimentos(q, limit = 6) {
  const clave = q.trim().toLowerCase();
  if (clave.length < 3) return [];

  const hit = cache.get(clave);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.items.slice(0, limit);

  const url = `${BASE}?q=${encodeURIComponent(clave)}&page_size=25`
    + '&fields=product_name,brands,nutriments,countries_tags';

  let items = [];
  try {
    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let data;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      if (!res.ok) return [];
      data = await res.json();
    } finally {
      clearTimeout(corte);
    }

    const hits = Array.isArray(data?.hits) ? data.hits.filter(usable) : [];
    // No se filtra por país en la consulta: acotarla a Argentina pasa de 223 a
    // 40 resultados y se pierden coincidencias buenas. Se ordena en su lugar.
    hits.sort((a, b) => esArgentino(b) - esArgentino(a));

    const vistos = new Set();
    for (const p of hits) {
      const name = p.product_name.trim();
      const k = name.toLowerCase();
      if (vistos.has(k)) continue;
      vistos.add(k);
      items.push({
        source: 'off',
        name,
        brand: Array.isArray(p.brands) ? p.brands[0] || null : p.brands || null,
        kcalPer100g: Math.round(p.nutriments['energy-kcal_100g'])
      });
    }
  } catch {
    return []; // timeout, DNS, OFF caído: el autocompletado local sigue andando
  }

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(clave, { t: Date.now(), items });
  return items.slice(0, limit);
}

module.exports = { buscarAlimentos };
