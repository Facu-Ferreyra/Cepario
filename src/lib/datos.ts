// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Textos y utilidades de datos que comparten el build (Node), las páginas y el navegador.
// No importa nada de Astro ni de Three.js, así se puede usar desde cualquier lado.
import type { Variedad, Tipo, NivelVioleta } from './esquema.ts';

export const TIPO_TXT: Record<Tipo, string> = { hibrida: 'Híbrida', indica: 'Índica', sativa: 'Sativa' };

export const FILTROS = ['todas', 'indica', 'sativa', 'hibrida', 'datos'] as const;
export type Filtro = (typeof FILTROS)[number];
export const FILTRO_TXT: Record<Filtro, string> = {
  todas: 'Todas las variedades', indica: 'Índicas', sativa: 'Sativas', hibrida: 'Híbridas', datos: 'Con más datos',
};

/** Campos de la ficha, en orden, con su etiqueta. */
export const CAMPOS_FICHA = [
  ['criador', 'Criador'], ['genetica', 'Genética'], ['thc', 'THC'], ['cbd', 'CBD'], ['floracion', 'Floración'],
  ['sabores', 'Sabores'], ['efectos', 'Efectos'], ['adversos', 'Efectos adversos'], ['terpenos', 'Terpenos'],
  ['antocianinas', 'Tendencia a violeta'],
] as const satisfies readonly (readonly [keyof Variedad, string])[];

export const nf = new Intl.NumberFormat('es-AR');
/** Texto para comparar sin mayúsculas ni tildes (buscador). */
export const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ¿Tiene algún dato además de tipo, criador y linaje? */
export const tieneDatos = (v: Variedad): boolean =>
  !!(v.sabores || v.efectos || v.thc || v.cbd || v.floracion || v.terpenos || v.antocianinas);

/**
 * Entrada de public/data/indice.json: lo mínimo para buscar, filtrar, navegar y dibujar el 3D.
 * "datos": 1 si tiene algún dato (filtro "Con más datos"), 2 si además tiene sabores y efectos
 * (candidata a "Variedad del día"). Los campos vacíos se omiten.
 */
export interface Resumen {
  id: string;
  nombre: string;
  tipo?: Tipo;
  criador?: string;
  datos?: 1 | 2;
  padres?: string[];
  violeta?: NivelVioleta;
}

export function resumir(v: Variedad, violeta?: NivelVioleta): Resumen {
  const r: Resumen = { id: v.id, nombre: v.nombre };
  if (v.tipo) r.tipo = v.tipo.valor;
  if (v.criador) r.criador = v.criador.valor;
  const datos = v.sabores && v.efectos ? 2 : tieneDatos(v) ? 1 : 0;
  if (datos) r.datos = datos;
  if (v.padres) r.padres = v.padres.valor;
  if (violeta) r.violeta = violeta;
  return r;
}

/** Texto para <meta name="description"> (hasta ~160 caracteres). */
export function descripcion(v: Variedad): string {
  const tipo = v.tipo ? `variedad ${TIPO_TXT[v.tipo.valor].toLowerCase()}` : 'variedad de cannabis';
  const partes = [`${v.nombre}: ${tipo}${v.criador ? ` de ${v.criador.valor}` : ''}.`];
  if (v.sabores) partes.push(`Sabores: ${v.sabores.valor.slice(0, 4).join(', ').toLowerCase()}.`);
  if (v.efectos) partes.push(`Efectos reportados: ${v.efectos.valor.slice(0, 4).join(', ').toLowerCase()}.`);
  partes.push('Datos con fuente y licencia.');
  let d = partes.join(' ');
  if (d.length > 160) d = d.slice(0, 157).replace(/\s+\S*$/, '') + '…';
  return d;
}

export const pasaFiltro = (r: Resumen, f: Filtro): boolean =>
  f === 'todas' || (f === 'datos' ? (r.datos ?? 0) > 0 : r.tipo === f);

/** Orden del catálogo: por nombre sin distinguir mayúsculas ni tildes; a igual nombre, por slug. */
export const ordenarPorNombre = (a: { id: string, nombre: string }, b: { id: string, nombre: string }): number =>
  a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
