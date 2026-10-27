# Cepario

Atlas de variedades de cannabis.

Catálogo informativo de variedades de cannabis con visor 3D procedural (Three.js).
Cada dato muestra de qué fuente viene y con qué licencia.

## Estructura

```
index.html                     Página completa (CSS + un módulo JS inline)
data/strains.json              Datos finales GENERADOS (no editar a mano)
data/importados/kushy.json     Kushy ya limpiado (generado desde el CSV)
data/aportes/<slug>.json       Aportes de la comunidad, uno por variedad
data/fuentes.json              Fuentes que usan los aportes
data/licencias/                Licencias de las fuentes de datos
scripts/importar-kushy.mjs     CSV de Kushy -> data/importados/kushy.json
scripts/build-strains.mjs      importados + aportes -> data/strains.json
scripts/validate.mjs           Valida aportes y fuentes (lo corre el CI)
schema/                        JSON Schema de aportes y fuentes
.github/workflows/datos.yml    CI: validación + build en cada pull request
```

## Probar en local

`fetch()` no funciona abriendo el archivo con doble clic (`file://`). Serví la carpeta:

```bash
npx serve .
```

## Regenerar los datos

```bash
npm install                      # solo la primera vez (instala el validador)
node scripts/validate.mjs
node scripts/build-strains.mjs
```

Combina `data/importados/*.json` con `data/aportes/*.json`: si un aporte trae un campo, reemplaza al
importado; un aporte para un slug inexistente crea una variedad nueva. El resultado es
determinístico, así que regenerar nunca pierde aportes.

Re-importar Kushy solo hace falta si cambia el CSV o la limpieza:

```bash
git clone https://github.com/kushyapp/cannabis-dataset
node scripts/importar-kushy.mjs cannabis-dataset/Dataset/Strains/strains-kushy_api.2017-11-14.csv
node scripts/build-strains.mjs
```

## Formato de cada variedad

```json
{
  "id": "afghan-big-bud",
  "nombre": "Afghan Big Bud",
  "tipo":    { "valor": "indica", "fuente": "kushy" },
  "sabores": { "valor": ["Limón", "Lavanda"], "fuente": "kushy" },
  "padres":  { "valor": ["afghani", "big-budda-cheese"], "fuente": "kushy" }
}
```

Campos previstos (en este orden en la ficha): `criador`, `genetica` (`{indica, sativa}` en %),
`thc` y `cbd` (número o `{min, max}` en %), `floracion` (semanas o `{min, max}`), `sabores`,
`efectos`, `adversos`, `terpenos`. Un campo ausente se muestra como "Sin datos verificados".
Cada `fuente` tiene que existir en el bloque `fuentes` del JSON (para aportes, en `data/fuentes.json`).

## Fuentes

- **Kushy cannabis-dataset** (MIT, 2017). THC y CBD excluidos por unidades inconsistentes;
  la columna de dolencias se descarta a propósito. Copyright (c) 2016-present, Kushy.

El modelo 3D es una representación estilizada generada a partir del tipo y una semilla por
variedad: no representa la apariencia real.

## Licencias

- **Código** (`index.html`, `scripts/`): [Apache License 2.0](LICENSE). Ver también [NOTICE](NOTICE).
- **Datos** (`data/`): [Open Database License (ODbL) 1.0](data/LICENSE);
  contenidos individuales bajo DbCL 1.0.
- **Datos de Kushy**: MIT, aviso conservado en `data/licencias/kushy-LICENSE.txt`.

Para contribuir, leé [CONTRIBUTING.md](CONTRIBUTING.md).
