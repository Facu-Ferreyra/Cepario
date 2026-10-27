// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Buscador por nombre o criador (combobox accesible con navegación por teclado).
import { DB, TIPO_TXT, norm, esc, nf } from './datos.js';
import { swatchCSS } from './bud.js';

const $ = (id) => document.getElementById(id);
const hero = $('hero'), q = $('q'), results = $('results');
let hallados = [], activo = -1, tBusqueda = 0;

function buscar(texto) {
  const t = norm(texto.trim());
  if (!t) return [];
  const empieza = [], contiene = [], criador = [];
  for (const v of DB.variedades) {
    if (v._n.startsWith(t)) empieza.push(v);
    else if (v._n.includes(t)) contiene.push(v);
    else if (v._c.includes(t)) criador.push(v);
    if (empieza.length >= 30) break;
  }
  return [...empieza, ...contiene, ...criador];
}
function pintarResultados() {
  const total = hallados.length, vis = hallados.slice(0, 30);
  if (!q.value.trim()) { cerrarResultados(); return; }
  results.innerHTML = vis.map((v, i) => `
    <li role="option" id="r${i}" data-slug="${esc(v.id)}" aria-selected="${i === activo}">
      <span class="swatch" style="background:${swatchCSS(v)}"></span>
      <span><b>${esc(v.nombre)}</b><small>${esc(v.criador?.valor || 'Criador sin registrar')}</small></span>
      <span class="pill">${esc(v.tipo ? TIPO_TXT[v.tipo.valor] : '—')}</span>
    </li>`).join('') + `<li class="rmeta" role="presentation">${total ? (total > 30 ? `Mostrando 30 de ${nf.format(total)}+ resultados` : `${total} resultado${total > 1 ? 's' : ''}`) : 'Sin resultados'}</li>`;
  results.hidden = false;
  q.setAttribute('aria-expanded', 'true');
  q.setAttribute('aria-activedescendant', activo >= 0 ? `r${activo}` : '');
  if (activo >= 0) $(`r${activo}`)?.scrollIntoView({ block: 'nearest' });
}
export function cerrarResultados() { results.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); activo = -1; }

/**
 * Escape dentro del buscador: primero cierra la lista, después el modo búsqueda del celular.
 * Devuelve true si hizo algo.
 */
export function cerrarBusqueda() {
  if (!results.hidden) { cerrarResultados(); return true; }
  if (hero.classList.contains('searching')) { hero.classList.remove('searching'); return true; }
  return false;
}

export function iniciarBuscador(alElegir) {
  const elegir = (slug) => { cerrarResultados(); q.value = ''; q.blur(); hero.classList.remove('searching'); alElegir(slug); };
  q.addEventListener('input', () => { clearTimeout(tBusqueda); tBusqueda = setTimeout(() => { if (!DB) return; hallados = buscar(q.value); activo = hallados.length ? 0 : -1; pintarResultados(); }, 80); });
  q.addEventListener('keydown', (e) => {
    const n = Math.min(30, hallados.length);
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); activo = (activo + 1) % n; pintarResultados(); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); activo = (activo - 1 + n) % n; pintarResultados(); }
    else if (e.key === 'Enter' && activo >= 0) { e.preventDefault(); elegir(hallados[activo].id); }
  });
  results.addEventListener('mousedown', (e) => e.preventDefault()); // evita perder el foco antes del click
  results.addEventListener('click', (e) => { const li = e.target.closest('[data-slug]'); if (li) elegir(li.dataset.slug); });
  q.addEventListener('blur', () => setTimeout(cerrarResultados, 120));
  $('mSearch').addEventListener('click', () => { hero.classList.add('searching'); q.focus(); });
  $('sClose').addEventListener('click', () => { hero.classList.remove('searching'); cerrarResultados(); });
}
