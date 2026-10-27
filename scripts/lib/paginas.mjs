// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Genera una página estática por variedad (v/<slug>/index.html) y sitemap.xml.
// Cada página es index.html con el <title>, la description y la ficha ya escritos en el HTML:
// se lee sin JavaScript (buscadores, lectores) y, si hay JS, el visor 3D se carga encima.

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, DIR_PAGINAS, URL_SITIO } from './datos.mjs';
import { fichaHTML, caption } from '../../js/ficha-html.js';
import { TIPO_TXT, esc } from '../../js/datos.js';

// Sin JS, el visor, los filtros y el buscador no hacen nada: se ocultan y la ficha queda como
// una página normal con scroll (en escritorio y en el celular)
const NOSCRIPT = '<noscript><style>html,body{height:auto}body{overflow:auto}.hero{height:auto;min-height:100vh}' +
  '.main,.nav,.feat,.top,.closeup,#mSearch{display:none}.card{max-height:none;overflow:visible}</style></noscript>';

function reemplazar(html, buscado, nuevo) {
  if (!html.includes(buscado)) throw new Error(`index.html cambió: no encuentro ${buscado}`);
  return html.replace(buscado, () => nuevo);   // función: evita que "$&" en los datos se interprete
}

/** Texto para <meta name="description"> (hasta ~160 caracteres). @param {import('../../js/tipos.js').Variedad} v */
function descripcion(v) {
  const tipo = v.tipo ? `variedad ${TIPO_TXT[v.tipo.valor].toLowerCase()}` : 'variedad de cannabis';
  const partes = [`${v.nombre}: ${tipo}${v.criador ? ` de ${v.criador.valor}` : ''}.`];
  if (v.sabores) partes.push(`Sabores: ${v.sabores.valor.slice(0, 4).join(', ').toLowerCase()}.`);
  if (v.efectos) partes.push(`Efectos reportados: ${v.efectos.valor.slice(0, 4).join(', ').toLowerCase()}.`);
  partes.push('Datos con fuente y licencia.');
  let d = partes.join(' ');
  if (d.length > 160) d = d.slice(0, 157).replace(/\s+\S*$/, '') + '…';
  return d;
}

/**
 * @param {{ fuentes: Object<string, import('../../js/tipos.js').Fuente>, variedades: import('../../js/tipos.js').Variedad[] }} db
 * @returns {number} Cantidad de páginas generadas
 */
export function generarPaginas(db) {
  let plantilla = readFileSync(join(ROOT, 'index.html'), 'utf8');
  // Las rutas a recursos propios suben dos niveles (v/<slug>/ -> raíz)
  plantilla = plantilla.replace(/(href|src)="((?:styles\.css|js\/)[^"]*)"/g, '$1="../../$2"');
  plantilla = reemplazar(plantilla, '</head>', `${NOSCRIPT}\n</head>`);

  const bySlug = new Map(db.variedades.map((v) => [v.id, v]));
  const hijos = new Map();
  for (const v of db.variedades) for (const p of v.padres?.valor || []) {
    if (!hijos.has(p)) hijos.set(p, []);
    hijos.get(p).push(v.id);
  }
  /** @type {import('../../js/ficha-html.js').ContextoFicha} */
  const ctx = {
    fuentes: db.fuentes,
    variedad: (s) => bySlug.get(s),
    hijosDe: (s) => hijos.get(s) || [],
    enlace: (s) => `../${s}/`,
    swatch: () => 'var(--sage-tint)',   // el color real lo calcula Three.js al cargar el visor
  };

  // Se borra todo v/ para que no queden páginas de variedades que ya no existen
  rmSync(DIR_PAGINAS, { recursive: true, force: true });
  for (const v of db.variedades) {
    let html = plantilla;
    html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(v.nombre)} · Cepario</title>`);
    html = html.replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(descripcion(v))}">`);
    html = html.replace(/<link rel="canonical" href="[^"]*">/, () => `<link rel="canonical" href="${URL_SITIO}v/${v.id}/">`);
    html = reemplazar(html, '<div class="hero" id="hero" data-light="day">', `<div class="hero" id="hero" data-light="day" data-slug="${esc(v.id)}">`);
    html = reemplazar(html, '<article id="article" aria-live="polite"></article>', `<article id="article" aria-live="polite">${fichaHTML(v, ctx)}</article>`);
    html = reemplazar(html, '<p class="caption" id="caption"></p>', `<p class="caption" id="caption">${esc(caption(v, ctx))}</p>`);
    mkdirSync(join(DIR_PAGINAS, v.id), { recursive: true });
    writeFileSync(join(DIR_PAGINAS, v.id, 'index.html'), html);
  }

  const urls = [URL_SITIO, ...db.variedades.map((v) => `${URL_SITIO}v/${v.id}/`)];
  writeFileSync(join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>\n');
  return db.variedades.length;
}
