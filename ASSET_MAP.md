# Mapa de creación del avatar modular

El avatar se arma apilando capas PNG transparentes en este orden (de atrás hacia adelante):

```
spirit (aura/alas detrás) → body → gear → accesorios
```

Todas las imágenes van en **`frontend/public/avatar/`**. La app las detecta
automáticamente: si un archivo no existe, usa el héroe SVG de placeholder.
No hay que tocar código para agregar un render — solo soltar el archivo con
el nombre correcto.

## Especificación técnica (todas las capas)

- **Formato:** PNG con fondo transparente.
- **Tamaño:** 1024 × 1280 px (relación 4:5, igual que el contenedor de la app).
- **Pose:** frontal, de pie, brazos levemente separados. **La misma pose y
  encuadre en TODOS los renders** — es lo que permite apilar capas.
- **Estilo:** ilustración de fantasía épica limpia, tipo novela gráfica /
  concept art de videojuego.
- Truco para alinear: generar primero el cuerpo Tier 0 y usarlo como
  referencia/plantilla (img2img o "misma pose que esta imagen") para todo lo demás.

## Capa 1 — Cuerpo (21 renders) · pilar Físico

El tier se calcula interpolando entre el **primer peso registrado** y el
**peso objetivo del perfil** en 20 pasos. Con inicio 99.8 kg y objetivo 78 kg,
cada tier ≈ 1.1 kg perdidos.

| Archivo | Tier | Descripción |
|---|---|---|
| `body-00.png` | 0 | Inicio (~100 kg): postura encorvada, vientre prominente, barba descuidada, rostro cansado. |
| `body-01.png` … `body-05.png` | 1–5 | Primeros cambios: leve reducción abdominal, primer tono en brazos, postura algo mejor. |
| `body-06.png` … `body-10.png` | 6–10 | Progresión media: reducción visible de grasa, definición incipiente en pecho y abdomen. |
| `body-11.png` … `body-15.png` | 11–15 | Atlético en formación: cintura marcada, hombros anchos, se afeita y cuida. |
| `body-16.png` … `body-19.png` | 16–19 | Físico magro y musculoso, definición clara. |
| `body-20.png` | 20 | Físico divino: peso objetivo, tono de élite, piel radiante. |

> El cuerpo se dibuja con ropa interior neutra (paño simple); la ropa real la
> pone la capa de equipo encima.

## Capa 2 — Espíritu (10 renders) · pilar Oración

Overlays acumulativos. Tier según XP acumulada de oración:
`100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000, 6500`.

| Archivo | Elemento |
|---|---|
| `spirit-01.png` | Rosario simple de madera (cuello/mano). |
| `spirit-02.png` | Biblia rústica en el cinturón. |
| `spirit-03.png` | Aura sutil luminosa (overlay de luz). |
| `spirit-04.png` | Pequeña aureola sobre la cabeza. |
| `spirit-05.png` | Alas de luz nacientes, translúcidas. |
| `spirit-06.png` | Rosario plateado (mejora). |
| `spirit-07.png` | Alas emplumadas pequeñas, físicas. |
| `spirit-08.png` | Alas intermedias extendidas. |
| `spirit-09.png` | Alas celestiales grandes y radiantes. |
| `spirit-10.png` | Halo celestial complejo + alas arcangélicas con runas. |

## Capa 3 — Equipo (6 renders) · pilar Trabajo

Tier según XP acumulada de trabajo: `0, 300, 900, 2000, 3800, 6000`.

| Archivo | Tier | Descripción |
|---|---|---|
| `gear-1.png` | Pordiosero | Trapos sucios, sandalias rotas, palo rústico. |
| `gear-2.png` | Civil limpio | Túnica de lino limpia, zapatos de cuero simples, cinturón básico. |
| `gear-3.png` | Viajero | Botas resistentes, cinturón con herramientas, capa sencilla, reloj de latón. |
| `gear-4.png` | Guerrero novato | Armadura de cuero tachonado, espada simple, escudo rústico. |
| `gear-5.png` | Guerrero veterano | Placas de acero pulido, capa de oficial, espada de calidad, reloj complejo. |
| `gear-6.png` | Celestial | Armadura divina oro/blanco, casco resplandeciente, espada de luz, escudo con símbolo divino. |

## Capa 4 — Accesorios (14 renders) · misiones diarias

Se encienden/apagan según las misiones marcadas **hoy**. El nombre del archivo
usa la `key` de cada misión:

| Archivo | Misión | Idea visual |
|---|---|---|
| `acc-agua.png` | Beber 2 L de agua | Cantimplora en el cinturón. |
| `acc-verduras.png` | Porciones de verdura | Morral con hierbas frescas. |
| `acc-cocina.png` | Cocinar en casa | Cuchillo de chef / olla pequeña. |
| `acc-dia-limpio.png` | Día limpio | Runa de vitalidad brillante en el pecho. |
| `acc-cama.png` | Tender la cama | Manta enrollada en la espalda. |
| `acc-sueno.png` | Dormir 7–8 h | Ojos descansados / estrella en el hombro. |
| `acc-orden.png` | Espacio ordenado | Bolsa de mensajero prolija. |
| `acc-higiene.png` | Autocuidado | Rostro limpio y afeitado (overlay facial), toalla al cinturón. |
| `acc-oracion.png` | Oración/meditación | Destello de luz en las manos. |
| `acc-lectura.png` | Lectura inspiradora | Pergamino/cuaderno de notas. |
| `acc-servicio.png` | Asistir a un servicio | Emblema sagrado en la capa. |
| `acc-tareas.png` | Lista de tareas | Lista/pluma en el cinturón. |
| `acc-profundo.png` | Trabajo profundo | Linterna encendida. |
| `acc-meta.png` | Meta profesional | Medalla / gema en el cinturón. |

## Fases de generación sugeridas

1. **Fase 1 — La imagen inicial:** `body-00.png` + `gear-1.png`. Con esto ya
   se ve al Pordiosero completo. *(Tu primera imagen base va acá: si es un
   render completo con ropa incluida, guardala como `body-00.png` y generá el
   resto de cuerpos a partir de ella.)*
2. **Fase 2 — Cuerpos iniciales:** `body-01` a `body-05` (la bajada de peso
   rápida del principio, para ver cambios pronto).
3. **Fase 3 — Elementos diarios:** `spirit-01` (rosario) y los primeros
   accesorios (`acc-higiene`, `acc-cama`, `acc-agua`).
4. **Fase 4 — Mejora de tier:** `gear-2.png` (Civil limpio).
5. Continuar por demanda: siempre generar primero lo que el usuario está a
   punto de desbloquear.

**Total del banco:** 21 cuerpos + 10 espirituales + 6 equipos + 14 accesorios = **51 renders**.
