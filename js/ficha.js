// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Ficha de la variedad (panel derecho): datos con su fuente, linaje y botón "Ver de cerca".
import { DB, bySlug, hijos, CAMPOS, TIPO_TXT, esc, nf, tieneDatos } from './datos.js';
import { swatchCSS } from './bud.js';
import { setBotonCerca, alternarCerca } from './viewer.js';

const $ = (id) => document.getElementById(id);
const article = $('article');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

function fuenteBadge(d) {
  const f = DB.fuentes[d.fuente];
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
function fichaHTML(v) {
  const tipo = v.tipo ? TIPO_TXT[v.tipo.valor] : 'Tipo sin registrar';
  const filas = CAMPOS.map(([campo, etiqueta, icono]) => {
    const d = v[campo];
    const val = d ? `<span class="val">${valorHTML(campo, d)} ${fuenteBadge(d)}</span>` : '<span class="none">Sin datos verificados</span>';
    return `<div class="row"><svg class="ic"><use href="#i-${icono}"/></svg><span class="lab">${etiqueta}</span>${val}</div>`;
  }).join('');
  const padres = (v.padres?.valor || []).map((s) => bySlug.get(s)).filter(Boolean);
  const hs = (hijos.get(v.id) || []).map((s) => bySlug.get(s)).filter(Boolean);
  const chip = (x) => `<button type="button" data-slug="${esc(x.id)}">${esc(x.nombre)}</button>`;
  let linaje = '';
  if (padres.length) linaje += `<p class="lnote">Cruce de:</p><div class="lineage">${padres.map(chip).join('')}</div>`;
  if (hs.length) linaje += `<p class="lnote">Progenitora de ${nf.format(hs.length)} variedad${hs.length > 1 ? 'es' : ''}:</p><div class="lineage">${hs.slice(0, 8).map(chip).join('')}</div>`;
  if (!linaje) linaje = '<p class="lnote">Sin cruces registrados.</p>';
  const usadas = [...new Set(CAMPOS.map(([c]) => v[c]?.fuente).concat(v.tipo?.fuente, v.padres?.fuente).filter(Boolean))];
  const fuentes = usadas.map((k) => { const f = DB.fuentes[k]; return f ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a> (${esc(f.licencia)}, ${esc(f.fecha)})` : esc(k); }).join(', ');
  return `
    <p class="eyebrow">${esc(tipo)}</p>
    <h1>${esc(v.nombre)}</h1>
    <div class="tags"><span>${esc(tipo)}</span>${v.criador ? `<span>${esc(v.criador.valor)}</span>` : ''}${tieneDatos(v) ? '<span>Ficha con datos</span>' : ''}</div>
    <h2>Ficha</h2>
    <div class="rows">${filas}</div>
    <h2>Linaje</h2>
    <div>${linaje}</div>
    <p class="fine">Base de datos bajo <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL 1.0</a>. Datos: ${fuentes || 'sin fuente'}. ${esc(DB.fuentes.kushy?.copyright || '')} Información con fines informativos; no es consejo médico.</p>
    <button type="button" class="closeup" aria-pressed="false">
      <span class="swatch" style="background:${swatchCSS(v)}"></span>
      <span><b>Ver de cerca</b><small>Acercá la cámara para ver cálices, pistilos y tricomas.</small></span>
      <svg class="ic chev"><use href="#i-chev"/></svg>
    </button>`;
}
function caption(v) {
  const padres = (v.padres?.valor || []).map((s) => bySlug.get(s)?.nombre).filter(Boolean);
  if (padres.length) return `Cruce de ${padres.join(' × ')}.`;
  if (v.criador) return `Criada por ${v.criador.valor}.`;
  return 'Origen sin registrar.';
}

let swapTimer = 0;
export function pintarFicha(v, animar) {
  const llenar = () => {
    article.innerHTML = fichaHTML(v);
    article.classList.remove('out');
    [...article.children].forEach((c, i) => { c.style.setProperty('--i', i); c.classList.add('enter'); });
    setBotonCerca(article.querySelector('.closeup'));
    $('caption').textContent = caption(v);
    $('detail').scrollTop = 0;
  };
  clearTimeout(swapTimer);
  if (!animar) { llenar(); return; }
  [...article.children].forEach((c) => c.classList.remove('enter'));
  void article.offsetWidth;
  article.classList.add('out');
  swapTimer = setTimeout(llenar, RM ? 0 : 200);
}

/** Clicks dentro de la ficha: chips de linaje (navegan) y "Ver de cerca" (zoom). */
export function iniciarFicha(alIrA) {
  article.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-slug]');
    if (chip) { alIrA(chip.dataset.slug); return; }
    if (e.target.closest('.closeup')) alternarCerca();
  });
}
