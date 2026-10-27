// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Genera data/strains.json combinando:
//   1. data/importados/*.json  datos importados de fuentes externas (hoy: Kushy)
//   2. data/fuentes.json       fuentes declaradas por quienes aportan
//   3. data/aportes/<slug>.json aportes de la comunidad, uno por variedad
// Además genera lo que carga el sitio: data/indice.json (resumen de todas las variedades) y
// data/v/<slug>.json (detalle de cada una). data/strains.json queda como descarga completa.
// Y a partir de los mismos datos genera las páginas estáticas v/<slug>/index.html y sitemap.xml.
// Uso:  node scripts/build-strains.mjs
//
// Regla de combinación: si un aporte trae un campo, reemplaza al importado (el campo entero).
// Un aporte para un slug que no existe crea una variedad nueva (y entonces debe traer "nombre").
// El resultado es determinístico: correrlo dos veces da el mismo archivo.

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIR_DATA, DIR_IMPORTADOS, DIR_APORTES, ARCHIVO_FUENTES, CAMPOS, CAMPOS_FICHA,
  leerJSON, listarJSON, ordenarPorNombre,
} from './lib/datos.mjs';
import { generarPaginas } from './lib/paginas.mjs';
import { resumir } from '../js/datos.js';

const errores = [];

/* ---------- 1. Importados ---------- */
/** @type {Object<string, import('../js/tipos.js').Fuente>} */
const fuentes = {};
/** @type {Map<string, import('../js/tipos.js').Variedad>} */
const porSlug = new Map();
for (const { archivo, ruta } of listarJSON(DIR_IMPORTADOS)) {
  const db = leerJSON(ruta);
  for (const [clave, f] of Object.entries(db.fuentes)) {
    if (fuentes[clave]) errores.push(`importados/${archivo}: la fuente "${clave}" ya está declarada`);
    fuentes[clave] = f;
  }
  for (const v of db.variedades) porSlug.set(v.id, v);
}

/* ---------- 2. Fuentes de aportes ---------- */
for (const [clave, f] of Object.entries(leerJSON(ARCHIVO_FUENTES))) {
  if (clave.startsWith('$')) continue;          // "$schema", "$comentario"
  if (fuentes[clave]) errores.push(`fuentes.json: la fuente "${clave}" ya existe en los datos importados`);
  fuentes[clave] = f;
}

/* ---------- 3. Aportes ---------- */
const aportes = listarJSON(DIR_APORTES);
let nuevas = 0, camposAportados = 0;
for (const { archivo, ruta, slug } of aportes) {
  /** @type {import('../js/tipos.js').Aporte} */
  const a = leerJSON(ruta);
  let v = porSlug.get(slug);
  if (!v) {
    if (!a.nombre) { errores.push(`aportes/${archivo}: "${slug}" no existe; para crear una variedad nueva falta "nombre"`); continue; }
    v = { id: slug, nombre: a.nombre };
    porSlug.set(slug, v);
    nuevas++;
  }
  for (const campo of CAMPOS) {
    if (!a[campo]) continue;
    if (!fuentes[a[campo].fuente]) errores.push(`aportes/${archivo}: ${campo} usa la fuente "${a[campo].fuente}", que no está en data/fuentes.json`);
    v[campo] = { valor: a[campo].valor, fuente: a[campo].fuente };
    camposAportados++;
  }
}

if (errores.length) {
  console.error('No se generó data/strains.json:\n  ' + errores.join('\n  '));
  console.error('Tip: node scripts/validate.mjs da más detalle.');
  process.exit(1);
}

/* ---------- 4. Normalizar ---------- */
const variedades = [...porSlug.values()].map((v) => {
  const out = { id: v.id, nombre: v.nombre };
  for (const campo of CAMPOS) if (v[campo]) out[campo] = v[campo];   // orden fijo de claves
  if (out.padres) {
    // Un padre que no existe (por ejemplo, se renombró) se descarta
    const padres = out.padres.valor.filter((p) => p !== v.id && porSlug.has(p));
    if (padres.length) out.padres = { ...out.padres, valor: padres };
    else delete out.padres;
  }
  return out;
}).sort(ordenarPorNombre);

// Solo se publican las fuentes que usa algún dato (por ejemplo, no la del aporte de ejemplo)
const usadas = new Set(variedades.flatMap((v) => CAMPOS.filter((c) => v[c]).map((c) => v[c].fuente)));
const fuentesUsadas = Object.fromEntries(Object.entries(fuentes).filter(([k]) => usadas.has(k)));

/* ---------- 5. Salida ---------- */
// Una variedad por línea: el archivo sigue siendo compacto y los diffs muestran qué cambió
const json = `{"version":1,"campos":${JSON.stringify(CAMPOS_FICHA)},` +
  `"fuentes":${JSON.stringify(fuentesUsadas)},\n"variedades":[\n` +
  variedades.map((v) => JSON.stringify(v)).join(',\n') + '\n]}\n';
writeFileSync(join(DIR_DATA, 'strains.json'), json);

// Nivel 1: índice liviano para buscador, filtros y navegación (más las fuentes, que usa toda ficha)
writeFileSync(join(DIR_DATA, 'indice.json'), `{"version":1,"fuentes":${JSON.stringify(fuentesUsadas)},\n"variedades":[\n` +
  variedades.map((v) => JSON.stringify(resumir(v))).join(',\n') + '\n]}\n');

// Nivel 2: una ficha completa por archivo. Se borra la carpeta para no dejar variedades viejas.
const DIR_DETALLE = join(DIR_DATA, 'v');
rmSync(DIR_DETALLE, { recursive: true, force: true });
mkdirSync(DIR_DETALLE, { recursive: true });
for (const v of variedades) writeFileSync(join(DIR_DETALLE, `${v.id}.json`), JSON.stringify(v) + '\n');

const paginas = generarPaginas({ fuentes: fuentesUsadas, variedades });

console.log(`OK: ${variedades.length} variedades · ${aportes.length} aportes (${camposAportados} campos, ${nuevas} variedades nuevas) · ${paginas} páginas + sitemap.xml`);
