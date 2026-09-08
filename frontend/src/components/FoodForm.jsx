import { useEffect, useState } from 'react';
import { api, todayStr, fmtDate } from '../api.js';

// Formulario de alta de comida, compartido entre Hoy y Comida.
//
// Se carga siempre igual: qué comiste, cuánto (cantidad + unidad) y las kcal.
// Si el alimento ya tiene referencia — porque lo elegiste de Open Food Facts o
// porque ya lo cargaste antes — las kcal y los macros salen solos de la
// cantidad; si no, los ponés a mano y la app se guarda la referencia dividiendo
// por la cantidad, así la próxima vez ya la tiene.
//
// La fecha la decide la vista: en Hoy es hoy, en Comida es la que estés
// mirando. Un día que te olvidaste de cargar se completa igual.

const UNIDADES = [
  { key: 'g', label: 'g', base: '100g', por: 'por 100 g' },
  { key: 'ml', label: 'ml', base: '100g', por: 'por 100 ml' },
  { key: 'unidad', label: 'unidad', base: 'unidad', por: 'por unidad' },
  { key: 'porcion', label: 'porción', base: 'porcion', por: 'por porción' }
];

const unidadDe = (key) => UNIDADES.find((u) => u.key === key) || UNIDADES[0];

// Un número o null: los campos vacíos no valen cero. Que un alimento no tenga
// la fibra cargada no significa que tenga 0 g de fibra.
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const redondear = (n) => (n == null ? null : Math.round(n * 10) / 10);
const mostrar = (n) => (n == null ? '—' : String(redondear(n)).replace('.', ','));

