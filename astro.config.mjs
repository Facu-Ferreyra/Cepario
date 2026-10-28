// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Configuración de Astro. El sitio es estático (cada página se genera en el build) y vive en
// GitHub Pages bajo /Cepario/, por eso "base": todos los enlaces internos tienen que incluirla.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://facu-ferreyra.github.io',
  base: '/Cepario',
  trailingSlash: 'always',   // las fichas viven en /v/<slug>/, como en la versión anterior
});
