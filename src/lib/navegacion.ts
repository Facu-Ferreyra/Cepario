// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Recorrido del catálogo en el navegador: filtros, contador y variedad al azar.
// Anterior/siguiente ya vienen como enlaces reales en el HTML (orden completo del catálogo). Con un
// filtro activo, este módulo reescribe esos enlaces para recorrer solo las variedades filtradas.
// El filtro elegido se recuerda durante la visita (sessionStorage).
import { navigate } from 'astro:transitions/client';
import { FILTROS, FILTRO_TXT, pasaFiltro, nf, type Filtro, type Resumen } from './datos.ts';

const BASE = import.meta.env.BASE_URL;
const CLAVE = 'cepario-filtro';
const url = (slug: string): string => `${BASE}v/${slug}/`;

let indice: Promise<Resumen[]> | null = null;
/** public/data/indice.json se descarga una sola vez, recién cuando hace falta. */
export const cargarIndice = (): Promise<Resumen[]> =>
  (indice ??= fetch(`${BASE}data/indice.json`).then((r) => r.json()).then((d: { variedades: Resumen[] }) => d.variedades));

const esFiltro = (f: unknown): f is Filtro => FILTROS.includes(f as Filtro);
function filtroGuardado(): Filtro {
  try { const f = sessionStorage.getItem(CLAVE); if (esFiltro(f)) return f; } catch { /* sin almacenamiento */ }
  return 'todas';
}
function guardar(f: Filtro): void { try { sessionStorage.setItem(CLAVE, f); } catch { /* vale para esta página */ } }

/**
 * Refleja el filtro en la página actual. Si la persona lo acaba de cambiar y la variedad que está
 * viendo no pasa el filtro, va a la primera que sí lo pase.
 */
async function aplicar(f: Filtro, cambio: boolean): Promise<void> {
  document.querySelectorAll<HTMLElement>('#nav [data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset['f'] === f)));
  const sel = document.getElementById('fsel') as HTMLSelectElement | null;
  if (sel) sel.value = f;
  const etiqueta = document.getElementById('flabel');
  if (etiqueta) etiqueta.textContent = FILTRO_TXT[f];
  if (f === 'todas' && !cambio) return;   // el HTML ya trae el recorrido completo

  const slug = document.getElementById('hero')?.dataset['slug'];
  const lista = (await cargarIndice()).filter((r) => pasaFiltro(r, f));
  const n = lista.length, i = lista.findIndex((r) => r.id === slug);
  const pos = document.getElementById('pos');
  if (i < 0) {
    if (cambio && n) { navigate(url(lista[0]!.id)); return; }
    if (pos) pos.textContent = `${nf.format(n)} variedades`;
    return;
  }
  if (pos) pos.textContent = `${nf.format(i + 1)} de ${nf.format(n)}`;
  const enlazar = (id: string, v: Resumen, texto: string): void => {
    const a = document.getElementById(id) as HTMLAnchorElement | null;
    if (!a) return;
    a.href = url(v.id);
    a.setAttribute('aria-label', `${texto}: ${v.nombre}`);
  };
  enlazar('prev', lista[(i - 1 + n) % n]!, 'Variedad anterior');
  enlazar('next', lista[(i + 1) % n]!, 'Variedad siguiente');
}

async function alAzar(): Promise<void> {
  const lista = (await cargarIndice()).filter((r) => pasaFiltro(r, filtroGuardado()));
  if (lista.length) navigate(url(lista[Math.floor(Math.random() * lista.length)]!.id));
}

/** Engancha los controles de la página actual. Corre en cada carga y navegación. */
export function conectarNavegacion(): void {
  const cambiar = (f: Filtro): void => { guardar(f); void aplicar(f, true); };
  document.querySelectorAll<HTMLElement>('#nav [data-f]').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset['f'];
    if (esFiltro(f)) cambiar(f);
  }));
  document.getElementById('fsel')?.addEventListener('change', (e) => {
    const f = (e.target as HTMLSelectElement).value;
    if (esFiltro(f)) cambiar(f);
  });
  document.getElementById('rand')?.addEventListener('click', () => void alAzar());
  void aplicar(filtroGuardado(), false);
}
