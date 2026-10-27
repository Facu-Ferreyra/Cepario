# Cepario

Atlas de variedades de cannabis.

Catálogo informativo de variedades de cannabis con visor 3D procedural (Three.js).
Cada dato muestra de qué fuente viene y con qué licencia.

- Sitio: https://facu-ferreyra.github.io/Cepario/
- Sin frameworks ni paso de build: HTML, CSS y módulos ES nativos servidos como archivos estáticos.
- Datos en JSON estático, generados por scripts de Node a partir de fuentes abiertas y aportes.

## Probar en local

`fetch()` no funciona abriendo el archivo con doble clic (`file://`). Serví la carpeta:

```bash
npx serve .
```

Y abrí `http://localhost:3000/` (o la página de una variedad, por ejemplo `/v/afghan-big-bud/`).

## Estructura

```
index.html                     Página principal (solo HTML)
styles.css                     Estilos
js/
  main.js                      Arranque: carga del índice, filtros, navegación, URL, aviso de edad
  datos.js                     Estado compartido, utilidades y carga de fichas (data/v/<slug>.json)
  tipos.js                     Tipos del esquema de datos (JSDoc, no ejecuta nada)
  bud.js                       Generador procedural del cogollo (Three.js)
  viewer.js                    Escena 3D, cámara, interacción y transiciones
  search.js                    Buscador (combobox accesible)
  ficha.js                     Ficha de la variedad (pinta y maneja clicks)
  ficha-html.js                HTML de la ficha (lo usan el navegador y el build)

data/
  aportes/<slug>.json          ✍️  Aportes de la comunidad, uno por variedad
  fuentes.json                 ✍️  Fuentes que usan los aportes
  importados/kushy.json        ⚙️  Kushy ya limpiado (desde el CSV, con importar-kushy.mjs)
  indice.json                  ⚙️  Resumen de todas las variedades: lo que carga el sitio
  v/<slug>.json                ⚙️  Ficha completa de cada variedad
  strains.json                 ⚙️  Dataset completo (para descargar)
  licencias/                   Licencias de las fuentes de datos
  LICENSE                      ODbL 1.0

v/<slug>/index.html            ⚙️  Página estática por variedad (SEO, legible sin JS)
sitemap.xml                    ⚙️  Mapa del sitio para buscadores

schema/                        JSON Schema de aportes y de fuentes
scripts/
  build-strains.mjs            Combina importados + aportes y genera todo lo marcado con ⚙️
  validate.mjs                 Valida aportes y fuentes (lo corre el CI)
  importar-kushy.mjs           CSV de Kushy -> data/importados/kushy.json
  lib/                         Código compartido por los scripts
.github/workflows/datos.yml    CI: licencias, validación y build en cada pull request
```

✍️ = se edita a mano · ⚙️ = generado, **no editar** (se pisa al regenerar).

## Contribuir

El camino corto para sumar o corregir datos (el detalle está en [CONTRIBUTING.md](CONTRIBUTING.md)):

1. Si tu fuente es nueva, declarala en `data/fuentes.json` (nombre, URL, licencia abierta y fecha).
2. Creá `data/aportes/<slug>.json` solo con los campos que aportás, cada uno con su fuente.
   El slug es el de la URL de la variedad. Hay un ejemplo en `data/aportes/_afghan-big-bud.json`.
3. Validá y regenerá:

   ```bash
   npm install                    # solo la primera vez (instala el validador)
   node scripts/validate.mjs
   node scripts/build-strains.mjs
   ```

4. Abrí un pull request con tu aporte y los archivos generados. El CI repite estos pasos y falla
   si algo no valida o si los archivos generados no están al día.

No se aceptan datos de sitios con "todos los derechos reservados" ni afirmaciones médicas.

## Cómo se generan los datos

