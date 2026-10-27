# Cómo contribuir a Cepario

Gracias por sumarte. Antes de abrir un pull request, leé estas reglas: existen para que la base
siga siendo abierta y para que nadie tenga problemas legales.

## Licencias de tus aportes

Al enviar un aporte aceptás que se publique bajo:

- **Apache License 2.0** si es código (ver `LICENSE`).
- **Open Database License (ODbL) 1.0** si son datos (ver `data/LICENSE`).

Y declarás que **tenés derecho a aportarlo**: lo escribiste vos, lo mediste vos, o viene de una
fuente cuya licencia permite publicarlo bajo ODbL.

## Cómo aportar datos

No edites `data/strains.json`: es un archivo generado y se pisa al regenerar. Los aportes van aparte:

1. **Declarar la fuente** (si es nueva) en `data/fuentes.json`, con nombre, URL, licencia y fecha:

   ```json
   "mi-medicion-2026": {
     "nombre": "Medición propia de @usuario",
     "url": "https://github.com/usuario",
     "licencia": "ODbL-1.0",
     "fecha": "2026-10-27"
   }
   ```

2. **Crear `data/aportes/<slug>.json`** con solo los campos que aportás. El `<slug>` es el que aparece
   en la URL de la variedad (por ejemplo `afghan-big-bud`). Si un campo ya existe en Kushy, el tuyo
   lo reemplaza; los que no mandes se mantienen.

   ```json
   {
     "thc": { "valor": { "min": 14, "max": 18 }, "fuente": "mi-medicion-2026" },
     "floracion": { "valor": 9, "fuente": "mi-medicion-2026" }
   }
   ```

   Para una **variedad nueva**, usá un slug que no exista y agregá `"nombre": "Nombre de la variedad"`.
   Hay un ejemplo completo en `data/aportes/_afghan-big-bud.json` (los archivos que empiezan con `_`
   son ejemplos: se validan pero no se publican).

3. **Validar y regenerar** (la primera vez, `npm install` para instalar el validador):

   ```bash
   node scripts/validate.mjs
   node scripts/build-strains.mjs
   ```

   Incluí los archivos generados en el PR. El CI corre lo mismo en cada pull request y falla si un
   aporte no pasa la validación o si los archivos generados no están al día.

### Qué revisa la validación

- Forma de cada campo según `schema/aporte.schema.json` y `schema/fuentes.schema.json`
  (tu editor puede usarlos para autocompletar gracias a la clave `"$schema"`).
- Rangos: THC entre 0 y 40 %, CBD entre 0 y 30 %, floración entre 4 y 20 semanas, `min ≤ max`.
- Genética: `indica + sativa` tiene que sumar 100.
- Fuente: tiene que existir y su licencia tiene que ser abierta (ODbL, DbCL, PDDL, CC0, CC-BY 4.0 o MIT).
- Padres: tienen que ser slugs existentes.
- Afirmaciones médicas: se rechazan textos como "alivia el dolor" o "ayuda con el insomnio".
  En `adversos` sí se aceptan síntomas ("Dolor de cabeza") porque describen un efecto no deseado.

## Reglas para datos

1. **Cada dato lleva su fuente.** Formato: `{ "valor": ..., "fuente": "<clave>" }`, y la clave tiene
   que existir en `data/fuentes.json` (o ser `kushy`) con nombre, URL, licencia y fecha.
2. **No se aceptan datos copiados** de sitios con "todos los derechos reservados" (por ejemplo,
   bancos de semillas o enciclopedias comerciales), aunque el sitio sea de acceso gratuito.
3. **No se aceptan afirmaciones médicas** ("trata la depresión", "sirve para el dolor"). Cepario es
   informativo; los efectos reportados van en `efectos` y `adversos`.
4. **Unidades explícitas:** THC y CBD en %, floración en semanas. Si es un rango, `{ "min": x, "max": y }`.
5. Para corregir un dato de Kushy, mandá un aporte con el campo corregido y su fuente: no edites
   `data/importados/kushy.json`, que se regenera desde el CSV con `scripts/importar-kushy.mjs`.

## Reglas para código

- JavaScript sin paso de build: la página tiene que seguir funcionando servida como archivos estáticos.
- Cada archivo de código (`.js`, `.mjs`, `.css`, `.yml`, `index.html`) empieza con el aviso de licencia
  (el CI lo comprueba). En JavaScript:

  ```js
  // Copyright 2026 Facundo Agustín Ferreyra
  // SPDX-License-Identifier: Apache-2.0
  ```

  Si el archivo es tuyo, podés sumar tu nombre en otra línea `Copyright`.
- Probá en un ancho de 375 px y con `prefers-reduced-motion` antes de enviar.
