# Guía del sistema de gamificación y del avatar

Contexto completo del sistema de personaje: cómo funciona la XP, cómo se
eligen las capas del avatar, y **cómo incorporar imágenes nuevas** (incluso
con fondo blanco). Complementa a `ASSET_MAP.md`, que lista los 51 renders
del banco con sus nombres de archivo.

## 1. Cómo funciona el sistema

### Los 5 pilares y de dónde sale la XP

| Pilar | Cómo suma XP |
|---|---|
| **Físico** | Automático: cada ejercicio registrado da 10–60 XP (1 XP cada 5 kcal). Cada nuevo mínimo histórico de peso da 10 XP por cada 100 g bajados. Borrar un registro devuelve la XP. |
| **Alimentación** | Misiones diarias: agua (15), verduras (15), cocinar en casa (20), día limpio (25). |
| **Hábitos** | Misiones: tender la cama (10), sueño 7–8 h (20), orden (10), autocuidado (10). |
| **Oración** | Misiones: 15 min de oración/meditación (20), lectura (15), servicio (30). |
| **Trabajo** | Misiones: lista de tareas (20), 4 h profundas (30), meta profesional (50). |

Las misiones se tildan en el tab **Héroe** y se pueden destildar (revierte la
XP). Se pueden crear misiones propias vía `POST /api/habits` y desactivar con
`DELETE /api/habits/:id`.

### Niveles y rangos

- Curva 1→100: subir del nivel N cuesta `100 + N×8` XP (~49.500 XP totales).
  Un día completo rinde ~250–300 XP → nivel 100 en ~8 meses.
- Rangos: 1 Pordiosero · 10 Civil · 25 Aspirante · 40 Escudero · 55 Guerrero
  Novato · 70 Guerrero · 85 Guerrero Veterano · 100 **Guerrero Celestial**.
- **Racha** 🔥: días consecutivos con al menos un evento de XP.
- El esfuerzo previo a la gamificación se reconoció con un *backfill*: los
  ejercicios y bajadas de peso ya registrados dieron su XP la primera vez que
  arrancó el servidor con este sistema.

### Tiers del avatar (las 4 capas)

| Capa | Tiers | Se calcula con | Archivos |
|---|---|---|---|
| Cuerpo | 0–20 | Progreso de peso: interpola entre el **primer peso registrado** y el **peso objetivo** del perfil. | `body-00.png` … `body-20.png` |
| Equipo | 1–6 | XP acumulada de Trabajo: 0, 300, 900, 2000, 3800, 6000. | `gear-1.png` … `gear-6.png` |
| Espíritu | 0–10 | XP acumulada de Oración: 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500. | `spirit-01.png` … `spirit-10.png` |
| Accesorios | on/off | Misiones tildadas **hoy** (por su `key`). | `acc-agua.png`, `acc-cama.png`, … |

> **Importante:** el tier de cuerpo NO depende del nivel. Depende del peso.
> Ejemplo real: con 99 → 97.4 kg y objetivo 85 kg ya sos "Cuerpo 2/20",
> aunque el nivel sea 3.

### Fallback de imágenes (por qué "no se ve" un render)

El avatar busca el archivo exacto de su tier. Si no existe:

1. **Cuerpo:** baja al tier anterior hasta encontrar uno (`body-02` →
   `body-01` → `body-00`). Si no hay ninguno, dibuja el héroe SVG de
   placeholder (que también evoluciona: adelgaza, mejora la ropa, gana aura
   y alas).
2. **Equipo / Espíritu / Accesorios:** si el archivo no existe, la capa
   simplemente no se muestra.

O sea: con solo `body-00.png` en la carpeta, el avatar real se ve siempre,
en cualquier tier.

## 2. Cómo agregar una imagen nueva

### Requisitos del render ideal

- PNG, idealmente con fondo transparente (si viene con fondo blanco, ver abajo).
- Figura completa, frontal, de pie, brazos algo separados del cuerpo.
- **Siempre la misma pose y encuadre** — es lo que permite apilar capas.
  Truco: generar cada render nuevo con img2img sobre `body-00.png` como
  referencia de pose.

### Si la imagen viene con fondo blanco (el caso normal)

Usar el script del repo (requiere Python + Pillow):

```bash
# cuerpos (recorta, centra y encaja en 4:5):
python scripts/procesar-render.py mi-imagen.png body-01

# overlays de equipo/espíritu/accesorios (conserva el encuadre para
# no romper la alineación con el cuerpo — NO recorta):
python scripts/procesar-render.py rosario.png spirit-01 --overlay
```

El script hace: fondo blanco → transparente (flood fill desde los bordes,
así no borra blancos internos de la figura), limpia bolsillos de fondo
encerrados (entre brazo y torso), elimina manchas/artefactos sueltos,
recorta al canal alfa y escala a 1024×1280 (4:5). El resultado queda
directo en `frontend/public/avatar/`.

Si el fondo no es blanco puro (velo gris, sombras), ajustar el umbral:
`--threshold 210` (más agresivo) o `--threshold 245` (más conservador).

### Publicar el cambio

Los archivos de `frontend/public/` entran al build. Después de agregar
renders:

```bash
cd frontend && npx vite build
```

(o copiar el PNG también a `frontend/dist/avatar/` si no querés recompilar).
Refrescar el navegador y listo — no hay que tocar código.

## 3. Correr la app

```bash
cd backend && node src/server.js   # sirve API + frontend build en http://localhost:3001
```

Si el puerto 3001 está ocupado por una instancia vieja, matar ese proceso
primero (en PowerShell: `Get-NetTCPConnection -LocalPort 3001` para el PID).

## 4. Endpoints nuevos (referencia rápida)

| Endpoint | Qué hace |
|---|---|
| `GET /api/character` | Estado completo: nivel, rango, XP, racha, pilares, tiers de cuerpo/espíritu/equipo, accesorios del día. |
| `GET /api/habits?date=` | Misiones con su estado (`done`) para la fecha. |
| `POST /api/habits/:id/toggle` | Tilda/destilda una misión (otorga/revierte XP). |
| `POST /api/habits` | Crea una misión propia (`{name, pillar, xp}`). |
| `DELETE /api/habits/:id` | Desactiva una misión. |

Tablas nuevas en SQLite: `habits`, `habit_logs`, `xp_events`.

## 5. Estado actual y próximos pasos del arte

- ✅ Motor completo de XP/niveles/rachas/misiones + tab Héroe.
- ✅ `body-00.png` (Pordiosero Tier 0) procesado e integrado.
- ⏭️ Fase 2: `body-01` … `body-05` (la bajada rápida inicial, ~1 kg por tier).
- ⏭️ Fase 3: `spirit-01` (rosario) y primeros accesorios (`acc-higiene`,
  `acc-cama`, `acc-agua`).
- ⏭️ Fase 4: `gear-2` (Civil limpio).

El detalle completo de los 51 renders está en `ASSET_MAP.md`.
