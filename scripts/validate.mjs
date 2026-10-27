// Valida data/fuentes.json y todos los aportes de data/aportes/ (incluidos los ejemplos con _).
// Uso:  node scripts/validate.mjs
//
// 1. Forma y rangos: JSON Schema de schema/ (THC 0–40 %, CBD 0–30 %, floración 4–20 semanas…).
// 2. Reglas que un schema no puede expresar: la fuente existe, la genética suma 100, min ≤ max,
//    los padres existen, "nombre" solo en variedades nuevas, y nada de afirmaciones médicas.
// Termina con código 1 si hay errores, así el CI falla.

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import {
  ROOT, DIR_IMPORTADOS, DIR_APORTES, ARCHIVO_FUENTES, CAMPOS, SLUG, leerJSON, listarJSON,
} from './lib/datos.mjs';

const errores = [];
const rel = (ruta) => relative(ROOT, ruta).replaceAll('\\', '/');
const error = (ruta, msg) => errores.push({ archivo: rel(ruta), msg });

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

/* ---------- Mensajes de Ajv en castellano ---------- */
function traducir(e) {
  const p = e.params;
  switch (e.keyword) {
    case 'required': return `falta el campo "${p.missingProperty}"`;
    case 'additionalProperties': return `campo desconocido "${p.additionalProperty}"`;
    case 'minimum': return `debe ser ${p.comparison} ${p.limit}`;
    case 'maximum': return `debe ser ${p.comparison} ${p.limit}`;
    case 'enum': return `debe ser uno de: ${p.allowedValues.join(', ')}`;
    case 'type': return `debe ser de tipo ${p.type === 'number' ? 'número' : p.type === 'string' ? 'texto' : p.type === 'array' ? 'lista' : p.type === 'object' ? 'objeto' : p.type}`;
    case 'pattern':
      if (e.instancePath.endsWith('/url')) return 'debe ser una URL que empiece con https://';
      if (e.instancePath.endsWith('/fecha')) return 'debe tener el formato AAAA-MM-DD';
      return 'solo minúsculas, números y guiones (por ejemplo "afghan-big-bud")';
    case 'propertyNames': return `clave "${p.propertyName}" inválida: solo minúsculas, números y guiones`;
    case 'minItems': return `debe tener al menos ${p.limit} elemento(s)`;
    case 'maxItems': return `debe tener como máximo ${p.limit} elementos`;
    case 'uniqueItems': return 'tiene elementos repetidos';
    case 'minLength': return 'no puede estar vacío';
    case 'maxLength': return `debe tener como máximo ${p.limit} caracteres`;
    case 'minProperties': return 'el aporte está vacío';
    default: return e.message;
  }
}
function erroresDeSchema(ruta, errs) {
  // En los campos con "oneOf" (número o rango) Ajv reporta los dos intentos. Mostramos el más útil:
  // si en una ruta hay errores que no son de tipo, los de tipo sobran.
  // Los errores internos de propertyNames (e.propertyName) se resumen en uno solo.
  const utiles = errs.filter((e) => e.keyword !== 'oneOf' && e.keyword !== 'anyOf' && !e.propertyName);
  const conDetalle = new Set(utiles.filter((e) => e.keyword !== 'type').map((e) => e.instancePath.split('/').slice(0, 3).join('/')));
  const vistos = new Set();
  for (const e of utiles) {
    if (e.keyword === 'type' && conDetalle.has(e.instancePath.split('/').slice(0, 3).join('/'))) continue;
    const donde = e.instancePath.slice(1).replaceAll('/', '.') || '(raíz)';
    const msg = `${donde}: ${traducir(e)}`;
    if (!vistos.has(msg)) { vistos.add(msg); error(ruta, msg); }
  }
}

/* ---------- Carga ---------- */
// strictTypes: false porque cada campo hereda type: "object" de $defs/dato vía $ref
const ajv = new Ajv({ allErrors: true, strict: true, strictTypes: false });
const validarAporte = ajv.compile(leerJSON(join(ROOT, 'schema', 'aporte.schema.json')));
const validarFuentes = ajv.compile(leerJSON(join(ROOT, 'schema', 'fuentes.schema.json')));

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
  if (!validarFuentes(fs)) erroresDeSchema(ARCHIVO_FUENTES, validarFuentes.errors);
  for (const k of Object.keys(fs)) {
    if (k.startsWith('$')) continue;
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
  if (!validarAporte(a)) erroresDeSchema(ruta, validarAporte.errors);

  const esNueva = !existentes.has(slug);
  if (esNueva && !a.nombre) error(ruta, `"${slug}" no existe todavía: para crear una variedad nueva agregá "nombre". Si querías aportar a una existente, revisá el slug en la URL de su ficha.`);
  if (!esNueva && a.nombre) error(ruta, '"nombre" solo se usa para variedades nuevas; esta ya existe.');
  if (a.nombre) revisarTexto(ruta, 'nombre', a.nombre);

  for (const campo of CAMPOS) {
    const d = a[campo];
    if (!d || typeof d !== 'object') continue;
    if (typeof d.fuente === 'string' && !fuentes.has(d.fuente)) {
      error(ruta, `${campo}: la fuente "${d.fuente}" no existe. Declarala en data/fuentes.json.`);
    }
    const x = d.valor;
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      if (typeof x.min === 'number' && typeof x.max === 'number' && x.min > x.max) error(ruta, `${campo}: min (${x.min}) es mayor que max (${x.max})`);
      if (campo === 'genetica' && typeof x.indica === 'number' && typeof x.sativa === 'number' && x.indica + x.sativa !== 100) {
        error(ruta, `genetica: índica + sativa debe sumar 100 (suma ${x.indica + x.sativa})`);
      }
    }
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
