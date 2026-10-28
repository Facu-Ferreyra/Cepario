// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Forma de los datos de Cepario: ÚNICO lugar donde se define. Lo usan
//   - src/content.config.ts: la colección "variedades" (si un dato no cumple, el build falla),
//   - scripts/validate.mjs: los aportes de data/aportes/ antes de combinarlos,
//   - scripts/esquemas.ts: genera schema/*.json para que el editor autocomplete los aportes.
// Se importa con la extensión .ts para que Node (que ejecuta TypeScript directo) lo encuentre.
import { z } from 'astro/zod';

z.config(z.locales.es());   // mensajes de error en castellano

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slug = z.string().regex(SLUG, 'solo minúsculas, números y guiones (por ejemplo "afghan-big-bud")');
const texto = z.string().min(1).max(80);
const lista = z.array(z.string().min(1).max(40)).min(1).max(20)
  .refine((xs) => new Set(xs).size === xs.length, 'tiene elementos repetidos');

/** Número o rango {min, max} entre dos límites, con min ≤ max. */
const numeroORango = (min: number, max: number) => z.union([
  z.number().min(min).max(max),
  z.strictObject({ min: z.number().min(min).max(max), max: z.number().min(min).max(max) })
    .refine((r) => r.min <= r.max, 'min no puede ser mayor que max'),
]);

/** Cada dato lleva su valor y la fuente que lo determinó. */
const dato = <T extends z.ZodType>(valor: T) => z.strictObject({ valor, fuente: slug });

export const TIPOS = ['hibrida', 'indica', 'sativa'] as const;
export const NIVELES_VIOLETA = ['alta', 'media', 'baja'] as const;

/** Campos con fuente, en el orden en que se escriben en data/strains.json. */
const campos = {
  criador: dato(texto),
  tipo: dato(z.enum(TIPOS)),
  genetica: dato(z.strictObject({ indica: z.number().min(0).max(100), sativa: z.number().min(0).max(100) })
    .refine((g) => g.indica + g.sativa === 100, 'índica + sativa debe sumar 100')),
  thc: dato(numeroORango(0, 40)).describe('THC en %: número o rango {min, max}, entre 0 y 40.'),
  cbd: dato(numeroORango(0, 30)).describe('CBD en %: número o rango {min, max}, entre 0 y 30.'),
  floracion: dato(numeroORango(4, 20)).describe('Floración en semanas: número o rango {min, max}, entre 4 y 20.'),
  sabores: dato(lista),
  efectos: dato(lista),
  adversos: dato(lista),
  terpenos: dato(lista),
  antocianinas: dato(z.enum(NIVELES_VIOLETA)).describe('Tendencia a violeta (antocianinas). Define el color del modelo 3D.'),
  padres: dato(z.array(slug).min(1).max(6).refine((xs) => new Set(xs).size === xs.length, 'tiene elementos repetidos')),
};
export const CAMPOS = Object.keys(campos) as (keyof typeof campos)[];

/** Una variedad completa: cada elemento de data/strains.json y cada entrada de la colección. */
export const Variedad = z.strictObject({ id: slug, nombre: texto, ...z.object(campos).partial().shape });
export type Variedad = z.infer<typeof Variedad>;
export type Dato<K extends keyof typeof campos> = NonNullable<Variedad[K]>;
export type Tipo = (typeof TIPOS)[number];
export type NivelVioleta = (typeof NIVELES_VIOLETA)[number];

/** data/aportes/<slug>.json: solo los campos aportados. "nombre" solo para variedades nuevas. */
export const Aporte = z.strictObject({
  $schema: z.string().optional(),
  $comentario: z.string().optional().describe('Nota para quien revisa. No se publica.'),
  nombre: texto.optional().describe('Solo para variedades nuevas (slug que no existe).'),
  ...z.object(campos).partial().shape,
}).refine((a) => CAMPOS.some((c) => a[c]) || a.nombre, 'el aporte está vacío');
export type Aporte = z.infer<typeof Aporte>;

/** Solo licencias compatibles con publicar bajo ODbL. Nada de "todos los derechos reservados". */
export const LICENCIAS = ['ODbL-1.0', 'DbCL-1.0', 'PDDL-1.0', 'CC0-1.0', 'CC-BY-4.0', 'MIT'] as const;

/** Una fuente de datos, con su licencia. */
export const Fuente = z.strictObject({
  nombre: z.string().min(3).max(100),
  url: z.string().regex(/^https:\/\//, 'debe ser una URL que empiece con https://'),
  licencia: z.enum(LICENCIAS).describe('Solo licencias compatibles con publicar bajo ODbL. Nada de "todos los derechos reservados".'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'debe tener el formato AAAA-MM-DD').describe('Fecha de los datos (AAAA-MM-DD).'),
  copyright: z.string().max(200).optional(),
  nota: z.string().max(300).optional(),
});
export type Fuente = z.infer<typeof Fuente>;

/** data/fuentes.json: fuentes de los aportes, por clave (el validador revisa que las claves sean slugs). */
export const ArchivoFuentes = z.object({ $schema: z.string().optional(), $comentario: z.string().optional() }).catchall(Fuente);
