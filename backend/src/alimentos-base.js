// Alimentos comunes con sus macros, para que la primera carga de un alimento
// de todos los días no sea a mano.
//
// Open Food Facts sirve para productos envasados con código de barras, pero no
// tiene "un huevo", "un tomate" ni "un chorrito de aceite": esos son la mitad
// de lo que uno come. Esta lista cubre esa mitad.
//
// Los valores son por 100 g (o 100 ml en líquidos), redondeados, de tablas de
// composición de alimentos (USDA FoodData Central y la tabla SARA/CENEXA para
// los cortes y productos argentinos). Son referencias, no la etiqueta exacta
// de lo que tenés en la heladera: si el paquete dice otra cosa, ganás vos —
// cargalo a mano una vez y la app se queda con tu número.
//
// `u` es la unidad natural del alimento y cuánto pesa: sirve para cargar
// "2 huevos" o "1 cucharada de aceite" sin tener que pesar nada.

const ALIMENTOS = [
  // ---------- Carnes y pescados ----------
  { n: 'Pechuga de pollo (cocida)', kcal: 165, p: 31, g: 3.6, c: 0, f: 0 },
  { n: 'Pata muslo de pollo (cocida, sin piel)', kcal: 209, p: 26, g: 10.9, c: 0, f: 0 },
  { n: 'Carne picada magra (cocida)', kcal: 215, p: 26, g: 12, c: 0, f: 0 },
  { n: 'Lomo / bife de lomo (cocido)', kcal: 212, p: 30, g: 9.6, c: 0, f: 0 },
  { n: 'Nalga / peceto (cocido)', kcal: 190, p: 32, g: 6, c: 0, f: 0 },
  { n: 'Asado / tira de asado (cocido)', kcal: 291, p: 26, g: 20, c: 0, f: 0 },
  { n: 'Bondiola de cerdo (cocida)', kcal: 250, p: 27, g: 15, c: 0, f: 0 },
  { n: 'Milanesa de carne (frita)', kcal: 280, p: 20, g: 17, c: 12, f: 0.8 },
  { n: 'Atún al natural (escurrido)', kcal: 116, p: 25.5, g: 0.8, c: 0, f: 0, u: { n: 'lata', g: 120 } },
  { n: 'Atún en aceite (escurrido)', kcal: 198, p: 29, g: 8.2, c: 0, f: 0, u: { n: 'lata', g: 120 } },
  { n: 'Caballa en aceite (escurrida)', kcal: 205, p: 24, g: 11.9, c: 0, f: 0, u: { n: 'lata', g: 125 } },
  { n: 'Merluza (cocida)', kcal: 105, p: 23, g: 1, c: 0, f: 0 },
  { n: 'Salmón (cocido)', kcal: 208, p: 22, g: 13, c: 0, f: 0 },
  { n: 'Jamón cocido', kcal: 145, p: 18, g: 8, c: 1.5, f: 0, u: { n: 'feta', g: 20 } },
  { n: 'Salchicha', kcal: 300, p: 11, g: 27, c: 2, f: 0, u: { n: 'salchicha', g: 45 } },

  // ---------- Huevos y lácteos ----------
  { n: 'Huevo', kcal: 143, p: 12.6, g: 9.5, c: 0.7, f: 0, u: { n: 'huevo', g: 50 } },
  { n: 'Clara de huevo', kcal: 52, p: 10.9, g: 0.2, c: 0.7, f: 0, u: { n: 'clara', g: 33 } },
  { n: 'Leche entera', kcal: 61, p: 3.2, g: 3.3, c: 4.8, f: 0, u: { n: 'vaso (200 ml)', g: 200 } },
  { n: 'Leche descremada', kcal: 35, p: 3.4, g: 0.1, c: 5, f: 0, u: { n: 'vaso (200 ml)', g: 200 } },
  { n: 'Yogur natural entero', kcal: 61, p: 3.5, g: 3.3, c: 4.7, f: 0, u: { n: 'pote (190 g)', g: 190 } },
  { n: 'Yogur descremado', kcal: 41, p: 4.3, g: 0.2, c: 5.6, f: 0, u: { n: 'pote (190 g)', g: 190 } },
  { n: 'Queso port salut', kcal: 330, p: 22, g: 26, c: 1, f: 0, u: { n: 'feta', g: 25 } },
  { n: 'Queso cremoso', kcal: 300, p: 18, g: 25, c: 2, f: 0, u: { n: 'feta', g: 25 } },
  { n: 'Queso rallado', kcal: 392, p: 36, g: 26, c: 3, f: 0, u: { n: 'cucharada', g: 6 } },
  { n: 'Ricota entera', kcal: 174, p: 11, g: 13, c: 3, f: 0, u: { n: 'cucharada', g: 30 } },
  { n: 'Queso untable descremado', kcal: 120, p: 10, g: 7, c: 4, f: 0, u: { n: 'cucharada', g: 15 } },
  { n: 'Manteca', kcal: 717, p: 0.9, g: 81, c: 0.1, f: 0, u: { n: 'cucharada', g: 14 } },
  { n: 'Dulce de leche', kcal: 315, p: 6, g: 7, c: 56, f: 0, u: { n: 'cucharada', g: 20 } },

  // ---------- Legumbres ----------
  { n: 'Lentejas (cocidas)', kcal: 116, p: 9, g: 0.4, c: 20, f: 7.9 },
  { n: 'Garbanzos (cocidos)', kcal: 164, p: 8.9, g: 2.6, c: 27, f: 7.6 },
  { n: 'Porotos negros (cocidos)', kcal: 132, p: 8.9, g: 0.5, c: 24, f: 8.7 },
  { n: 'Arvejas (cocidas)', kcal: 84, p: 5.4, g: 0.2, c: 15, f: 5.5 },
  { n: 'Soja texturizada (seca)', kcal: 330, p: 50, g: 1.5, c: 30, f: 18 },

  // ---------- Cereales, panificados y papas ----------
  { n: 'Arroz blanco (cocido)', kcal: 130, p: 2.7, g: 0.3, c: 28, f: 0.4 },
  { n: 'Arroz integral (cocido)', kcal: 123, p: 2.7, g: 1, c: 26, f: 1.6 },
  { n: 'Fideos (cocidos)', kcal: 158, p: 5.8, g: 0.9, c: 31, f: 1.8 },
  { n: 'Avena en hojuelas', kcal: 389, p: 16.9, g: 6.9, c: 66, f: 10.6, u: { n: 'cucharada', g: 10 } },
  { n: 'Pan francés', kcal: 277, p: 8.5, g: 1.5, c: 55, f: 2.7, u: { n: 'mignón', g: 60 } },
  { n: 'Pan lactal integral', kcal: 250, p: 10, g: 3.5, c: 43, f: 6, u: { n: 'rebanada', g: 28 } },
  { n: 'Galletitas de agua', kcal: 420, p: 9, g: 10, c: 72, f: 3, u: { n: 'galletita', g: 6 } },
  { n: 'Papa (hervida)', kcal: 87, p: 1.9, g: 0.1, c: 20, f: 1.8, u: { n: 'papa mediana', g: 150 } },
  { n: 'Batata (hervida)', kcal: 90, p: 2, g: 0.1, c: 21, f: 3.3 },
  { n: 'Polenta (cocida)', kcal: 85, p: 2, g: 0.4, c: 18, f: 1 },
  { n: 'Harina de trigo 000', kcal: 364, p: 10, g: 1, c: 76, f: 2.7 },

  // ---------- Verduras ----------
  { n: 'Tomate', kcal: 18, p: 0.9, g: 0.2, c: 3.9, f: 1.2, u: { n: 'tomate', g: 120 } },
  { n: 'Lechuga', kcal: 15, p: 1.4, g: 0.2, c: 2.9, f: 1.3 },
  { n: 'Cebolla', kcal: 40, p: 1.1, g: 0.1, c: 9.3, f: 1.7, u: { n: 'cebolla', g: 110 } },
  { n: 'Zanahoria', kcal: 41, p: 0.9, g: 0.2, c: 9.6, f: 2.8, u: { n: 'zanahoria', g: 60 } },
  { n: 'Zapallo / calabaza', kcal: 26, p: 1, g: 0.1, c: 6.5, f: 0.5 },
  { n: 'Brócoli', kcal: 34, p: 2.8, g: 0.4, c: 6.6, f: 2.6 },
  { n: 'Zapallito', kcal: 17, p: 1.2, g: 0.3, c: 3.1, f: 1 },
  { n: 'Morrón', kcal: 26, p: 1, g: 0.3, c: 6, f: 2.1, u: { n: 'morrón', g: 120 } },
  { n: 'Espinaca', kcal: 23, p: 2.9, g: 0.4, c: 3.6, f: 2.2 },
  { n: 'Palta', kcal: 160, p: 2, g: 14.7, c: 8.5, f: 6.7, u: { n: 'palta', g: 150 } },
  { n: 'Choclo (grano)', kcal: 86, p: 3.3, g: 1.4, c: 19, f: 2 },
  { n: 'Berenjena', kcal: 25, p: 1, g: 0.2, c: 5.9, f: 3 },

  // ---------- Frutas ----------
  { n: 'Banana', kcal: 89, p: 1.1, g: 0.3, c: 22.8, f: 2.6, u: { n: 'banana', g: 120 } },
  { n: 'Manzana', kcal: 52, p: 0.3, g: 0.2, c: 13.8, f: 2.4, u: { n: 'manzana', g: 180 } },
  { n: 'Naranja', kcal: 47, p: 0.9, g: 0.1, c: 11.8, f: 2.4, u: { n: 'naranja', g: 150 } },
  { n: 'Pera', kcal: 57, p: 0.4, g: 0.1, c: 15, f: 3.1, u: { n: 'pera', g: 170 } },
  { n: 'Mandarina', kcal: 53, p: 0.8, g: 0.3, c: 13, f: 1.8, u: { n: 'mandarina', g: 90 } },
  { n: 'Frutilla', kcal: 32, p: 0.7, g: 0.3, c: 7.7, f: 2 },
  { n: 'Kiwi', kcal: 61, p: 1.1, g: 0.5, c: 15, f: 3, u: { n: 'kiwi', g: 75 } },
  { n: 'Uva', kcal: 69, p: 0.7, g: 0.2, c: 18, f: 0.9 },
  { n: 'Ananá', kcal: 50, p: 0.5, g: 0.1, c: 13, f: 1.4 },

  // ---------- Frutos secos y semillas ----------
  { n: 'Almendras', kcal: 579, p: 21, g: 50, c: 22, f: 12.5, u: { n: 'puñado (30 g)', g: 30 } },
  { n: 'Nueces', kcal: 654, p: 15, g: 65, c: 14, f: 6.7, u: { n: 'puñado (30 g)', g: 30 } },
  { n: 'Maní', kcal: 567, p: 26, g: 49, c: 16, f: 8.5, u: { n: 'puñado (30 g)', g: 30 } },
  { n: 'Semillas de chía', kcal: 486, p: 17, g: 31, c: 42, f: 34, u: { n: 'cucharada', g: 12 } },
  { n: 'Manteca de maní', kcal: 588, p: 25, g: 50, c: 20, f: 6, u: { n: 'cucharada', g: 16 } },

  // ---------- Aceites y grasas ----------
  { n: 'Aceite de girasol', kcal: 884, p: 0, g: 100, c: 0, f: 0, u: { n: 'cucharada', g: 14 } },
  { n: 'Aceite de oliva', kcal: 884, p: 0, g: 100, c: 0, f: 0, u: { n: 'cucharada', g: 13.5 } },
  { n: 'Aceite de coco', kcal: 862, p: 0, g: 100, c: 0, f: 0, u: { n: 'cucharada', g: 14 } },
  { n: 'Mayonesa', kcal: 680, p: 1, g: 75, c: 1.5, f: 0, u: { n: 'cucharada', g: 15 } },

  // ---------- Bebidas ----------
  { n: 'Gaseosa zero', kcal: 0, p: 0, g: 0, c: 0, f: 0, u: { n: 'vaso (250 ml)', g: 250 } },
  { n: 'Gaseosa común', kcal: 42, p: 0, g: 0, c: 10.6, f: 0, u: { n: 'vaso (250 ml)', g: 250 } },
  { n: 'Café solo', kcal: 2, p: 0.1, g: 0, c: 0, f: 0, u: { n: 'taza (200 ml)', g: 200 } },
  { n: 'Jugo de naranja exprimido', kcal: 45, p: 0.7, g: 0.2, c: 10.4, f: 0.2, u: { n: 'vaso (200 ml)', g: 200 } },
  { n: 'Cerveza', kcal: 43, p: 0.5, g: 0, c: 3.6, f: 0, u: { n: 'vaso (330 ml)', g: 330 } },
  { n: 'Vino tinto', kcal: 85, p: 0.1, g: 0, c: 2.6, f: 0, u: { n: 'copa (150 ml)', g: 150 } },

  // ---------- Suplementos y otros ----------
  { n: 'Proteína en polvo (whey)', kcal: 380, p: 78, g: 6, c: 8, f: 0, u: { n: 'scoop (30 g)', g: 30 } },
  { n: 'Miel', kcal: 304, p: 0.3, g: 0, c: 82, f: 0.2, u: { n: 'cucharada', g: 21 } },
  { n: 'Azúcar', kcal: 387, p: 0, g: 0, c: 100, f: 0, u: { n: 'cucharadita', g: 5 } },
  { n: 'Chocolate con leche', kcal: 535, p: 7.6, g: 30, c: 59, f: 3.4, u: { n: 'barrita (25 g)', g: 25 } },
  { n: 'Alfajor', kcal: 420, p: 4, g: 18, c: 60, f: 1.5, u: { n: 'alfajor', g: 55 } },
  { n: 'Medialuna', kcal: 400, p: 7, g: 18, c: 52, f: 1.8, u: { n: 'medialuna', g: 45 } },
  { n: 'Empanada de carne (al horno)', kcal: 260, p: 10, g: 12, c: 28, f: 1.5, u: { n: 'empanada', g: 100 } },
  { n: 'Pizza de muzzarella', kcal: 266, p: 11, g: 10, c: 33, f: 2, u: { n: 'porción', g: 110 } },
  { n: 'Milanesa de soja', kcal: 220, p: 14, g: 10, c: 18, f: 4, u: { n: 'milanesa', g: 100 } }
];

const redondear = (n) => Math.round(n * 10) / 10;

// Cada alimento se expone en las dos formas en que se puede cargar: por 100 g
// y, si tiene unidad natural, por unidad.
const ALIMENTOS_BASE = ALIMENTOS.map((a) => ({
  name: a.n,
  kcalPer100g: a.kcal,
  protein: a.p,
  fat: a.g,
  carbs: a.c,
  fiber: a.f,
  unidad: a.u
    ? {
      nombre: a.u.n,
      gramos: a.u.g,
      kcal: Math.round((a.kcal * a.u.g) / 100),
      protein: redondear((a.p * a.u.g) / 100),
      fat: redondear((a.g * a.u.g) / 100),
      carbs: redondear((a.c * a.u.g) / 100),
      fiber: redondear((a.f * a.u.g) / 100)
    }
    : null
}));

module.exports = { ALIMENTOS_BASE };
