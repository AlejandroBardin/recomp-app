# Genera los iconos de la PWA (los que van al home del telefono).
#
# Marca: tres barras ascendentes en blanco sobre el azul de acento de la app
# (--accent del styles.css). Sin tipografia ni assets externos, asi que el
# resultado es identico en cualquier maquina y el script se puede volver a
# correr cuando cambie la paleta.
#
# Fondo a sangre (sin esquinas redondeadas propias): tanto Android como iOS
# aplican su propia mascara, y el icono 512 se declara "maskable", que recorta
# hasta un 20% del borde. Por eso la marca vive en el 56% central, holgada
# dentro de la zona segura.
#
# Uso:
#   python scripts/generar-iconos.py
#
# Salida: frontend/public/icon-{180,192,512}.png
import os

from PIL import Image, ImageDraw

AZUL = (42, 120, 214, 255)   # --accent
BLANCO = (255, 255, 255, 255)
TAMANOS = [180, 192, 512]
SS = 4                        # supersampling: se dibuja 4x y se baja, para antialias

destino = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public')
os.makedirs(destino, exist_ok=True)


def dibujar(tam):
    S = tam * SS
    img = Image.new('RGBA', (S, S), AZUL)
    d = ImageDraw.Draw(img)

    base = 0.74 * S           # linea de piso comun a las tres barras
    ancho = 0.13 * S
    hueco = 0.065 * S
    x = 0.24 * S
    radio = ancho / 2         # extremos completamente redondeados

    for alto in (0.20 * S, 0.32 * S, 0.48 * S):
        d.rounded_rectangle([x, base - alto, x + ancho, base], radius=radio, fill=BLANCO)
        x += ancho + hueco

    return img.resize((tam, tam), Image.LANCZOS)


for tam in TAMANOS:
    ruta = os.path.join(destino, f'icon-{tam}.png')
    dibujar(tam).save(ruta, optimize=True)
    print(f'{os.path.relpath(ruta)}  ({os.path.getsize(ruta)} bytes)')
