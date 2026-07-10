# Prepara un render del avatar para la app:
#   1. Fondo blanco -> transparente (flood fill desde los bordes).
#   2. Bolsillos de fondo encerrados (entre brazo y torso) -> transparentes.
#   3. Conserva solo la figura principal (elimina manchas y artefactos sueltos).
#   4. Recorta al canal alfa, agrega margen, encaja en 4:5 y escala a 1024x1280.
#
# Uso:
#   python scripts/procesar-render.py <origen.png> <capa-destino>
#   python scripts/procesar-render.py pordiosero-1.png body-00
#   python scripts/procesar-render.py rosario.png spirit-01 --threshold 240
#
# El resultado queda en frontend/public/avatar/<capa-destino>.png
import argparse
import os
from collections import deque

from PIL import Image

parser = argparse.ArgumentParser(description='Procesa un render del avatar')
parser.add_argument('src', help='imagen de origen (con fondo blanco)')
parser.add_argument('layer', help='nombre de capa destino, ej. body-00, gear-2, spirit-03')
parser.add_argument('--threshold', type=int, default=224,
                    help='qué tan blanco debe ser un pixel para ser fondo (0-255, default 224)')
parser.add_argument('--pocket-min', type=int, default=1500,
                    help='tamaño mínimo en px de un bolsillo de fondo encerrado (default 1500)')
parser.add_argument('--overlay', action='store_true',
                    help='capa que se apila sobre el cuerpo (gear/spirit/acc): NO recorta ni '
                         'recentra, para no romper la alineación con el render del cuerpo')
args = parser.parse_args()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'frontend', 'public', 'avatar', f'{args.layer}.png')
T = args.threshold

img = Image.open(args.src).convert('RGBA')
w, h = img.size
px = img.load()

def is_white(p):
    return p[3] > 0 and p[0] >= T and p[1] >= T and p[2] >= T

def flood(seeds, passable, paint):
    visited = bytearray(w * h)
    q = deque()
    for x, y in seeds:
        if passable(px[x, y]) and not visited[y * w + x]:
            visited[y * w + x] = 1
            q.append((x, y))
    while q:
        x, y = q.popleft()
        paint(x, y)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny * w + nx] and passable(px[nx, ny]):
                visited[ny * w + nx] = 1
                q.append((nx, ny))

# 1. fondo conectado a los bordes
edges = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
flood(edges, is_white, lambda x, y: px.__setitem__((x, y), (255, 255, 255, 0)))

# 2. bolsillos blancos internos grandes
seen = bytearray(w * h)
for sy in range(h):
    for sx in range(w):
        if seen[sy * w + sx] or not is_white(px[sx, sy]):
            continue
        comp = []
        q = deque([(sx, sy)])
        seen[sy * w + sx] = 1
        while q:
            x, y = q.popleft()
            comp.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_white(px[nx, ny]):
                    seen[ny * w + nx] = 1
                    q.append((nx, ny))
        if len(comp) > args.pocket_min:
            for x, y in comp:
                px[x, y] = (255, 255, 255, 0)

# 3. conservar solo el componente opaco más grande
seen = bytearray(w * h)
components = []
for sy in range(0, h, 2):
    for sx in range(0, w, 2):
        if seen[sy * w + sx] or px[sx, sy][3] == 0:
            continue
        comp = []
        q = deque([(sx, sy)])
        seen[sy * w + sx] = 1
        while q:
            x, y = q.popleft()
            comp.append((x, y))
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] > 0:
                    seen[ny * w + nx] = 1
                    q.append((nx, ny))
        components.append(comp)
components.sort(key=len, reverse=True)
if components:
    # un overlay puede tener piezas separadas legítimas (botas, espada, cinturón):
    # ahí solo se eliminan motas chicas; en un cuerpo se conserva solo la figura
    drop = [c for c in components[1:] if len(c) < 400] if args.overlay else components[1:]
    for comp in drop:
        for x, y in comp:
            px[x, y] = (255, 255, 255, 0)

# 4a. overlay: conservar el encuadre original (debe coincidir con el del cuerpo)
if args.overlay:
    canvas = img.resize((1024, 1280), Image.LANCZOS)
# 4b. cuerpo: recorte por canal alfa, margen 4%, lienzo 4:5, figura apoyada abajo
else:
    img = img.crop(img.split()[-1].getbbox())
    w, h = img.size
    margin = int(max(w, h) * 0.04)
    cw, ch = w + margin * 2, h + margin * 2
    if cw / ch < 4 / 5:
        cw = int(ch * 4 / 5)
    else:
        ch = int(cw * 5 / 4)
    canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    canvas.paste(img, ((cw - w) // 2, ch - h - margin), img)
    canvas = canvas.resize((1024, 1280), Image.LANCZOS)
canvas.save(DST)
print(f'guardado: {DST}')
print(f'artefactos eliminados: {len(components) - 1}')
print('recordá: npx vite build en frontend/ (o copiar a frontend/dist/avatar/) para verlo en el server')
