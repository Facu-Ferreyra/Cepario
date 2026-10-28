// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Tendencia a violeta de cada variedad, para el color del modelo 3D. Nada de azar; prioridad:
//   1. Dato "antocianinas" (alta | media | baja) con su fuente: define la intensidad.
//   2. Herencia: si algún padre tiene alta o media, o resulta violeta por este mismo algoritmo → media.
//   3. Pista por el nombre (palabras completas como "purple" o "grape"; "grapefruit" no cuenta) → media.
//      Solo pinta el modelo: la ficha no la muestra, porque no es un dato con fuente.
//   4. Si nada aplica: verde (sin nivel).
import type { NivelVioleta } from './esquema.ts';

/** Lo que el cálculo necesita de cada variedad (sirve tanto la variedad completa como la de la colección). */
interface ConLinaje {
  id: string;
  nombre: string;
  antocianinas?: { valor: NivelVioleta } | undefined;
  padres?: { valor: string[] } | undefined;
}

const PISTA = /\b(purple|purp|purps|grape|violet|gdp|urkle|lavender)\b/;
const EXCLUSIONES = /\b(grapefruit)\b/g;
const sinTildes = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const pistaPorNombre = (nombre: string): boolean => PISTA.test(sinTildes(nombre).replace(EXCLUSIONES, ' '));

/** Devuelve el nivel de las variedades que tienen alguno; las que no están en el mapa son verdes. */
export function tendenciasVioleta(variedades: readonly ConLinaje[]): Map<string, NivelVioleta> {
  const porSlug = new Map(variedades.map((v) => [v.id, v]));
  const memo = new Map<string, NivelVioleta | null>();
  const enCurso = new Set<string>();

  const nivel = (id: string): NivelVioleta | null => {
    if (memo.has(id)) return memo.get(id) ?? null;
    // Ciclo en el linaje (A es padre de B y B de A): el que ya se está calculando cuenta como verde
    if (enCurso.has(id)) return null;
    const v = porSlug.get(id);
    if (!v) return null;
    enCurso.add(id);
    let n: NivelVioleta | null = v.antocianinas?.valor ?? null;
    if (!n && (v.padres?.valor ?? []).some((p) => { const np = nivel(p); return np === 'alta' || np === 'media'; })) n = 'media';
    if (!n && pistaPorNombre(v.nombre)) n = 'media';
    enCurso.delete(id);
    memo.set(id, n);
    return n;
  };

  const out = new Map<string, NivelVioleta>();
  for (const v of variedades) { const n = nivel(v.id); if (n) out.set(v.id, n); }
  return out;
}
