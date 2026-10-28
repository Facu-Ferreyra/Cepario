// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Colecciones de contenido. Leen data/strains.json, que arma scripts/build-strains.mjs combinando
// los datos importados (Kushy) con los aportes de data/aportes/. Astro valida cada entrada con el
// esquema de src/lib/esquema.ts: si un dato no cumple, el build se detiene con el error.
import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { Variedad, Fuente } from './lib/esquema';

const DATOS = 'data/strains.json';

const variedades = defineCollection({
  loader: file(DATOS, { parser: (texto) => JSON.parse(texto).variedades }),
  schema: Variedad,
});

const fuentes = defineCollection({
  loader: file(DATOS, { parser: (texto) => JSON.parse(texto).fuentes }),
  schema: Fuente,
});

export const collections = { variedades, fuentes };
