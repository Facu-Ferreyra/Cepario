# Cepario

Atlas de variedades de cannabis.

Catálogo informativo de variedades de cannabis con visor 3D procedural (Three.js).
Cada dato muestra de qué fuente viene y con qué licencia.

- Sitio: https://facu-ferreyra.github.io/Cepario/
- Hecho con [Astro](https://astro.build) 7 y TypeScript estricto: cada variedad es una página HTML
  estática (legible sin JavaScript) y lo interactivo se carga como islas (el visor 3D y el buscador).
- Datos en JSON, combinados por scripts de Node a partir de fuentes abiertas y aportes.

## Correrlo en local

Hace falta **Node 22.23 o más nuevo** (el CI usa Node 24).

```bash
npm install        # la primera vez
npm run dev        # servidor de desarrollo en http://localhost:4321/Cepario/
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run build` | Genera los datos, revisa los tipos (`astro check`) y construye el sitio en `dist/` |
| `npm run preview` | Sirve `dist/` tal como quedaría publicado |
| `npm run check` | Solo revisa los tipos |
| `npm run validar` | Valida los aportes y las fuentes |
| `npm run datos` | Regenera `data/strains.json`, `public/data/indice.json` y `schema/*.json` |

El build genera unas 9.500 páginas en menos de un minuto.

## Estructura

```
src/
  content.config.ts            Colecciones "variedades" y "fuentes" (leen data/strains.json)
  lib/
    esquema.ts                 Forma de los datos (Zod): ÚNICO lugar donde se define
    datos.ts                   Textos y utilidades compartidas (build, páginas y navegador)
    catalogo.ts                Orden, vecinas, padres e hijos, contadores, variedad del día
    violeta.ts                 Color del modelo según datos, linaje o nombre
    bud.ts                     Generador procedural del cogollo (Three.js)
    viewer.ts                  Escena 3D, cámara, interacción y transiciones
    navegacion.ts              Filtros, contador y variedad al azar
  components/
    PaginaVariedad.astro       La lámina completa: barra lateral, ejemplar y etiqueta
    Ficha.astro                La etiqueta de herbario (HTML estático)
    Visor.astro                Isla del visor 3D (canvas con transition:persist)
    Buscador.tsx               Isla de React del buscador (combobox accesible)
  layouts/Lamina.astro         <head>, íconos, tema, aviso +18 y ClientRouter
  pages/
    index.astro                Portada: la variedad del día
    v/[slug].astro             Una página por variedad (getStaticPaths)
    404.astro                  Página para direcciones que no existen
  styles/
    tokens.css                 Colores, tipografías y modo oscuro
    lamina.css                 El resto de los estilos

data/
  aportes/<slug>.json          ✍️  Aportes de la comunidad, uno por variedad
  fuentes.json                 ✍️  Fuentes que usan los aportes
  importados/kushy.json        ⚙️  Kushy ya limpiado (desde el CSV, con importar-kushy.mjs)
  strains.json                 ⚙️  Dataset completo: lo lee la colección y se puede descargar
  licencias/                   Licencias de las fuentes de datos
  LICENSE                      ODbL 1.0
public/data/indice.json        ⚙️  Resumen liviano de todas las variedades (para el buscador)
schema/*.json                  ⚙️  JSON Schema para el editor, generado desde src/lib/esquema.ts

scripts/
  build-strains.mjs            Combina importados + aportes y genera lo marcado con ⚙️
  validate.mjs                 Valida aportes y fuentes con el esquema de src/lib/esquema.ts
  esquemas.ts                  Genera schema/*.json desde el esquema Zod
  importar-kushy.mjs           CSV de Kushy -> data/importados/kushy.json
  lib/datos.mjs                Rutas y utilidades de los scripts

.github/workflows/
  datos.yml                    CI: licencias, validación y datos al día en cada pull request
  desplegar.yml                Construye y publica en GitHub Pages (en cada push a main y a diario)
```

✍️ = se edita a mano · ⚙️ = generado, **no editar** (se pisa al regenerar).

## Cómo funciona

- **Páginas.** `src/pages/v/[slug].astro` usa `getStaticPaths()` para generar `/v/<slug>/` por cada
  variedad de la colección, con su título, descripción y URL canónica. El linaje y anterior/siguiente
  son enlaces reales; la página se lee completa sin JavaScript.
- **Visor 3D.** Es una isla sin framework. Con `<ClientRouter />` (view transitions) la navegación
  entre variedades no recarga la página, y el `<canvas>` lleva `transition:persist`: la escena no se
  recrea y el modelo cambia con su animación. Anterior y siguiente se precargan apenas se ven.
- **Buscador.** Isla de React (`client:idle`) que descarga `public/data/indice.json` al primer uso.
- **Variedad del día.** Se elige al construir el sitio; por eso `desplegar.yml` reconstruye todos
  los días a las 03:00 UTC.
- **Enlaces viejos.** `/Cepario/#slug` redirige a `/Cepario/v/slug/`.

## Contribuir

El camino corto para sumar o corregir datos (el detalle está en [CONTRIBUTING.md](CONTRIBUTING.md)):

1. Si tu fuente es nueva, declarala en `data/fuentes.json` (nombre, URL, licencia abierta y fecha).
2. Creá `data/aportes/<slug>.json` solo con los campos que aportás, cada uno con su fuente.
   El slug es el de la URL de la variedad. Hay un ejemplo en `data/aportes/_afghan-big-bud.json`.
3. Validá y regenerá:

   ```bash
   npm run validar
   npm run datos
   ```

4. Abrí un pull request con tu aporte y los archivos generados. El CI repite estos pasos y falla
   si algo no valida o si los archivos generados no están al día. Si un dato llegara a pasar con
   una forma inválida, el build del sitio también se detiene y dice qué variedad y qué campo fallan.

No se aceptan datos de sitios con "todos los derechos reservados" ni afirmaciones médicas.

## Cómo se generan los datos

`npm run datos` combina `data/importados/*.json` con `data/aportes/*.json`. Si un aporte trae un
campo, reemplaza al importado; un aporte para un slug inexistente crea una variedad nueva. El
resultado es determinístico: regenerar nunca pierde aportes y correrlo dos veces da lo mismo.

Re-importar Kushy solo hace falta si cambia el CSV o la forma de limpiarlo:

```bash
git clone https://github.com/kushyapp/cannabis-dataset
node scripts/importar-kushy.mjs cannabis-dataset/Dataset/Strains/strains-kushy_api.2017-11-14.csv
npm run datos
```

## Formato de los datos

Cada dato lleva su fuente: `{ "valor": ..., "fuente": "<clave>" }`, y la clave tiene que existir en
`data/fuentes.json` o en los datos importados. Ejemplo ilustrativo de una variedad:

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
| `antocianinas` | `alta`, `media` o `baja` | tendencia a violeta |
| `padres` | lista de slugs | |

La ficha muestra los campos en este orden; los ausentes se juntan en una línea "Sin determinar".
La definición exacta (y los tipos de TypeScript que salen de ella) está en `src/lib/esquema.ts`.

**Color del modelo 3D.** No hay azar: el violeta sale de `antocianinas` (si hay dato). Si no hay
dato, se hereda de los padres: si alguno es violeta alto o medio, la hija es media. Si tampoco, se
usa una pista en el nombre ("purple", "grape", "GDP"…, sin contar "grapefruit"), que solo pinta el
modelo y no aparece en la ficha. Si nada aplica, el cogollo es verde. Lo calcula `src/lib/violeta.ts`.

## Fuentes

- **Kushy cannabis-dataset** (MIT, 2017). THC y CBD excluidos por unidades inconsistentes;
  la columna de dolencias se descarta a propósito. Copyright (c) 2016-present, Kushy.

El modelo 3D es una representación estilizada generada a partir del tipo y una semilla por
variedad: no representa la apariencia real.

En computadoras el visor suma oclusión ambiental y profundidad de campo. En pantallas táctiles,
con "reducir movimiento" o si el visor baja de 50 FPS, se dibuja sin esos efectos. Para probar:
`?fps` muestra un contador de FPS y `?post=1` / `?post=0` fuerza los efectos (sin apagado automático).

## Licencias

- **Código** (`src/`, `scripts/`, configuración): [Apache License 2.0](LICENSE). Ver también [NOTICE](NOTICE).
- **Datos** (`data/`, `public/data/`): [Open Database License (ODbL) 1.0](data/LICENSE);
  contenidos individuales bajo DbCL 1.0.
- **Datos de Kushy**: MIT, aviso conservado en `data/licencias/kushy-LICENSE.txt`.
