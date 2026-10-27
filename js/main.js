// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Punto de entrada: carga los datos, filtros, navegación anterior/siguiente, enlaces #slug y aviso de edad.
import { DB, bySlug, indexar, pasaFiltro, nf, TIPO_TXT, FILTRO_TXT, MUESTRA, resumir, guardarDetalles, precargar } from './datos.js';
import { mostrarVariedad, salirDeFoco, arrancarVisor } from './viewer.js';
import { pintarFicha, iniciarFicha, urlVariedad } from './ficha.js';
import { iniciarBuscador, cerrarBusqueda } from './search.js';

const $ = (id) => document.getElementById(id);
const hero = $('hero'), stage = $('stage'), loaderEl = $('loader');
// Rutas relativas a este archivo (js/), no a la página: así funcionan desde cualquier carpeta
const URL_INDICE = new URL('../data/indice.json', import.meta.url);

let filtro = 'todas', lista = [], active = null;

/* =========================================================
   NAVEGACIÓN Y FILTROS
   ========================================================= */
function aplicarFiltro(f, mantener = true) {
  filtro = f;
  lista = DB.variedades.filter((v) => pasaFiltro(v, f)).map((v) => v.id);
  document.querySelectorAll('#nav [data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
  $('fsel').value = f;
  $('flabel').textContent = FILTRO_TXT[f];
  if (mantener && active && !lista.includes(active)) seleccionar(lista[0], 1);
  actualizarContador();
}
function actualizarContador() {
  const i = lista.indexOf(active);
  $('pos').textContent = i >= 0 ? `${nf.format(i + 1)} de ${nf.format(lista.length)}` : `${nf.format(lista.length)} variedades`;
  $('prev').disabled = $('next').disabled = lista.length < 2;
  // Precarga las fichas vecinas: así anterior/siguiente no espera a la red
  if (i >= 0 && lista.length > 1) {
    precargar(lista[(i + 1) % lista.length]);
    precargar(lista[(i - 1 + lista.length) % lista.length]);
  }
}
function paso(d) {
  if (!lista.length) return;
  const i = lista.indexOf(active);
  const n = i < 0 ? 0 : (i + d + lista.length) % lista.length;
  seleccionar(lista[n], d);
}
function irA(slug) {
  const v = bySlug.get(slug);
  if (!v) return;
  if (!pasaFiltro(v, filtro)) aplicarFiltro('todas', false);
  const a = lista.indexOf(active), b = lista.indexOf(slug);
  seleccionar(slug, b >= a ? 1 : -1);
}
$('prev').addEventListener('click', () => paso(-1));
$('next').addEventListener('click', () => paso(1));
$('rand').addEventListener('click', () => { if (lista.length) seleccionar(lista[Math.floor(Math.random() * lista.length)], 1); });
document.querySelectorAll('#nav [data-f]').forEach((b) => b.addEventListener('click', () => aplicarFiltro(b.dataset.f)));
$('fsel').addEventListener('change', (e) => aplicarFiltro(e.target.value));

iniciarBuscador(irA);
iniciarFicha(irA);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (cerrarBusqueda()) return;
  salirDeFoco();
});

/* =========================================================
   CAMBIO DE VARIEDAD (modelo + ficha + URL)
   ========================================================= */
function seleccionar(slug, dir = 1) {
  const v = bySlug.get(slug);
  if (!v || slug === active) return;
  const primera = active === null;
  active = slug;
  mostrarVariedad(v, dir);          // el modelo 3D solo necesita el resumen (id y tipo)
  pintarFicha(slug, !primera);      // la ficha pide el detalle
  actualizarContador();
  // La URL pasa a ser la página estática de la variedad (v/<slug>/), sin recargar
  document.title = `${v.nombre}, en Cepario`;
  try { history.replaceState(null, '', urlVariedad(slug)); } catch { /* algunos navegadores lo bloquean en file:// */ }
}
// Enlaces viejos con #slug: muestran la variedad y la URL se reescribe a v/<slug>/
const slugDelHash = () => decodeURIComponent(location.hash.slice(1));
window.addEventListener('hashchange', () => { const s = slugDelHash(); if (s && s !== active) irA(s); });

/* =========================================================
   ARRANQUE
   ========================================================= */
function edad() {
  const gate = $('gate');
  let ok = false;
  try { ok = localStorage.getItem('cepario-edad-ok') === '1'; } catch { /* almacenamiento bloqueado: se vuelve a preguntar */ }
  if (ok) return;
  gate.hidden = false;
  $('gYes').focus();
  $('gYes').addEventListener('click', () => { try { localStorage.setItem('cepario-edad-ok', '1'); } catch {} gate.hidden = true; stage.focus({ preventScroll: true }); });
  $('gNo').addEventListener('click', () => { $('gMsg').hidden = false; });
}

function variedadDelDia() {
  const ricas = DB.variedades.filter((v) => v.datos === 2);
  const pool = ricas.length ? ricas : DB.variedades;
  const dia = Math.floor(Date.now() / 86400000);
  return pool[dia % pool.length];
}

async function iniciar() {
  edad();
  loaderEl.classList.add('show');
  arrancarVisor();
  // En v/<slug>/ ya sabemos qué ficha hace falta: se pide en paralelo con el índice
  if (hero.dataset.slug && !slugDelHash()) precargar(hero.dataset.slug);
  let db;
  try {
    const res = await fetch(URL_INDICE);
    if (!res.ok) throw new Error(res.status);
    db = await res.json();
  } catch (err) {
    console.warn('No se pudo cargar data/indice.json', err);
    db = { fuentes: MUESTRA.fuentes, variedades: MUESTRA.variedades.map(resumir) };
    guardarDetalles(MUESTRA.variedades);
    const n = $('notice');
    n.hidden = false;
    n.textContent = 'No se pudo cargar data/indice.json. Si abriste el archivo con doble clic, servilo con un servidor local (por ejemplo: npx serve). Mostrando 3 variedades de ejemplo.';
  }
  indexar(db);
  // Contadores de la barra lateral
  for (const f of Object.keys(FILTRO_TXT)) {
    const el = document.querySelector(`[data-c="${f}"]`);
    if (el) el.textContent = nf.format(db.variedades.filter((v) => pasaFiltro(v, f)).length);
  }
  const dia = variedadDelDia();
  $('featTitle').textContent = dia.nombre;
  $('featText').textContent = dia.tipo && dia.criador ? `${TIPO_TXT[dia.tipo]}, de ${dia.criador}.`
    : dia.tipo ? `${TIPO_TXT[dia.tipo]}.` : dia.criador ? `De ${dia.criador}.` : 'Datos parciales.';
  $('featGo').addEventListener('click', () => irA(dia.id));
  aplicarFiltro('todas', false);
  loaderEl.classList.remove('show');
  // Prioridad: #slug (enlace viejo) > página v/<slug>/ (data-slug) > variedad del día
  const inicial = [slugDelHash(), hero.dataset.slug].find((s) => s && bySlug.has(s)) || dia.id;
  seleccionar(inicial, 1);
}
iniciar();
