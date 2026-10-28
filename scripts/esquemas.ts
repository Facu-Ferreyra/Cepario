// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Genera schema/aporte.schema.json y schema/fuentes.schema.json desde el esquema Zod
// (src/lib/esquema.ts). Esos archivos solo sirven para que el editor autocomplete los aportes
// gracias a la clave "$schema": no se editan a mano. Lo corre "npm run datos".
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { Aporte, ArchivoFuentes } from '../src/lib/esquema.ts';

const DIR = join(import.meta.dirname, '..', 'schema');
const URL_BASE = 'https://facu-ferreyra.github.io/Cepario/schema/';

function escribir(archivo: string, titulo: string, descripcion: string, esquema: z.ZodType): void {
  // "input": describe lo que se escribe en el archivo (antes de validar), que es lo que le importa al editor
  const json = { $id: URL_BASE + archivo, title: titulo, description: descripcion, ...z.toJSONSchema(esquema, { io: 'input', unrepresentable: 'any' }) };
  writeFileSync(join(DIR, archivo), JSON.stringify(json, null, 2) + '\n');
}

escribir('aporte.schema.json', 'Aporte de Cepario',
  'Archivo data/aportes/<slug>.json: solo los campos aportados, cada uno con su fuente. Generado desde src/lib/esquema.ts; reglas extra en scripts/validate.mjs.',
  Aporte);
escribir('fuentes.schema.json', 'Fuentes de Cepario',
  'Archivo data/fuentes.json: cada clave es una fuente con su licencia. Generado desde src/lib/esquema.ts.',
  ArchivoFuentes);
console.log('✓ schema/*.json generados desde src/lib/esquema.ts');
