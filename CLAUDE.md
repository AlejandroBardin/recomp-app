# Recomp — contexto para Claude

App web **personal, de un solo usuario** (Ale) para recomposición corporal:
registrar ejercicio, comidas, peso y hábitos, gamificada estilo RPG. Mobile
first, en español rioplatense (vos/tuteo), tono neutro y sin culpa.

## Stack y estructura

- **Frontend**: React + Vite en `frontend/` (puerto 5173 en dev, proxy `/api`).
  Vistas en `src/views/` (Héroe · Hoy · Ejercicio · Comida · Progreso),
  componentes en `src/components/`. CSS a mano en `src/styles.css`
  (variables, claro/oscuro automático).
- **Backend**: Express + better-sqlite3 en `backend/` (puerto 3001).
  Todo en `src/server.js` (API REST), `src/db.js` (esquema + seeds +
  migraciones implícitas con CREATE TABLE IF NOT EXISTS), `src/gamify.js`
  (XP, niveles, tiers). DB en `backend/data/recomp.db`.
- **Deploy**: Kamal a Oracle ARM → https://recomp.codemate.com.ar. Se dispara
  **a mano** desde GitHub → Actions → Deploy → Run workflow. DB de prod en el
  volumen `/opt/recomp/data` del servidor. Repo: `AlejandroBardin/recomp-app`.
- Levantar en dev: `node src/server.js` en backend + `npx vite` en frontend.

## Sistema de gamificación (detalle completo en GUIA_AVATAR.md)

- 5 pilares de XP: Físico (automático por ejercicio/peso), Alimentación,
  Hábitos, Oración, Trabajo (misiones diarias tildables en el tab Héroe).
- Niveles 1–100 con rangos (Pordiosero → Guerrero Celestial), racha 🔥.
- Avatar modular de capas PNG en `frontend/public/avatar/`:
  espíritu (fondo) → cuerpo → equipo → accesorios. Fallback: si falta un
  render, baja al tier anterior o usa el héroe SVG placeholder.

## Pipeline de assets del avatar

- Renders crudos (fondo blanco, apaisados) se procesan con
  `python scripts/procesar-render.py <origen.png> <capa-destino>` →
  recorta, transparenta y escala a 1024×1280 en `frontend/public/avatar/`.
- Convención de los renders de cuerpo que pasa Ale: `pordiosero-1.png` es el
  tier 0 y los numerados van corriendo uno (`2.png`→body-01, `3.png`→body-02,
  `4.png`→body-03...). El script borra solo textos/artefactos sueltos.
- Los PNGs crudos de la raíz **no se versionan** (solo los procesados).

## Estado actual (última sesión: 2026-07-13)

**Hecho y en producción (commits hasta `ee025b5`):**
- App base completa: registro de comidas (con autocompletado y flag "fuera de
  hambre real"), ejercicio (kcal por MET), peso, perfil, cálculos
  Mifflin-St Jeor, balance energético → grasa estimada.
- Gamificación completa + avatar. Renders de cuerpo cargados: **body-00 a
  body-05** (de 21). Faltan body-06..20, todo espíritu (10), equipo (6) y
  accesorios — la app funciona igual por los fallbacks.
- **Centro de ansiedad**: botón SOS flotante global → respiración guiada
  4-4-6 → acción concreta → registro (intensidad 1–5, disparador, resultado).
  +25 XP si pasó el impulso, +5 por registrar igual. `POST/GET/DELETE
  /api/anxiety` (GET trae stats con patrón por hora).
- **Historial día por día**: `GET /api/days` (agregado diario: comidas,
  ejercicio, misiones, peso, XP, ansiedad) + sección expandible en Progreso.
- **Hoy** mejorado: racha y XP del día en el header, barra de calorías netas
  vs objetivo con margen/exceso.

**Ideas pendientes (por orden de valor):**
- PWA instalable (ícono en el teléfono, offline).
- Autocompletado de alimentos con Open Food Facts / USDA — ya preparado:
  sumar resultados externos a `/api/foods/suggest`.
- Mostrar patrón horario de ansiedad cuando haya datos ("tus picos: 23 h").
- Seguir completando renders del avatar (usar body-00 como plantilla img2img
  para mantener pose y encuadre).

## Convenciones del proyecto

- Comentarios y UI en español; commits estilo `feat:` en español.
- Sin frameworks de CSS ni librerías extra: SVG/CSS a mano.
- Los deletes de registros siempre revierten su XP asociada
  (`xp_events` por `source` + `ref_id`).
- Verificar con: build de Vite + probar endpoints contra una DB temporal
  (`DB_PATH=... PORT=3199 node src/server.js`), nunca contra la DB real.
