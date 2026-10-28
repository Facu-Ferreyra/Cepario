// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Utilidades compartidas por los scripts de datos (importar, combinar, validar).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_DATA = join(ROOT, 'data');
export const DIR_IMPORTADOS = join(DIR_DATA, 'importados');
export const DIR_APORTES = join(DIR_DATA, 'aportes');
export const ARCHIVO_FUENTES = join(DIR_DATA, 'fuentes.json');
export const DIR_PAGINAS = join(ROOT, 'v');
// URL pública del sitio (GitHub Pages). Se usa en el sitemap y en los <link rel="canonical">.
export const URL_SITIO = 'https://facu-ferreyra.github.io/Cepario/';

// Campos que se muestran en la ficha, en este orden
export const CAMPOS_FICHA = ['criador', 'genetica', 'thc', 'cbd', 'floracion', 'sabores', 'efectos', 'adversos', 'terpenos', 'antocianinas'];
// Campos con fuente (en el orden del JSON final), tipos y forma del slug: salen del esquema Zod
export { CAMPOS, TIPOS, SLUG } from '../../src/lib/esquema.ts';

/** @param {string} ruta @returns {any} */
export const leerJSON = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));

// Archivos .json de una carpeta, ordenados para que el resultado no dependa del sistema operativo.
// Los que empiezan con "_" son ejemplos o plantillas: se validan pero no se publican.
/**
 * @param {string} dir
 * @param {{ incluirEjemplos?: boolean }} [opciones]
 * @returns {{ archivo: string, ruta: string, slug: string }[]}
 */
export function listarJSON(dir, { incluirEjemplos = false } = {}) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && (incluirEjemplos || !f.startsWith('_')))
    .sort()
    .map((f) => ({ archivo: f, ruta: join(dir, f), slug: basename(f, '.json').replace(/^_/, '') }));
}

export const ordenarPorNombre = (a, b) =>
  a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
