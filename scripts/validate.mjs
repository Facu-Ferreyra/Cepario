// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Valida data/fuentes.json y todos los aportes de data/aportes/ (incluidos los ejemplos con _).
// Uso:  node scripts/validate.mjs
//
// 1. Forma y rangos: el esquema Zod de src/lib/esquema.ts (el mismo que usa Astro para la colección).
// 2. Reglas que un esquema no puede saber porque dependen del resto de los datos: la fuente existe,
//    los padres existen, "nombre" solo en variedades nuevas, y nada de afirmaciones médicas.
// Termina con código 1 si hay errores, así el CI falla.

import { existsSync } from 'node:fs';
import { relative } from 'node:path';
import { Aporte, ArchivoFuentes, CAMPOS, SLUG } from '../src/lib/esquema.ts';
import { ROOT, DIR_IMPORTADOS, DIR_APORTES, ARCHIVO_FUENTES, leerJSON, listarJSON } from './lib/datos.mjs';

const errores = [];
const rel = (ruta) => relative(ROOT, ruta).replaceAll('\\', '/');
const error = (ruta, msg) => errores.push({ archivo: rel(ruta), msg });
/** Errores de Zod -> "campo.valor: mensaje" */
const erroresDeEsquema = (ruta, issues) => issues.forEach((i) => error(ruta, `${i.path.join('.') || '(raíz)'}: ${i.message}`));

/* ---------- Afirmaciones médicas ---------- */
// Verbos de promesa terapéutica: prohibidos en cualquier texto.
const PROMESAS = /\b(cura\w*|trata\w*|sana\w*|alivi\w*|previen\w*|combat\w*|terapeut\w*|medicina\w*|medicament\w*|remedio\w*|sirve para|bueno para|ayuda (a|con|para)|recomendad\w* para|indicad\w* para|analgesic\w*|antiinflamatori\w*|ansiolitic\w*|antidepresiv\w*|antiemetic\w*|anticonvulsiv\w*)\b/;
// Enfermedades y síntomas: prohibidos en efectos/sabores/terpenos (sí pueden aparecer en "adversos",
// por ejemplo "Dolor de cabeza", porque ahí describen un efecto no deseado, no una promesa).
const DOLENCIAS = /\b(dolor\w*|depresi\w*|insomnio|cancer\w*|epileps\w*|artritis|migrana\w*|nausea\w*|estres|enfermedad\w*|sintoma\w*|paciente\w*|dosis|glaucoma|esclerosis|parkinson|alzheimer|fibromialgia|crohn|tdah|autismo|vih|sida)\b/;
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function revisarTexto(ruta, campo, texto) {
  const t = sinTildes(texto);
  const m = t.match(PROMESAS) || (campo !== 'adversos' && t.match(DOLENCIAS));
  if (m) error(ruta, `${campo}: "${texto}" parece una afirmación médica ("${m[0]}"). Cepario no publica usos terapéuticos.`);
}

/* ---------- Carga ---------- */
const fuentes = new Set();
const existentes = new Set();
for (const { ruta } of listarJSON(DIR_IMPORTADOS)) {
  const db = leerJSON(ruta);
  Object.keys(db.fuentes).forEach((k) => fuentes.add(k));
  db.variedades.forEach((v) => existentes.add(v.id));
}

function leer(ruta) {
  try { return leerJSON(ruta); } catch (e) { error(ruta, `no es JSON válido: ${e.message}`); return null; }
}

/* ---------- fuentes.json ---------- */
const fs = existsSync(ARCHIVO_FUENTES) ? leer(ARCHIVO_FUENTES) : {};
if (fs) {
  const r = ArchivoFuentes.safeParse(fs);
  if (!r.success) erroresDeEsquema(ARCHIVO_FUENTES, r.error.issues);
  for (const k of Object.keys(fs)) {
    if (k.startsWith('$')) continue;
    if (!SLUG.test(k)) error(ARCHIVO_FUENTES, `clave "${k}" inválida: solo minúsculas, números y guiones`);
    if (fuentes.has(k)) error(ARCHIVO_FUENTES, `la fuente "${k}" ya existe en data/importados/`);
    fuentes.add(k);
  }
}

/* ---------- Aportes ---------- */
const aportes = listarJSON(DIR_APORTES, { incluirEjemplos: true });
const nuevas = new Set(aportes.filter((a) => !existentes.has(a.slug)).map((a) => a.slug));

for (const { archivo, ruta, slug } of aportes) {
  if (!SLUG.test(slug)) { error(ruta, `el nombre del archivo debe ser <slug>.json (minúsculas, números y guiones): "${archivo}"`); continue; }
  const a = leer(ruta);
  if (!a) continue;
  const r = Aporte.safeParse(a);
  if (!r.success) erroresDeEsquema(ruta, r.error.issues);

  const esNueva = !existentes.has(slug);
  if (esNueva && !a.nombre) error(ruta, `"${slug}" no existe todavía: para crear una variedad nueva agregá "nombre". Si querías aportar a una existente, revisá el slug en la URL de su ficha.`);
  if (!esNueva && a.nombre) error(ruta, '"nombre" solo se usa para variedades nuevas; esta ya existe.');
  if (typeof a.nombre === 'string') revisarTexto(ruta, 'nombre', a.nombre);

  for (const campo of CAMPOS) {
    const d = a[campo];
    if (!d || typeof d !== 'object') continue;
    if (typeof d.fuente === 'string' && !fuentes.has(d.fuente)) {
      error(ruta, `${campo}: la fuente "${d.fuente}" no existe. Declarala en data/fuentes.json.`);
    }
    const x = d.valor;
    if (campo === 'padres' && Array.isArray(x)) {
      for (const p of x) {
        if (p === slug) error(ruta, 'padres: una variedad no puede ser su propio padre');
        else if (!existentes.has(p) && !nuevas.has(p)) error(ruta, `padres: "${p}" no existe`);
      }
    }
    if (['sabores', 'efectos', 'adversos', 'terpenos'].includes(campo)) {
      for (const t of [x].flat()) if (typeof t === 'string') revisarTexto(ruta, campo, t);
    }
  }
}

/* ---------- Resultado ---------- */
const enCI = !!process.env.GITHUB_ACTIONS;
if (errores.length) {
  console.error(`✗ ${errores.length} error(es) en los datos:\n`);
  let anterior = null;
  for (const { archivo, msg } of errores) {
    if (archivo !== anterior) console.error(`  ${(anterior = archivo)}`);
    console.error(`    → ${msg}`);
    if (enCI) console.log(`::error file=${archivo}::${msg}`);   // anotación en el PR
  }
  console.error('\nVer CONTRIBUTING.md para el formato de los aportes.');
  process.exit(1);
}
console.log(`✓ Datos válidos: ${aportes.length} aporte(s), ${fuentes.size} fuente(s).`);
