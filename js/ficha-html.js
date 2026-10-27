// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// HTML de la ficha. Módulo "puro" (sin DOM ni Three.js): lo usan el navegador (js/ficha.js) y
// el build de Node (scripts/lib/paginas.mjs), así la página estática y la dinámica son idénticas.
import { CAMPOS, TIPO_TXT, esc, nf, tieneDatos } from './datos.js';

/**
 * @typedef {object} ContextoFicha
 * @property {Object<string, import('./tipos.js').Fuente>} fuentes  Bloque "fuentes" de los datos
 * @property {(slug: string) => ({ id: string, nombre: string } | undefined)} variedad  Busca por slug
 * @property {(slug: string) => string[]} hijosDe   Slugs de las variedades que la tienen como padre
 * @property {(slug: string) => string} enlace       URL de la página de una variedad
 * @property {(v: import('./tipos.js').Variedad) => string} swatch  Fondo CSS de la muestra de color
 */

function fuenteBadge(d, fuentes) {
  const f = fuentes[d.fuente];
  const t = f ? `Fuente: ${f.nombre} · ${f.licencia} · ${f.fecha}` : `Fuente: ${d.fuente}`;
  return `<span class="src" title="${esc(t)}">${esc(f ? f.nombre.split(' ')[0] : d.fuente)}</span>`;
}
function valorHTML(campo, d) {
  const x = d.valor;
  if (Array.isArray(x)) return x.map((s) => `<span class="pill">${esc(s)}</span>`).join('');
  if (campo === 'genetica' && typeof x === 'object') return `${x.indica ?? '?'}% índica · ${x.sativa ?? '?'}% sativa`;
  if ((campo === 'thc' || campo === 'cbd') && typeof x === 'object') return `${x.min}–${x.max} %`;
  if (campo === 'thc' || campo === 'cbd') return `${x} %`;
  if (campo === 'floracion' && typeof x === 'object') return `${x.min}–${x.max} semanas`;
  if (campo === 'floracion') return `${x} semanas`;
  return esc(x);
}

/** @param {import('./tipos.js').Variedad} v @param {ContextoFicha} ctx @returns {string} */
export function fichaHTML(v, ctx) {
  const tipo = v.tipo ? TIPO_TXT[v.tipo.valor] : 'Tipo sin registrar';
  const filas = CAMPOS.map(([campo, etiqueta, icono]) => {
    const d = v[campo];
    const val = d ? `<span class="val">${valorHTML(campo, d)} ${fuenteBadge(d, ctx.fuentes)}</span>` : '<span class="none">Sin datos verificados</span>';
    return `<div class="row"><svg class="ic"><use href="#i-${icono}"/></svg><span class="lab">${etiqueta}</span>${val}</div>`;
  }).join('');
  const padres = (v.padres?.valor || []).map(ctx.variedad).filter(Boolean);
  const hs = ctx.hijosDe(v.id).map(ctx.variedad).filter(Boolean);
  const chip = (x) => `<a href="${esc(ctx.enlace(x.id))}" data-slug="${esc(x.id)}">${esc(x.nombre)}</a>`;
  let linaje = '';
  if (padres.length) linaje += `<p class="lnote">Cruce de:</p><div class="lineage">${padres.map(chip).join('')}</div>`;
  if (hs.length) linaje += `<p class="lnote">Progenitora de ${nf.format(hs.length)} variedad${hs.length > 1 ? 'es' : ''}:</p><div class="lineage">${hs.slice(0, 8).map(chip).join('')}</div>`;
  if (!linaje) linaje = '<p class="lnote">Sin cruces registrados.</p>';
  const usadas = [...new Set(CAMPOS.map(([c]) => v[c]?.fuente).concat(v.tipo?.fuente, v.padres?.fuente).filter(Boolean))];
  const fuentes = usadas.map((k) => { const f = ctx.fuentes[k]; return f ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a> (${esc(f.licencia)}, ${esc(f.fecha)})` : esc(k); }).join(', ');
  return `
    <p class="eyebrow">${esc(tipo)}</p>
    <h1>${esc(v.nombre)}</h1>
    <div class="tags"><span>${esc(tipo)}</span>${v.criador ? `<span>${esc(v.criador.valor)}</span>` : ''}${tieneDatos(v) ? '<span>Ficha con datos</span>' : ''}</div>
    <h2>Ficha</h2>
    <div class="rows">${filas}</div>
    <h2>Linaje</h2>
    <div>${linaje}</div>
    <p class="fine">Base de datos bajo <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a>. Datos: ${fuentes || 'sin fuente'}. ${esc(ctx.fuentes.kushy?.copyright || '')} Información con fines informativos; no es consejo médico.</p>
    <button type="button" class="closeup" aria-pressed="false">
      <span class="swatch" style="background:${ctx.swatch(v)}"></span>
      <span><b>Ver de cerca</b><small>Acercá la cámara para ver cálices, pistilos y tricomas.</small></span>
      <svg class="ic chev"><use href="#i-chev"/></svg>
    </button>`;
}

/** Leyenda bajo el visor. @param {import('./tipos.js').Variedad} v @param {ContextoFicha} ctx */
export function caption(v, ctx) {
  const padres = (v.padres?.valor || []).map((s) => ctx.variedad(s)?.nombre).filter(Boolean);
  if (padres.length) return `Cruce de ${padres.join(' × ')}.`;
  if (v.criador) return `Criada por ${v.criador.valor}.`;
  return 'Origen sin registrar.';
}
