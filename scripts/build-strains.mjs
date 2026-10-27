// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Genera data/strains.json combinando:
//   1. data/importados/*.json  datos importados de fuentes externas (hoy: Kushy)
//   2. data/fuentes.json       fuentes declaradas por quienes aportan
//   3. data/aportes/<slug>.json aportes de la comunidad, uno por variedad
// Y a partir de data/strains.json genera las páginas estáticas v/<slug>/index.html y sitemap.xml.
// Uso:  node scripts/build-strains.mjs
//
// Regla de combinación: si un aporte trae un campo, reemplaza al importado (el campo entero).
// Un aporte para un slug que no existe crea una variedad nueva (y entonces debe traer "nombre").
// El resultado es determinístico: correrlo dos veces da el mismo archivo.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DIR_DATA, DIR_IMPORTADOS, DIR_APORTES, ARCHIVO_FUENTES, CAMPOS, CAMPOS_FICHA,
  leerJSON, listarJSON, ordenarPorNombre,
} from './lib/datos.mjs';
import { generarPaginas } from './lib/paginas.mjs';

const errores = [];

/* ---------- 1. Importados ---------- */
const fuentes = {};
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

const paginas = generarPaginas({ fuentes: fuentesUsadas, variedades });

console.log(`OK: ${variedades.length} variedades · ${aportes.length} aportes (${camposAportados} campos, ${nuevas} variedades nuevas) · ${paginas} páginas + sitemap.xml`);
