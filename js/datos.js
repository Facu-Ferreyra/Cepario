// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

/* =========================================================
   DATOS: estado compartido y utilidades
   ========================================================= */
export const TIPO_TXT = { hibrida: 'Híbrida', indica: 'Índica', sativa: 'Sativa' };
export const FILTRO_TXT = { todas: 'Todas las variedades', hibrida: 'Híbridas', indica: 'Índicas', sativa: 'Sativas', datos: 'Con más datos' };
// Orden de la ficha (el mismo que definimos): [campo, etiqueta, ícono]
export const CAMPOS = [
  ['criador', 'Criador', 'user'], ['genetica', 'Genética', 'dna'], ['thc', 'THC', 'flask'], ['cbd', 'CBD', 'flask'],
  ['floracion', 'Floración', 'clock'], ['sabores', 'Sabores', 'leaf'], ['efectos', 'Efectos', 'spark'],
  ['adversos', 'Efectos adversos', 'alert'], ['terpenos', 'Terpenos', 'drop'],
];
// Respaldo mínimo si data/indice.json no se puede cargar (por ejemplo, al abrir con doble clic)
/** @type {{ fuentes: Object<string, import('./tipos.js').Fuente>, variedades: Variedad[] }} */
export const MUESTRA = {
  fuentes: { kushy: { nombre: 'Kushy cannabis-dataset', url: 'https://github.com/kushyapp/cannabis-dataset', licencia: 'MIT', copyright: 'Copyright (c) 2016-present, Kushy.', fecha: '2017-11-14', nota: '' } },
  variedades: [
    { id: 'afghan-big-bud', nombre: 'Afghan Big Bud', tipo: { valor: 'indica', fuente: 'kushy' }, sabores: { valor: ['Limón', 'Lavanda'], fuente: 'kushy' }, efectos: { valor: ['Euforia', 'Feliz', 'Locuacidad', 'Relajación', 'Somnolencia'], fuente: 'kushy' }, adversos: { valor: ['Boca seca', 'Paranoia'], fuente: 'kushy' }, padres: { valor: ['afghani', 'big-budda-cheese'], fuente: 'kushy' } },
    { id: 'afghani', nombre: 'Afghani', tipo: { valor: 'indica', fuente: 'kushy' }, sabores: { valor: ['Terroso', 'Dulce', 'Pino'], fuente: 'kushy' }, efectos: { valor: ['Relajación', 'Somnolencia', 'Euforia', 'Feliz', 'Ánimo elevado'], fuente: 'kushy' }, adversos: { valor: ['Boca seca', 'Paranoia'], fuente: 'kushy' } },
    { id: 'big-budda-cheese', nombre: 'Big Budda Cheese', criador: { valor: 'Big Buddha', fuente: 'kushy' }, tipo: { valor: 'hibrida', fuente: 'kushy' } },
  ],
};

// Los datos se cargan en dos niveles:
//  - data/indice.json: una entrada liviana por variedad (resumen), para el buscador, los filtros
//    y la navegación. Es lo único que se descarga al abrir el sitio.
//  - data/v/<slug>.json: la variedad completa (con fuentes), que se pide al abrir su ficha.
/** @typedef {import('./tipos.js').Variedad} Variedad @typedef {import('./tipos.js').Resumen} Resumen */

/** @type {import('./tipos.js').Indice | null} */
export let DB = null;                 // { fuentes, variedades: resúmenes }
/** @type {Map<string, Resumen>} */
export const bySlug = new Map();      // slug -> resumen
/** @type {Map<string, string[]>} */
export const hijos = new Map();       // slug -> [slugs de variedades que la tienen como padre]

export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nf = new Intl.NumberFormat('es-AR');
/** ¿La variedad completa tiene algún dato además de tipo, criador y linaje? @param {Variedad} v */
export const tieneDatos = (v) => !!(v.sabores || v.efectos || v.thc || v.cbd || v.floracion || v.terpenos);
/** @param {Resumen} r @param {string} f Filtro: todas, hibrida, indica, sativa o datos */
export const pasaFiltro = (r, f) => f === 'todas' || (f === 'datos' ? (r.datos || 0) > 0 : r.tipo === f);

/**
 * Variedad completa -> entrada del índice. La usa el build para escribir data/indice.json.
 * "datos": 1 si tiene algún dato (filtro "Con más datos"), 2 si además tiene sabores y efectos
 * (candidata a "Variedad del día"). Se omite cuando es 0, igual que los campos vacíos.
 * @param {Variedad} v
 * @returns {Resumen}
 */
export function resumir(v) {
  /** @type {Resumen} */
  const r = { id: v.id, nombre: v.nombre };
  if (v.tipo) r.tipo = v.tipo.valor;
  if (v.criador) r.criador = v.criador.valor;
  const datos = v.sabores && v.efectos ? 2 : tieneDatos(v) ? 1 : 0;
  if (datos) r.datos = datos;
  if (v.padres) r.padres = v.padres.valor;
  return r;
}

/** Guarda el índice y arma los mapas por slug y de hijos. @param {import('./tipos.js').Indice} db */
export function indexar(db) {
  DB = db;
  bySlug.clear(); hijos.clear();
  for (const r of db.variedades) { r._n = norm(r.nombre); r._c = r.criador ? norm(r.criador) : ''; bySlug.set(r.id, r); }
  for (const r of db.variedades) for (const p of r.padres || []) {
    if (!hijos.has(p)) hijos.set(p, []);
    hijos.get(p).push(r.id);
  }
}

/* ---------- Detalle de cada variedad (segundo nivel) ---------- */
/** @type {Map<string, Promise<Variedad>>} */
const detalles = new Map();           // slug -> Promise<variedad completa>

/**
 * Pide data/v/<slug>.json una sola vez; los pedidos siguientes reusan la misma promesa.
 * @param {string} slug
 * @returns {Promise<Variedad>}
 */
export function cargarDetalle(slug) {
  if (!detalles.has(slug)) {
    const p = fetch(new URL(`../data/v/${encodeURIComponent(slug)}.json`, import.meta.url))
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); });
    p.catch(() => detalles.delete(slug));   // si falla, el próximo intento vuelve a pedirlo
    detalles.set(slug, p);
  }
  return detalles.get(slug);
}
/** Precarga sin mostrar errores (la usamos para las variedades vecinas). @param {string | undefined} slug */
export function precargar(slug) { if (slug) cargarDetalle(slug).catch(() => {}); }
/** Para el respaldo MUESTRA: detalles que ya tenemos en memoria. @param {Variedad[]} variedades */
export function guardarDetalles(variedades) { for (const v of variedades) detalles.set(v.id, Promise.resolve(v)); }
