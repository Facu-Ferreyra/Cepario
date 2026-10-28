// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Tipos del esquema de datos, en JSDoc. Este archivo no ejecuta nada: sirve para que el editor
// autocomplete y avise errores. Se usan así:  /** @param {import('./tipos.js').Variedad} v */
//
// La validación real de los aportes está en schema/*.schema.json y scripts/validate.mjs.

/** @typedef {'hibrida' | 'indica' | 'sativa'} Tipo */
/** @typedef {'alta' | 'media' | 'baja'} NivelVioleta */

/**
 * Un valor con la fuente de la que viene. "fuente" es una clave del bloque `fuentes`.
 * @template T
 * @typedef {object} Dato
 * @property {T} valor
 * @property {string} fuente
 */

/**
 * Rango numérico (por ejemplo, THC de 14 a 18 %).
 * @typedef {object} Rango
 * @property {number} min
 * @property {number} max
 */

/**
 * Proporción de genética en %. indica + sativa = 100.
 * @typedef {object} Genetica
 * @property {number} indica
 * @property {number} sativa
 */

/**
 * De dónde salen los datos y con qué licencia.
 * @typedef {object} Fuente
 * @property {string} nombre
 * @property {string} url
 * @property {string} licencia   Identificador SPDX: ODbL-1.0, MIT, CC0-1.0…
 * @property {string} fecha      AAAA-MM-DD
 * @property {string} [copyright]
 * @property {string} [nota]
 */

/**
 * Variedad completa: data/v/<slug>.json y cada elemento de data/strains.json.
 * Los campos ausentes se juntan en la línea "Sin determinar" de la ficha.
 * @typedef {object} Variedad
 * @property {string} id                      Slug: minúsculas, números y guiones
 * @property {string} nombre
 * @property {Dato<string>} [criador]
 * @property {Dato<Tipo>} [tipo]
 * @property {Dato<Genetica>} [genetica]
 * @property {Dato<number | Rango>} [thc]     En %, de 0 a 40
 * @property {Dato<number | Rango>} [cbd]     En %, de 0 a 30
 * @property {Dato<number | Rango>} [floracion]  En semanas, de 4 a 20
 * @property {Dato<string[]>} [sabores]
 * @property {Dato<string[]>} [efectos]
 * @property {Dato<string[]>} [adversos]
 * @property {Dato<string[]>} [terpenos]
 * @property {Dato<NivelVioleta>} [antocianinas]  Tendencia a violeta (pigmentos de la flor)
 * @property {Dato<string[]>} [padres]        Slugs de las variedades progenitoras
 */

/**
 * Entrada del índice (data/indice.json): lo mínimo para buscar, filtrar, navegar y dibujar el 3D.
 * @typedef {object} Resumen
 * @property {string} id
 * @property {string} nombre
 * @property {Tipo} [tipo]
 * @property {string} [criador]
 * @property {1 | 2} [datos]       1: tiene algún dato; 2: además tiene sabores y efectos
 * @property {string[]} [padres]
 * @property {NivelVioleta} [violeta]  Color del 3D: dato, herencia o pista por nombre (sin nivel = verde)
 * @property {string} [_n]        Nombre normalizado para buscar (lo agrega indexar())
 * @property {string} [_c]         Criador normalizado para buscar (lo agrega indexar())
 * @property {number} [_i]         Número de ejemplar: posición en el catálogo, desde 1 (lo agrega indexar())
 */

/**
 * data/indice.json
 * @typedef {object} Indice
 * @property {number} [version]
 * @property {Object<string, Fuente>} fuentes
 * @property {Resumen[]} variedades
 */

/**
 * data/strains.json: el dataset completo.
 * @typedef {object} BaseDatos
 * @property {number} version
 * @property {string[]} campos     Campos de la ficha, en orden
 * @property {Object<string, Fuente>} fuentes
 * @property {Variedad[]} variedades
 */

/**
 * data/aportes/<slug>.json: solo los campos aportados. "nombre" solo para variedades nuevas.
 * @typedef {Partial<Omit<Variedad, 'id'>> & { $schema?: string, $comentario?: string }} Aporte
 */

export {};
