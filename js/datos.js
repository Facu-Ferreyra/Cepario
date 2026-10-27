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
// Respaldo mínimo si data/strains.json no se puede cargar (por ejemplo, al abrir con doble clic)
export const MUESTRA = {
  fuentes: { kushy: { nombre: 'Kushy cannabis-dataset', url: 'https://github.com/kushyapp/cannabis-dataset', licencia: 'MIT', copyright: 'Copyright (c) 2016-present, Kushy.', fecha: '2017-11-14', nota: '' } },
  variedades: [
    { id: 'afghan-big-bud', nombre: 'Afghan Big Bud', tipo: { valor: 'indica', fuente: 'kushy' }, sabores: { valor: ['Limón', 'Lavanda'], fuente: 'kushy' }, efectos: { valor: ['Euforia', 'Feliz', 'Locuacidad', 'Relajación', 'Somnolencia'], fuente: 'kushy' }, adversos: { valor: ['Boca seca', 'Paranoia'], fuente: 'kushy' }, padres: { valor: ['afghani', 'big-budda-cheese'], fuente: 'kushy' } },
    { id: 'afghani', nombre: 'Afghani', tipo: { valor: 'indica', fuente: 'kushy' }, sabores: { valor: ['Terroso', 'Dulce', 'Pino'], fuente: 'kushy' }, efectos: { valor: ['Relajación', 'Somnolencia', 'Euforia', 'Feliz', 'Ánimo elevado'], fuente: 'kushy' }, adversos: { valor: ['Boca seca', 'Paranoia'], fuente: 'kushy' } },
    { id: 'big-budda-cheese', nombre: 'Big Budda Cheese', criador: { valor: 'Big Buddha', fuente: 'kushy' }, tipo: { valor: 'hibrida', fuente: 'kushy' } },
  ],
};

export let DB = null;                 // { fuentes, variedades }
export const bySlug = new Map();      // slug -> variedad
export const hijos = new Map();       // slug -> [slugs de variedades que la tienen como padre]

export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const nf = new Intl.NumberFormat('es-AR');
export const tieneDatos = (v) => !!(v.sabores || v.efectos || v.thc || v.cbd || v.floracion || v.terpenos);
export const pasaFiltro = (v, f) => f === 'todas' || (f === 'datos' ? tieneDatos(v) : v.tipo?.valor === f);

export function indexar(db) {
  DB = db;
  bySlug.clear(); hijos.clear();
  for (const v of db.variedades) { v._n = norm(v.nombre); v._c = v.criador ? norm(v.criador.valor) : ''; bySlug.set(v.id, v); }
  for (const v of db.variedades) for (const p of v.padres?.valor || []) {
    if (!hijos.has(p)) hijos.set(p, []);
    hijos.get(p).push(v.id);
  }
}
