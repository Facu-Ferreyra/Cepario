// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// HTML de la ficha. Módulo "puro" (sin DOM ni Three.js): lo usan el navegador (js/ficha.js) y
// el build de Node (scripts/lib/paginas.mjs), así la página estática y la dinámica son idénticas.
// La ficha es una etiqueta de herbario: cada dato dice quién lo determinó ("Det.") según su fuente.
import { CAMPOS, TIPO_TXT, esc, nf } from './datos.js';

/**
 * @typedef {object} ContextoFicha
 * @property {Object<string, import('./tipos.js').Fuente>} fuentes  Bloque "fuentes" de los datos
 * @property {(slug: string) => ({ id: string, nombre: string } | undefined)} variedad  Busca por slug
 * @property {(slug: string) => string[]} hijosDe   Slugs de las variedades que la tienen como padre
 * @property {(slug: string) => string} enlace       URL de la página de una variedad
 * @property {(slug: string) => number} numero       Número de ejemplar: posición en el catálogo completo (desde 1)
 */

/** "Det. Kushy, 2017": quién determinó el dato. El nombre completo y la licencia van en el title. */
function determino(d, fuentes) {
  const f = fuentes[d.fuente];
  if (!f) return `<span class="det"><abbr title="Determinó">Det.</abbr> ${esc(d.fuente)}</span>`;
  return `<span class="det" title="${esc(`${f.nombre}, licencia ${f.licencia}, ${f.fecha}`)}"><abbr title="Determinó">Det.</abbr> ${esc(f.nombre.split(' ')[0])}, ${esc(f.fecha.slice(0, 4))}</span>`;
}
function valorHTML(campo, d) {
  const x = d.valor;
  if (Array.isArray(x)) return esc(x.join(', '));
  if (campo === 'genetica' && typeof x === 'object') return `${x.indica ?? '?'} % índica, ${x.sativa ?? '?'} % sativa`;
  if ((campo === 'thc' || campo === 'cbd') && typeof x === 'object') return `${x.min}–${x.max} %`;
  if (campo === 'thc' || campo === 'cbd') return `${x} %`;
  if (campo === 'floracion' && typeof x === 'object') return `${x.min}–${x.max} semanas`;
  if (campo === 'floracion') return `${x} semanas`;
  return esc(x);
}
const fila = (etiqueta, d, fuentes, valor) => `<div class="et-fila"><dt>${etiqueta}</dt><dd>${valor}${determino(d, fuentes)}</dd></div>`;
const lista = new Intl.ListFormat('es', { type: 'conjunction' });
const enMinuscula = (s) => (s === s.toUpperCase() ? s : s.toLowerCase());   // "THC" queda igual

/** @param {import('./tipos.js').Variedad} v @param {ContextoFicha} ctx @returns {string} */
export function fichaHTML(v, ctx) {
  const tipo = v.tipo?.valor;
  // Los datos determinados van en filas; los que faltan, juntos en una línea al final
  const presentes = CAMPOS.filter(([c]) => v[c]), faltan = CAMPOS.filter(([c]) => !v[c]).map(([, e]) => e);
  if (!v.tipo) faltan.unshift('Tipo');
  const filas = (v.tipo ? fila('Tipo', v.tipo, ctx.fuentes, TIPO_TXT[tipo]) : '') +
    presentes.map(([campo, etiqueta]) => fila(etiqueta, v[campo], ctx.fuentes, valorHTML(campo, v[campo]))).join('');
  const sinDeterminar = faltan.length
    ? `<p class="et-faltan">Sin determinar: ${esc(lista.format(faltan.map((e, i) => (i ? enMinuscula(e) : e))))}.</p>` : '';
  const padres = (v.padres?.valor || []).map(ctx.variedad).filter(Boolean);
  const hs = ctx.hijosDe(v.id).map(ctx.variedad).filter(Boolean);
  const enlace = (x) => `<a href="${esc(ctx.enlace(x.id))}" data-slug="${esc(x.id)}">${esc(x.nombre)}</a>`;
  let linaje = '';
  if (padres.length) linaje += `<p>Cruce de ${padres.map(enlace).join(' × ')}.${v.padres ? ` ${determino(v.padres, ctx.fuentes)}` : ''}</p>`;
  if (hs.length) {
    const mas = hs.length > 8 ? `, y ${nf.format(hs.length - 8)} más` : '';
    linaje += `<p>Progenitora de ${hs.slice(0, 8).map(enlace).join(', ')}${mas}.</p>`;
  }
  if (!linaje) linaje = '<p class="none">Sin cruces registrados.</p>';
  const usadas = [...new Set(CAMPOS.map(([c]) => v[c]?.fuente).concat(v.tipo?.fuente, v.padres?.fuente).filter(Boolean))];
  const fuentes = usadas.map((k) => { const f = ctx.fuentes[k]; return f ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a> (${esc(f.licencia)}, ${esc(f.fecha)})` : esc(k); }).join(', ');
  return `
    <header class="et-cab">
      <p>Herbario Cepario<br>Ejemplar n.º ${String(ctx.numero(v.id)).padStart(4, '0')}</p>
      <svg class="sello" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22"/><circle cx="24" cy="24" r="18.5"/><use href="#i-leaf" x="12" y="11" width="24" height="24"/></svg>
    </header>
    <h1 class="${tipo ? `t-${tipo}` : ''}">${esc(v.nombre)}</h1>
    <dl class="et-datos">${filas}</dl>${sinDeterminar}
    <h2>Linaje</h2>
    <div class="et-linaje">${linaje}</div>
    <p class="fine">Base de datos bajo <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a>. Datos: ${fuentes || 'sin fuente'}. ${esc(ctx.fuentes.kushy?.copyright || '')} Información con fines informativos; no es consejo médico.</p>
    <button type="button" class="closeup" aria-pressed="false"><svg class="ic"><use href="#i-zoomin"/></svg>Ver de cerca</button>`;
}

/** Leyenda bajo el visor. @param {import('./tipos.js').Variedad} v @param {ContextoFicha} ctx */
export function caption(v, ctx) {
  const padres = (v.padres?.valor || []).map((s) => ctx.variedad(s)?.nombre).filter(Boolean);
  if (padres.length) return `Cruce de ${padres.join(' × ')}.`;
  if (v.criador) return `Criada por ${v.criador.valor}.`;
  return 'Origen sin registrar.';
}
