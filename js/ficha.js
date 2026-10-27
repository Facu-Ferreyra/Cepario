// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Ficha de la variedad (panel derecho): datos con su fuente, linaje y botón "Ver de cerca".
import { DB, bySlug, hijos, cargarDetalle, esc } from './datos.js';
import { swatchCSS } from './bud.js';
import { fichaHTML, caption } from './ficha-html.js';
import { setBotonCerca, alternarCerca } from './viewer.js';

const $ = (id) => document.getElementById(id);
const article = $('article');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Raíz del sitio, calculada desde este archivo (js/): sirve igual en / y en /v/<slug>/
const RAIZ = new URL('../', import.meta.url);
export const urlVariedad = (slug) => new URL(`v/${encodeURIComponent(slug)}/`, RAIZ).pathname;

/** @type {import('./ficha-html.js').ContextoFicha} */
const ctx = {
  get fuentes() { return DB.fuentes; },
  variedad: (s) => bySlug.get(s),
  hijosDe: (s) => hijos.get(s) || [],
  enlace: urlVariedad,
  swatch: (v) => swatchCSS(bySlug.get(v.id) || v),   // la paleta sale del resumen (id + tipo)
};

let swapTimer = 0, pedido = 0;
/**
 * Pinta la ficha de una variedad. El detalle (data/v/<slug>.json) se pide mientras corre la
 * animación de salida; si ya estaba precargado, aparece sin espera.
 * @param {string} slug
 * @param {boolean} animar  false en la primera ficha (sin animación de salida)
 */
export function pintarFicha(slug, animar) {
  const n = ++pedido;                 // si el usuario ya pasó a otra variedad, se ignora esta respuesta
  const detalle = cargarDetalle(slug);
  const llenar = (v) => {
    article.innerHTML = fichaHTML(v, ctx);
    article.classList.remove('out');
    [...article.children].forEach((c, i) => { c.style.setProperty('--i', i); c.classList.add('enter'); });
    setBotonCerca(article.querySelector('.closeup'));
    $('caption').textContent = caption(v, ctx);
    $('detail').scrollTop = 0;
  };
  const fallar = () => {
    article.innerHTML = `<p class="notice">No se pudo cargar la ficha de ${esc(bySlug.get(slug)?.nombre || slug)}. Revisá la conexión y volvé a elegirla.</p>`;
    article.classList.remove('out');
    setBotonCerca(null);
    $('caption').textContent = '';
  };
  const mostrar = () => detalle.then((v) => { if (n === pedido) llenar(v); }, () => { if (n === pedido) fallar(); });
  clearTimeout(swapTimer);
  if (!animar) { mostrar(); return; }
  [...article.children].forEach((c) => c.classList.remove('enter'));
  void article.offsetWidth;
  article.classList.add('out');
  swapTimer = setTimeout(mostrar, RM ? 0 : 200);
}

/**
 * Clicks dentro de la ficha: chips de linaje (navegan) y "Ver de cerca" (zoom).
 * @param {(slug: string) => void} alIrA
 */
export function iniciarFicha(alIrA) {
  article.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-slug]');
    if (chip) {
      if (e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;   // abrir en otra pestaña: que lo haga el navegador
      e.preventDefault(); alIrA(chip.dataset.slug); return;
    }
    if (e.target.closest('.closeup')) alternarCerca();
  });
}
