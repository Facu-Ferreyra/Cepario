// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Todo lo que las páginas necesitan saber del catálogo completo, calculado una sola vez por build:
// orden, número de ejemplar, padres e hijos, anterior/siguiente, contadores, variedad del día y
// nivel de violeta. Solo corre en el build (usa astro:content).
import { getCollection } from 'astro:content';
import type { Variedad, Fuente, NivelVioleta } from './esquema.ts';
import { FILTROS, type Filtro, ordenarPorNombre, pasaFiltro, resumir, type Resumen } from './datos.ts';
import { tendenciasVioleta } from './violeta.ts';

export interface Vecina { id: string; nombre: string }

export interface Catalogo {
  variedades: Variedad[];                 // en el orden del catálogo
  porSlug: Map<string, Variedad>;
  numero: Map<string, number>;            // número de ejemplar, desde 1
  hijos: Map<string, string[]>;           // slug -> variedades que la tienen como padre
  violeta: Map<string, NivelVioleta>;
  fuentes: Record<string, Fuente>;
  conteos: Record<Filtro, number>;
  delDia: Variedad;
}

let cache: Promise<Catalogo> | undefined;
/** El catálogo se arma la primera vez que una página lo pide; las demás reusan el mismo. */
export const catalogo = (): Promise<Catalogo> => (cache ??= cargar());

async function cargar(): Promise<Catalogo> {
  // getCollection no garantiza el orden: se ordena igual que data/strains.json
  const variedades = (await getCollection('variedades')).map((e) => e.data).sort(ordenarPorNombre);
  const fuentes = Object.fromEntries((await getCollection('fuentes')).map((e) => [e.id, e.data]));
  const porSlug = new Map(variedades.map((v) => [v.id, v]));
  const numero = new Map(variedades.map((v, i) => [v.id, i + 1]));
  const hijos = new Map<string, string[]>();
  for (const v of variedades) for (const p of v.padres?.valor ?? []) {
    if (!hijos.has(p)) hijos.set(p, []);
    hijos.get(p)!.push(v.id);
  }
  const violeta = tendenciasVioleta(variedades);
  const resumenes = variedades.map((v) => resumir(v, violeta.get(v.id)));
  const conteos = Object.fromEntries(FILTROS.map((f) => [f, resumenes.filter((r) => pasaFiltro(r, f)).length])) as Record<Filtro, number>;
  return { variedades, porSlug, numero, hijos, violeta, fuentes, conteos, delDia: variedadDelDia(variedades, resumenes) };
}

/**
 * Una variedad con sabores y efectos por día, igual para todo el mundo ese día. Como el sitio es
 * estático, se calcula al construirlo: el despliegue se repite todos los días (ver el workflow).
 */
function variedadDelDia(variedades: Variedad[], resumenes: Resumen[]): Variedad {
  const ricas = variedades.filter((_, i) => resumenes[i]!.datos === 2);
  const pool = ricas.length ? ricas : variedades;
  return pool[Math.floor(Date.now() / 86_400_000) % pool.length]!;
}

/** Variedad anterior y siguiente en el orden del catálogo (dan la vuelta en los extremos). */
export function vecinas(c: Catalogo, id: string): { anterior: Vecina; siguiente: Vecina } {
  const i = c.numero.get(id)! - 1, n = c.variedades.length;
  const a = c.variedades[(i - 1 + n) % n]!, s = c.variedades[(i + 1) % n]!;
  return { anterior: { id: a.id, nombre: a.nombre }, siguiente: { id: s.id, nombre: s.nombre } };
}

/** URL de la página de una variedad, con la base del sitio (/Cepario/). */
export const urlVariedad = (slug: string): string => `${import.meta.env.BASE_URL}v/${slug}/`;
