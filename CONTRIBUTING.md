# Cómo contribuir a Cepario

Gracias por sumarte. Antes de abrir un pull request, leé estas reglas: existen para que la base
siga siendo abierta y para que nadie tenga problemas legales.

## Licencias de tus aportes

Al enviar un aporte aceptás que se publique bajo:

- **Apache License 2.0** si es código (ver `LICENSE`).
- **Open Database License (ODbL) 1.0** si son datos (ver `data/LICENSE`).

Y declarás que **tenés derecho a aportarlo**: lo escribiste vos, lo mediste vos, o viene de una
fuente cuya licencia permite publicarlo bajo ODbL.

## Reglas para datos

1. **Cada dato lleva su fuente.** Formato: `{ "valor": ..., "fuente": "<clave>" }`, y la clave tiene
   que existir en el bloque `fuentes` de `data/strains.json` con nombre, URL, licencia y fecha.
2. **No se aceptan datos copiados** de sitios con "todos los derechos reservados" (por ejemplo,
   bancos de semillas o enciclopedias comerciales), aunque el sitio sea de acceso gratuito.
3. **No se aceptan afirmaciones médicas** ("trata la depresión", "sirve para el dolor"). Cepario es
   informativo; los efectos reportados van en `efectos` y `adversos`.
4. **Unidades explícitas:** THC y CBD en %, floración en semanas. Si es un rango, `{ "min": x, "max": y }`.
5. No edites `data/strains.json` a mano para datos de Kushy: se regenera con
   `scripts/build-strains.mjs`.

## Reglas para código

- JavaScript sin paso de build: la página tiene que seguir funcionando servida como archivos estáticos.
- Probá en un ancho de 375 px y con `prefers-reduced-motion` antes de enviar.
