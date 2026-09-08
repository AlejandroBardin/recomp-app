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
  src/server.js   API REST (ejercicios, logs, comidas, pesos, perfil, resumen,
                  ansiedad, historial /api/days)
  src/seed.js     datos de ejemplo (idempotente: solo carga si no hay datos)
  data/recomp.db  la base de datos (se crea sola; backupeá este archivo)
frontend/
  src/views/      Héroe · Hoy · Ejercicio · Comida · Progreso (con historial)
  src/components/ WeightChart · Avatar · AnxietyFlow (botón SOS global)
```

## Centro de ansiedad

Botón **SOS** flotante, visible en toda la app. Abre un flujo guiado de tres
pasos: respiración 4-4-6 (4 rondas), una acción concreta a elegir (agua,
caminar, flexiones, etc.) y el registro del episodio (intensidad 1–5,
disparador opcional, si pasó el impulso). Superar el impulso da 25 XP del
pilar Hábitos; registrarlo igual da 5 (lo que se registra se puede mirar de
frente). Los episodios aparecen en el historial día por día de **Progreso**.

## Comidas: porciones y macros

Cada comida se carga con **cantidad + unidad** (g, ml, unidad o porción) y las
kcal. Si el alimento tiene referencia — porque salió de Open Food Facts o
porque ya lo cargaste antes — las kcal y los macros se calculan solos desde la
cantidad; si no, se ponen a mano y la app guarda la referencia dividiendo por
la cantidad, así la próxima vez ya la tiene (`frequent_foods.base_unit`).

Los macros son opcionales: lo que no se declara queda en `null`, no en cero. El
resumen del día informa qué porcentaje de las calorías tiene macros cargados,
para que un total bajo de proteína no se confunda con un registro incompleto.

El formulario está tanto en **Hoy** (fecha de hoy) como en **Comida** (la fecha
que estés mirando), así se puede completar un día que quedó sin cargar.

## Catálogo de ejercicios

876 ejercicios de [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(Unlicense) con nombre en español, MET, unidad y músculos, en
`backend/src/catalogo-ejercicios.json`. Al dar de alta un ejercicio el nombre
autocompleta contra ese catálogo y completa el resto del formulario; todo queda
editable. Regenerarlo:

```bash
node scripts/generar-catalogo-ejercicios.js [ruta/a/free-exercise-db]
```

## Cálculos

- **TMB**: Mifflin-St Jeor (`10·peso + 6.25·altura − 5·edad ± sexo`).
- **Gasto diario**: TMB × factor de actividad.
- **Déficit**: ritmo elegido (0.25–1 % del peso corporal por semana, con tope duro
  en 1 %) × peso × 7700 kcal/kg ÷ 7.
- **Calorías por ejercicio**: `MET × 3.5 × peso / 200 × minutos`. Para ejercicios
  por series sin tiempo se estiman ~2 min por serie.
- **Macros**: totales del día en gramos y en g/kg de peso. El objetivo de
  proteína por defecto es 1.8 g/kg (rango 1.6–2.2), que es el piso habitual
  para sostener masa magra en un déficit.

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

## Pendiente

- Macros en el historial día por día (`/api/days`) y en el acumulado de 30 días.
- Registro de suplementos y protocolos con duración (dosis, horario, día N de M).
- Panel de volumen de entrenamiento (series × reps × peso corporal).
