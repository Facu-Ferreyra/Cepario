// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Ficha de la variedad (panel derecho): datos con su fuente, linaje y botón "Ver de cerca".
import { DB, bySlug, hijos } from './datos.js';
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
  swatch: swatchCSS,
};

let swapTimer = 0;
export function pintarFicha(v, animar) {
  const llenar = () => {
    article.innerHTML = fichaHTML(v, ctx);
    article.classList.remove('out');
    [...article.children].forEach((c, i) => { c.style.setProperty('--i', i); c.classList.add('enter'); });
    setBotonCerca(article.querySelector('.closeup'));
    $('caption').textContent = caption(v, ctx);
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
    if (chip) {
      if (e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;   // abrir en otra pestaña: que lo haga el navegador
      e.preventDefault(); alIrA(chip.dataset.slug); return;
    }
    if (e.target.closest('.closeup')) alternarCerca();
  });
}
