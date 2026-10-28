// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Configuración de Astro. El sitio es estático (cada página se genera en el build) y vive en
// GitHub Pages bajo /Cepario/, por eso "base": todos los enlaces internos tienen que incluirla.
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://facu-ferreyra.github.io',
  base: '/Cepario',
  trailingSlash: 'always',   // las fichas viven en /v/<slug>/, como en la versión anterior
  // Precarga de páginas: los enlaces con data-astro-prefetch (anterior/siguiente) se descargan
  // apenas se ven, así cambiar de variedad no espera a la red. El resto, al pasar el mouse.
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    react(),     // solo para la isla del buscador
    sitemap(),   // sitemap-index.xml con todas las páginas (necesita "site")
  ],
});
