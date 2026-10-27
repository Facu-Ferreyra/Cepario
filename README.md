# Cepario

Atlas de variedades de cannabis.

Catálogo informativo de variedades de cannabis con visor 3D procedural (Three.js).
Cada dato muestra de qué fuente viene y con qué licencia.

## Estructura

```
index.html                  Página completa (CSS + un módulo JS inline)
data/strains.json           Datos generados (no editar a mano)
data/licencias/             Licencias de las fuentes de datos
scripts/build-strains.mjs   Convierte el CSV de Kushy en data/strains.json
```

## Probar en local

`fetch()` no funciona abriendo el archivo con doble clic (`file://`). Serví la carpeta:

```bash
npx serve .
```

## Regenerar los datos

```bash
git clone https://github.com/kushyapp/cannabis-dataset
node scripts/build-strains.mjs cannabis-dataset/Dataset/Strains/strains-kushy_api.2017-11-14.csv
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
Cada `fuente` tiene que existir en el bloque `fuentes` del JSON.

## Fuentes

- **Kushy cannabis-dataset** (MIT, 2017). THC y CBD excluidos por unidades inconsistentes;
  la columna de dolencias se descarta a propósito. Copyright (c) 2016-present, Kushy.

El modelo 3D es una representación estilizada generada a partir del tipo y una semilla por
variedad: no representa la apariencia real.

## Licencias

- **Código** (`index.html`, `scripts/`): [Apache License 2.0](LICENSE). Ver también [NOTICE](NOTICE).
- **Datos** (`data/strains.json`): [Open Database License (ODbL) 1.0](data/LICENSE);
  contenidos individuales bajo DbCL 1.0.
- **Datos de Kushy**: MIT, aviso conservado en `data/licencias/kushy-LICENSE.txt`.

Para contribuir, leé [CONTRIBUTING.md](CONTRIBUTING.md).