export default function FoodForm({ date, onSaved }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('porcion');
  const [kcal, setKcal] = useState('');
  const [macros, setMacros] = useState({ protein: '', fat: '', carbs: '', fiber: '' });
  const [verMacros, setVerMacros] = useState(false);
  const [ref, setRef] = useState(null); // { unit: '100g'|'unidad'|'porcion', kcal, protein, ... }
  const [impulsive, setImpulsive] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/api/foods/suggest?q=${encodeURIComponent(name)}`)
        .then(setSuggestions)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [name]);

  // Cuánto de la referencia entra en lo que comiste: por 100 g la cantidad se
  // divide, por unidad se multiplica tal cual.
  const factor = (() => {
    const n = num(qty);
    if (n == null || n <= 0) return null;
    return ref?.unit === '100g' ? n / 100 : n;
  })();

  const calculado = ref && factor != null ? Math.round(ref.kcal * factor) : num(kcal);
  const macrosCalculados = ref && factor != null
    ? {
      protein: ref.protein != null ? redondear(ref.protein * factor) : null,
      fat: ref.fat != null ? redondear(ref.fat * factor) : null,
      carbs: ref.carbs != null ? redondear(ref.carbs * factor) : null,
      fiber: ref.fiber != null ? redondear(ref.fiber * factor) : null
    }
    : {
      protein: num(macros.protein),
      fat: num(macros.fat),
      carbs: num(macros.carbs),
      fiber: num(macros.fiber)
    };

  const limpiar = () => {
    setName('');
    setQty('');
    setUnit('porcion');
    setKcal('');
    setMacros({ protein: '', fat: '', carbs: '', fiber: '' });
    setVerMacros(false);
    setRef(null);
    setImpulsive(false);
  };

  const handleName = (value) => {
    setName(value);
    setOpen(true);
    // Si reescribe el nombre a mano, el alimento elegido deja de aplicar.
    if (ref) setRef(null);
  };

  const elegir = (s) => {
    setOpen(false);
    if (s.source === 'base') {
      // Un alimento de la lista de comunes. Si tiene unidad natural (un huevo,
      // una cucharada, una lata) se carga por unidad, que es como uno piensa;
      // si no, por 100 g.
      setName(s.name);
      if (s.unidad) {
        setRef({
          unit: 'unidad',
          label: s.unidad.nombre,
          kcal: s.unidad.kcal,
          protein: s.unidad.protein,
          fat: s.unidad.fat,
          carbs: s.unidad.carbs,
          fiber: s.unidad.fiber
        });
        setUnit('unidad');
        setQty('1');
      } else {
        setRef({
          unit: '100g',
          kcal: s.kcalPer100g,
          protein: s.protein,
          fat: s.fat,
          carbs: s.carbs,
          fiber: s.fiber
        });
        setUnit('g');
        setQty('100');
      }
    } else if (s.source === 'off') {
      // La marca va en el nombre porque frequent_foods tiene UNIQUE(name):
      // dos "Yogur" de marcas distintas se pisarían las calorías entre sí.
      setName(s.brand ? `${s.name} (${s.brand})` : s.name);
      setRef({
        unit: '100g',
        kcal: s.kcalPer100g,
        protein: s.protein,
        fat: s.fat,
        carbs: s.carbs,
        fiber: s.fiber
      });
      setUnit('g');
      setQty(String(s.servingG || 100));
    } else if (s.base) {
      setName(s.name);
      setRef(s.base);
      setUnit(s.base.unit === '100g' ? 'g' : s.base.unit);
      setQty(s.base.unit === '100g' ? '100' : '1');
    } else {
      // Un alimento viejo, cargado antes de que existieran las porciones:
      // solo se sabe cuántas kcal tenía la última vez.
      setName(s.name);
      setRef(null);
      setUnit('porcion');
      setQty('1');
      setKcal(String(Math.round(s.calories)));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !(calculado > 0)) return;
    setSaving(true);
    try {
      const cantidad = num(qty);
      // La referencia para la próxima vez: lo que comiste dividido por la
      // cantidad. Sin cantidad no hay nada que normalizar.
      const porUnidad = (v) => {
        if (v == null || cantidad == null || cantidad <= 0) return null;
        return redondear(unidadDe(unit).base === '100g' ? (v * 100) / cantidad : v / cantidad);
      };
      await api.post('/api/food', {
        date,
        name,
        calories: calculado,
        impulsive,
        qty: cantidad,
        unit,
        ...macrosCalculados,
        base: cantidad > 0
          ? {
            unit: unidadDe(unit).base,
            label: ref?.label || null,
            kcal: porUnidad(calculado),
            protein: porUnidad(macrosCalculados.protein),
            fat: porUnidad(macrosCalculados.fat),
            carbs: porUnidad(macrosCalculados.carbs),
            fiber: porUnidad(macrosCalculados.fiber)
          }
          : null
      });
      limpiar();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const esOtroDia = date && date !== todayStr();
  const tieneMacros = Object.values(macrosCalculados).some((v) => v != null);

  return (
    <form className="card" onSubmit={submit}>
      <h2>Agregar comida</h2>
      {esOtroDia && (
        <p className="muted" style={{ marginTop: -4 }}>
          Se guarda en <strong>{fmtDate(date)}</strong>.
        </p>
      )}

      <label>
        Qué comiste
        <input
          value={name}
          onChange={(e) => handleName(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="ej. café con leche"
          autoComplete="off"
        />
      </label>

      {open && suggestions.length > 0 && (
        <div className="suggest-list">
          {suggestions.map((s) => (
            <button
              type="button"
              key={`${s.source}-${s.name}`}
              className="suggest"
              onClick={() => elegir(s)}
            >
              <span className="suggest-name">{s.name}</span>
              <span className="suggest-meta">
                {s.source === 'off'
                  ? `${s.brand ? s.brand + ' · ' : ''}${s.kcalPer100g} kcal/100 g`
                  : s.source === 'base'
                    ? s.unidad
                      ? `${s.unidad.kcal} kcal por ${s.unidad.nombre}`
                      : `${s.kcalPer100g} kcal/100 g`
                    : s.base
                      ? `${Math.round(s.base.kcal)} kcal ${s.base.label ? `por ${s.base.label}` : unidadDe(s.base.unit === '100g' ? 'g' : s.base.unit).por}`
                      : `${Math.round(s.calories)} kcal`}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="row">
        <label style={{ flex: '0 0 88px' }}>
          Cantidad
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="1"
          />
        </label>
        <label style={{ flex: '0 0 108px' }}>
          Unidad
          <select
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              // Cambiar de gramos a unidades invalida la referencia por 100 g.
              if (ref && unidadDe(e.target.value).base !== ref.unit) setRef(null);
            }}
          >
            {UNIDADES.map((u) => (
              <option key={u.key} value={u.key}>
                {/* "2 huevos" se entiende; "2 unidades" hay que pensarlo. */}
                {u.key === 'unidad' && ref?.label ? ref.label : u.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: '1 1 96px' }}>
          kcal
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={ref ? (calculado ?? '') : kcal}
            onChange={(e) => setKcal(e.target.value)}
            disabled={!!ref}
            placeholder="0"
          />
        </label>
      </div>

      {ref && (
        <p className="muted portion-hint">
          {ref.kcal} kcal {ref.label ? `por ${ref.label}` : unidadDe(unit).por}
          {ref.protein != null ? ` · P ${mostrar(ref.protein)}` : ''}
          {ref.fat != null ? ` · G ${mostrar(ref.fat)}` : ''}
          {ref.carbs != null ? ` · C ${mostrar(ref.carbs)}` : ''}
          <button
            type="button"
            className="ghost small"
            onClick={() => {
              setKcal(String(calculado || ''));
              setMacros({
                protein: macrosCalculados.protein ?? '',
                fat: macrosCalculados.fat ?? '',
                carbs: macrosCalculados.carbs ?? '',
                fiber: macrosCalculados.fiber ?? ''
              });
              setVerMacros(true);
              setRef(null);
            }}
          >
            poner a mano
          </button>
        </p>
      )}

      {!ref && (
        verMacros ? (
          <div className="row macro-row">
            {[
              ['protein', 'Proteína'],
              ['carbs', 'Carbos'],
              ['fat', 'Grasas'],
              ['fiber', 'Fibra']
            ].map(([k, etiqueta]) => (
              <label key={k}>
                {etiqueta}
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={macros[k]}
                  onChange={(e) => setMacros({ ...macros, [k]: e.target.value })}
                  placeholder="g"
                />
              </label>
            ))}
          </div>
        ) : (
          <button type="button" className="ghost small" onClick={() => setVerMacros(true)}>
            + macros (opcional)
          </button>
        )
      )}

      {calculado > 0 && (
        <p className="note" style={{ margin: 0 }}>
          <strong>{calculado} kcal</strong>
          {tieneMacros
            ? ` · ${mostrar(macrosCalculados.protein)} g de proteína · ${mostrar(macrosCalculados.carbs)} g de carbos · ${mostrar(macrosCalculados.fat)} g de grasa`
            : ' · sin macros cargados'}
        </p>
      )}

      <div className="row">
        <button
          type="button"
          className={`pill-toggle shrink ${impulsive ? 'on' : ''}`}
          onClick={() => setImpulsive(!impulsive)}
        >
          {impulsive ? '✓ ' : ''}fuera de hambre real
        </button>
        <button className="primary shrink" disabled={saving || !name.trim() || !(calculado > 0)}>
          Guardar
        </button>
      </div>
    </form>
  );
}
