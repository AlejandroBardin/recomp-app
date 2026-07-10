# Recomp — seguimiento de recomposición corporal

App web personal, de un solo usuario, para registrar ejercicio, comidas y peso con
tono neutro e informativo. Mobile first (pensada para usarse desde el teléfono),
React + Node + SQLite.

## Correr localmente

Requiere Node 20+.

```bash
# 1. Backend (puerto 3001)
cd backend
npm install
npm run seed     # opcional: carga datos de ejemplo para probar ya mismo
npm run dev

# 2. Frontend (puerto 5173) — en otra terminal
cd frontend
npm install
npm run dev
```

Abrir **http://localhost:5173**. El dev server de Vite proxya `/api` al backend.

> El seed crea un perfil de ejemplo (178 cm, 35 años, actividad ligera, objetivo
> 85 kg). Editalo con tus datos reales en la pestaña **Progreso**.

## Estructura

```
backend/
  src/db.js       esquema SQLite + 9 ejercicios base precargados
  src/server.js   API REST (ejercicios, logs, comidas, pesos, perfil, resumen)
  src/seed.js     datos de ejemplo (idempotente: solo carga si no hay datos)
  data/recomp.db  la base de datos (se crea sola; backupeá este archivo)
frontend/
  src/views/      Hoy · Ejercicio · Comida · Progreso
  src/components/WeightChart.jsx
```

## Cálculos

- **TMB**: Mifflin-St Jeor (`10·peso + 6.25·altura − 5·edad ± sexo`).
- **Gasto diario**: TMB × factor de actividad.
- **Déficit**: ritmo elegido (0.25–1 % del peso corporal por semana, con tope duro
  en 1 %) × peso × 7700 kcal/kg ÷ 7.
- **Calorías por ejercicio**: `MET × 3.5 × peso / 200 × minutos`. Para ejercicios
  por series sin tiempo se estiman ~2 min por serie.

## Deploy en servidor (Oracle ARM)

Mismo esquema que cursos-app: **Kamal** + kamal-proxy con SSL, en un contenedor
propio, disponible en **https://recomp.codemate.com.ar**. El deploy se dispara a
mano desde GitHub → Actions → **Deploy** → *Run workflow*.

Requiere en el repo de GitHub los secrets `SSH_PRIVATE_KEY` y `DOCKER_HUB_TOKEN`
(los mismos valores que usa cursos-app), y un registro DNS
`recomp.codemate.com.ar → 140.238.178.169`.

- Config: `config/deploy.yml` (servicio `recomp`, imagen `alebardin/app-recomp`,
  puerto 3001, build aarch64 remoto en el servidor).
- La DB vive en el volumen `/opt/recomp/data` del servidor. Backup: copiar
  `/opt/recomp/data/recomp.db`.
- Seed inicial en el servidor: `kamal app exec 'node src/seed.js'` (o entrar al
  contenedor con `kamal app exec -i bash`).

También se puede correr suelto con Docker Compose (`docker compose up -d --build`,
queda en el puerto 3001) — útil para probar la imagen localmente.

## Pendiente para v2 (dejado preparado)

- Integración con una API de alimentos (Open Food Facts / USDA FoodData Central):
  el autocompletado ya pasa por `/api/foods/suggest`, alcanza con sumar resultados
  externos a esa respuesta.