`node scripts/build-strains.mjs` combina `data/importados/*.json` con `data/aportes/*.json`. Si un
aporte trae un campo, reemplaza al importado; un aporte para un slug inexistente crea una variedad
nueva. El resultado es determinístico: regenerar nunca pierde aportes y correrlo dos veces da lo mismo.

Además genera las páginas `v/<slug>/index.html` (título, descripción y ficha en HTML; el visor 3D
se carga encima) y `sitemap.xml`. La URL pública del sitio está en `scripts/lib/datos.mjs`
(`URL_SITIO`). Los enlaces viejos `index.html#slug` siguen funcionando: muestran la variedad y la
URL pasa a ser `v/<slug>/`.

Re-importar Kushy solo hace falta si cambia el CSV o la forma de limpiarlo:

```bash
git clone https://github.com/kushyapp/cannabis-dataset
node scripts/importar-kushy.mjs cannabis-dataset/Dataset/Strains/strains-kushy_api.2017-11-14.csv
node scripts/build-strains.mjs
```

## Cómo carga los datos el sitio

1. Al abrir, solo se descarga `data/indice.json`: id, nombre, tipo y criador de cada variedad, más
   `datos` (1 = tiene algún dato, 2 = tiene sabores y efectos) y `padres`. Con eso funcionan el
   buscador, los filtros, el contador, la variedad del día y el modelo 3D.
2. La ficha completa (`data/v/<slug>.json`) se pide al mostrar la variedad. Las vecinas (anterior y
   siguiente) se precargan, así que pasar de una a otra no espera a la red.

## Formato de los datos

Cada dato lleva su fuente: `{ "valor": ..., "fuente": "<clave>" }`, y la clave tiene que existir en
el bloque `fuentes`. Ejemplo ilustrativo de una variedad completa (`data/v/<slug>.json`):

```json
{
  "id": "afghan-big-bud",
  "nombre": "Afghan Big Bud",
  "tipo":    { "valor": "indica", "fuente": "kushy" },
  "thc":     { "valor": { "min": 14, "max": 18 }, "fuente": "mi-medicion-2026" },
  "sabores": { "valor": ["Limón", "Lavanda"], "fuente": "kushy" },
  "padres":  { "valor": ["afghani", "big-budda-cheese"], "fuente": "kushy" }
}
```

| Campo | Valor | Unidad y rango |
|---|---|---|
| `criador` | texto | |
| `tipo` | `hibrida`, `indica` o `sativa` | |
| `genetica` | `{ "indica": 80, "sativa": 20 }` | %, suma 100 |
| `thc` | número o `{ "min", "max" }` | %, de 0 a 40 |
| `cbd` | número o `{ "min", "max" }` | %, de 0 a 30 |
| `floracion` | número o `{ "min", "max" }` | semanas, de 4 a 20 |
| `sabores`, `efectos`, `adversos`, `terpenos` | lista de textos | |
| `padres` | lista de slugs | |

La ficha muestra los campos en este orden; uno ausente aparece como "Sin datos verificados".
Los tipos completos (`Variedad`, `Resumen`, `Fuente`, `Aporte`…) están documentados con JSDoc en
`js/tipos.js`; con el `jsconfig.json` del repo, VS Code los muestra al pasar el mouse.

## Fuentes

- **Kushy cannabis-dataset** (MIT, 2017). THC y CBD excluidos por unidades inconsistentes;
  la columna de dolencias se descarta a propósito. Copyright (c) 2016-present, Kushy.

El modelo 3D es una representación estilizada generada a partir del tipo y una semilla por
variedad: no representa la apariencia real.

## Licencias

- **Código** (`index.html`, `styles.css`, `js/`, `scripts/`): [Apache License 2.0](LICENSE). Ver también [NOTICE](NOTICE).
- **Datos** (`data/`): [Open Database License (ODbL) 1.0](data/LICENSE);
  contenidos individuales bajo DbCL 1.0.
- **Datos de Kushy**: MIT, aviso conservado en `data/licencias/kushy-LICENSE.txt`.
