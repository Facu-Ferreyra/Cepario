// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Tendencia a violeta de cada variedad, para el color del modelo 3D. Nada de azar; prioridad:
//   1. Dato "antocianinas" (alta | media | baja) con su fuente: define la intensidad.
//   2. Herencia: si algún padre tiene alta o media, o resulta violeta por este mismo algoritmo → media.
//   3. Pista por el nombre (palabras completas como "purple" o "grape"; "grapefruit" no cuenta) → media.
//      Solo pinta el modelo: la ficha no la muestra, porque no es un dato con fuente.
//   4. Si nada aplica: verde (sin nivel).

const PISTA = /\b(purple|purp|purps|grape|violet|gdp|urkle|lavender)\b/;
const EXCLUSIONES = /\b(grapefruit)\b/g;
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** @param {string} nombre @returns {boolean} */
export const pistaPorNombre = (nombre) => PISTA.test(sinTildes(nombre).replace(EXCLUSIONES, ' '));

/**
 * @param {import('../../js/tipos.js').Variedad[]} variedades
 * @returns {Map<string, import('../../js/tipos.js').NivelVioleta>}  solo las que tienen algún nivel
 */
export function tendenciasVioleta(variedades) {
  const porSlug = new Map(variedades.map((v) => [v.id, v]));
  /** @type {Map<string, import('../../js/tipos.js').NivelVioleta | null>} */
  const memo = new Map();
  const enCurso = new Set();

  const nivel = (id) => {
    if (memo.has(id)) return memo.get(id);
    // Ciclo en el linaje (A es padre de B y B de A): el que ya se está calculando cuenta como verde
    if (enCurso.has(id)) return null;
    const v = porSlug.get(id);
    if (!v) return null;
    enCurso.add(id);
    let n = v.antocianinas ? v.antocianinas.valor : null;
    if (!n && (v.padres?.valor || []).some((p) => ['alta', 'media'].includes(nivel(p)))) n = 'media';
    if (!n && pistaPorNombre(v.nombre)) n = 'media';
    enCurso.delete(id);
    memo.set(id, n);
    return n;
  };

  const out = new Map();
  for (const v of variedades) { const n = nivel(v.id); if (n) out.set(v.id, n); }
  return out;
}
