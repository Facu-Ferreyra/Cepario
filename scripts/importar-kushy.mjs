// Importa el CSV de Kushy (cannabis-dataset, licencia MIT) a data/importados/kushy.json
// Uso:  node scripts/importar-kushy.mjs <ruta/al/strains-kushy_api.csv>
//
// Solo hace falta correrlo si cambia el CSV o la forma de limpiarlo: el resultado se guarda en
// el repo y scripts/build-strains.mjs lo combina con los aportes sin necesitar el CSV.
// Cada dato guarda de qué fuente viene:  { "valor": ..., "fuente": "kushy" }

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DIR_IMPORTADOS } from './lib/datos.mjs';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Falta la ruta al CSV.  node scripts/importar-kushy.mjs <archivo.csv>');
  process.exit(1);
}

/* ---------- 1. Parser CSV mínimo (RFC 4180: comillas, comas y saltos de línea dentro de campos) ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }   // "" = comilla escapada
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

/* ---------- 2. Diccionarios de traducción ---------- */
const TIPOS = { Hybrid: 'hibrida', Indica: 'indica', Sativa: 'sativa' };
const EFECTOS = {
  Happy: 'Feliz', Relaxed: 'Relajación', Euphoric: 'Euforia', Uplifted: 'Ánimo elevado', Sleepy: 'Somnolencia',
  Creative: 'Creatividad', Energetic: 'Energía', Hungry: 'Apetito', Focused: 'Concentración', Tingly: 'Hormigueo',
  Talkative: 'Locuacidad', Horny: 'Excitación',
};
const ADVERSOS = { 'Dry Mouth': 'Boca seca', Paranoid: 'Paranoia', Anxious: 'Ansiedad' };
const SABORES = {
  Earthy: 'Terroso', Sweet: 'Dulce', Citrus: 'Cítrico', Berry: 'Frutos rojos', Pine: 'Pino', Lemon: 'Limón',
  Grape: 'Uva', Skunk: 'Skunk', Blueberry: 'Arándano', Lime: 'Lima', Orange: 'Naranja', Pepper: 'Pimienta',
  Ammonia: 'Amoníaco', Pineapple: 'Ananá', Mango: 'Mango', Strawberry: 'Frutilla', Lavender: 'Lavanda',
  Honey: 'Miel', Coffee: 'Café', Rose: 'Rosa', Vanilla: 'Vainilla', Mint: 'Menta', Apple: 'Manzana',
};

/* ---------- 3. Utilidades ---------- */
const vacio = (v) => !v || ['', 'NULL', '0'].includes(v.trim());
const lista = (v) => (vacio(v) ? [] : v.split(',').map((s) => s.trim()).filter(Boolean));
const dato = (valor) => ({ valor, fuente: 'kushy' });
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'variedad';

/* ---------- 4. Limpieza ---------- */
const filas = parseCSV(readFileSync(csvPath, 'utf8'));
const vistos = new Map();      // nombre en minúsculas -> slug  (para descartar duplicados)
const idASlug = new Map();     // id de Kushy -> slug           (para resolver los padres)
const slugsUsados = new Set();
const variedades = [];

for (const f of filas) {
  const nombre = (f.name || '').trim();
  if (!nombre) continue;
  const clave = nombre.toLowerCase();
  if (vistos.has(clave)) { idASlug.set(f.id, vistos.get(clave)); continue; } // duplicado: reusa el slug

  let slug = slugify(nombre), n = 2;
  while (slugsUsados.has(slug)) slug = `${slugify(nombre)}-${n++}`;
  slugsUsados.add(slug);
  vistos.set(clave, slug);
  idASlug.set(f.id, slug);

  const v = { id: slug, nombre };
  const criador = (f.breeder || '').trim();
  if (!vacio(criador) && criador !== 'Unknown Breeder') v.criador = dato(criador);
  if (TIPOS[f.type]) v.tipo = dato(TIPOS[f.type]);
  // genetica, thc, cbd, floracion, terpenos: sin datos utilizables en Kushy (ver nota en "fuentes")
  const sabores = lista(f.flavor).map((s) => SABORES[s]).filter(Boolean);
  if (sabores.length) v.sabores = dato([...new Set(sabores)]);
  const crudos = lista(f.effects);
  const efectos = crudos.map((e) => EFECTOS[e]).filter(Boolean);
  const adversos = crudos.map((e) => ADVERSOS[e]).filter(Boolean);
  if (efectos.length) v.efectos = dato([...new Set(efectos)]);
  if (adversos.length) v.adversos = dato([...new Set(adversos)]);
  v._padres = lista(f.crosses);     // ids de Kushy; se resuelven abajo
  variedades.push(v);
}

// Resolver padres (ids -> slugs), una vez que conocemos todos los slugs
for (const v of variedades) {
  const padres = [...new Set(v._padres.map((id) => idASlug.get(id)).filter((s) => s && s !== v.id))];
  delete v._padres;
  if (padres.length) v.padres = dato(padres);
}

variedades.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

/* ---------- 5. Salida ---------- */
// Sin fecha de generación: así importar dos veces el mismo CSV da exactamente el mismo archivo
const salida = {
  fuentes: {
    kushy: {
      nombre: 'Kushy cannabis-dataset',
      url: 'https://github.com/kushyapp/cannabis-dataset',
      licencia: 'MIT',
      copyright: 'Copyright (c) 2016-present, Kushy.',
      fecha: '2017-11-14',
      nota: 'THC y CBD excluidos: valores con unidades inconsistentes. La columna "ailment" (dolencias) se descarta a propósito.',
    },
  },
  variedades,
};

mkdirSync(DIR_IMPORTADOS, { recursive: true });
// Una variedad por línea: los diffs de git muestran qué variedad cambió al re-importar
const json = '{"fuentes":' + JSON.stringify(salida.fuentes, null, 2) +
  ',\n"variedades":[\n' + variedades.map((v) => JSON.stringify(v)).join(',\n') + '\n]}\n';
writeFileSync(join(DIR_IMPORTADOS, 'kushy.json'), json);

const cuenta = (k) => variedades.filter((v) => v[k]).length;
console.log(`OK: ${variedades.length} variedades (${filas.length - variedades.length} filas descartadas)`);
console.log(`criador ${cuenta('criador')} · tipo ${cuenta('tipo')} · sabores ${cuenta('sabores')} · efectos ${cuenta('efectos')} · padres ${cuenta('padres')}`);
