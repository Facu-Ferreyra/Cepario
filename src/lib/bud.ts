// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Generador procedural del cogollo: paleta determinística por variedad y geometría Three.js.
import * as THREE from 'three';
import type { Tipo, NivelVioleta } from './esquema.ts';

/* =========================================================
   PALETA POR VARIEDAD (determinística: misma variedad = mismo cogollo)
   ========================================================= */
export function hashStr(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed: number): () => number { // mulberry32: generador pseudoaleatorio con semilla
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
interface Forma { L: number; W: number; nodos: number; zorro: number; dens: number; luz: number; morado: number; hojas: number }
const FORMA: Record<Tipo, Forma> = {
  indica:  { L: 1.55, W: 0.62, nodos: 3, zorro: 0.12, dens: 1.0,  luz: 0.27, morado: 0.35, hojas: 18 },
  hibrida: { L: 1.9,  W: 0.54, nodos: 5, zorro: 0.26, dens: 0.88, luz: 0.33, morado: 0.15, hojas: 14 },
  sativa:  { L: 2.3,  W: 0.46, nodos: 7, zorro: 0.45, dens: 0.75, luz: 0.39, morado: 0.05, hojas: 11 },
};
/** Lo único que define el cogollo. */
export interface Semilla { id: string; tipo?: Tipo | undefined; violeta?: NivelVioleta | undefined }
// Intensidad del violeta según el nivel que calcula el build (dato > herencia > nombre). Sin nivel: verde.
const VIOLETA: Record<NivelVioleta, number> = { alta: 0.85, media: 0.55, baja: 0.25 };

export function paleta(v: Semilla) {
  const r = rngFrom(hashStr(v.id));
  const tipo = v.tipo || 'hibrida';
  const F = FORMA[tipo];
  const verde = new THREE.Color().setHSL(0.23 + r() * 0.08, 0.42 + r() * 0.18, F.luz + (r() - 0.5) * 0.06);
  // Antes el morado salía al azar. Se siguen consumiendo los mismos números del generador para que
  // forma, pistilos y tricomas de cada variedad no cambien; el color ahora sale de los datos.
  if (r() < F.morado) r();
  const morado = v.violeta ? VIOLETA[v.violeta] : 0;
  const pistiloJoven = r() < 0.15;
  const pistilo = pistiloJoven ? new THREE.Color().setHSL(0.11, 0.3, 0.82) : new THREE.Color().setHSL(0.045 + r() * 0.05, 0.72, 0.42 + r() * 0.12);
  return { r, tipo, F, verde, morado, purpura: new THREE.Color().setHSL(0.78 + r() * 0.06, 0.55, 0.28), pistilo, escarcha: 0.45 + r() * 0.5 };
}
/** Fondo CSS de la muestra de color (buscador). */
export function swatchCSS(v: Semilla): string {
  const p = paleta(v);
  const base = p.verde.clone().lerp(p.purpura, p.morado * 0.6);
  const claro = base.clone().lerp(new THREE.Color(1, 1, 1), 0.25 + p.escarcha * 0.25).getStyle();
  const oscuro = base.clone().multiplyScalar(0.55).getStyle();
  return `radial-gradient(circle at 30% 30%, rgba(255,255,255,${0.35 + p.escarcha * 0.4}) 0 1.2px, transparent 2px) 0 0/7px 7px,` +
    `radial-gradient(circle at 60% 60%, ${p.pistilo.getStyle()} 0 1.4px, transparent 2.4px) 0 0/11px 11px,` +
    `radial-gradient(circle at 38% 32%, ${claro}, ${base.getStyle()} 55%, ${oscuro})`;
}

/* =========================================================
   GENERADOR PROCEDURAL DEL COGOLLO
   Estructura: núcleo (lathe) + cálices (instanced) + hojas de azúcar + pistilos (instanced) + tricomas (instanced)
   ========================================================= */
const UP = new THREE.Vector3(0, 1, 0);
const GEO = (() => {
  const shared = <G extends THREE.BufferGeometry>(g: G): G => { g.userData['shared'] = true; return g; };
  // Cáliz: gota con la punta hacia +Y
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.42 * Math.pow(Math.sin(Math.PI * t), 0.8) * (1 - 0.55 * t) + 0.001, t - 0.15)); }
  const caliz = shared(new THREE.LatheGeometry(pts, 9));
  // Pistilo: tubito curvo de largo ~1
  const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, 0.35, 0.01), new THREE.Vector3(0.12, 0.7, 0.03), new THREE.Vector3(0.3, 0.92, 0.05)]);
  const pistilo = shared(new THREE.TubeGeometry(curva, 8, 0.035, 4));
  const tricoma = shared(new THREE.IcosahedronGeometry(1, 0));
  // Hojas de azúcar: 3 variantes de hoja dentada y curvada
  const hojas = [0.18, 0.22, 0.26].map((ancho, k) => {
    const s = new THREE.Shape(), N = 14, der: [number, number][] = [];
    for (let i = 1; i < N; i++) { const t = i / N; der.push([ancho * Math.pow(Math.sin(Math.PI * t), 0.9) * (1 - 0.3 * t) * (i % 2 ? 1 : 0.8), t]); }
    s.moveTo(0, 0);
    der.forEach(([x, y]) => s.lineTo(x, y));
    s.lineTo(0, 1);
    [...der].reverse().forEach(([x, y]) => s.lineTo(-x, y));
    s.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(s, 2);
    const p = g.attributes['position'] as THREE.BufferAttribute, uv = g.attributes['uv'] as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, (0.3 + k * 0.08) * y * y + 0.5 * Math.abs(x));
      uv.setXY(i, x / (2 * ancho) + 0.5, y);   // u cruza la hoja (nervio central en 0.5), v va de la base a la punta
    }
    g.computeVertexNormals();
    return shared(g);
  });
  const tallo = shared(new THREE.CylinderGeometry(0.6, 1, 1, 8));
  return { caliz, pistilo, tricoma, hojas, tallo };
})();

/* =========================================================
   TEXTURAS PROCEDURALES (canvas, sin archivos externos)
   Se generan una sola vez con semilla fija y las comparten todas las variedades.
   ========================================================= */
/** Ruido de valor que se repite en los bordes (para texturas que se pueden repetir). */
function ruidoRepetible(celdas: number, r: () => number): (x: number, y: number) => number {
  const v = Float32Array.from({ length: celdas * celdas }, r);
  const at = (i: number, j: number): number => v[((j % celdas + celdas) % celdas) * celdas + ((i % celdas + celdas) % celdas)]!;
  const suave = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => { // x, y en [0,1)
    const fx = x * celdas, fy = y * celdas, i = Math.floor(fx), j = Math.floor(fy), u = suave(fx - i), w = suave(fy - j);
    return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - w) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * w;
  };
}
interface ParTexturas { normal: THREE.CanvasTexture; rugosidad: THREE.CanvasTexture }
/**
 * Arma normalMap y roughnessMap a partir de un mapa de alturas.
 * @param muestra  devuelve [altura, rugosidad] para u, v ∈ [0,1)
 * @param relieve  cuánto se inclina la normal por unidad de pendiente
 */
function texturasDesdeAlturas(w: number, h: number, muestra: (u: number, v: number) => [number, number], relieve: number): ParTexturas {
  const alt = new Float32Array(w * h), rug = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [a, r] = muestra(x / w, 1 - y / h);  // la fila 0 del canvas es la parte de arriba (v = 1)
    alt[y * w + x] = a; rug[y * w + x] = r;
  }
  const lienzo = (): HTMLCanvasElement => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const cn = lienzo(), cr = lienzo();
  const xn = cn.getContext('2d')!, xr = cr.getContext('2d')!;
  const dn = xn.createImageData(w, h), dr = xr.createImageData(w, h);
  const A = (x: number, y: number): number => alt[((y + h) % h) * w + ((x + w) % w)]!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (A(x + 1, y) - A(x - 1, y)) * relieve, dy = (A(x, y - 1) - A(x, y + 1)) * relieve;
    const k = 1 / Math.hypot(dx, dy, 1), o = (y * w + x) * 4;
    dn.data[o] = (-dx * k * 0.5 + 0.5) * 255; dn.data[o + 1] = (-dy * k * 0.5 + 0.5) * 255; dn.data[o + 2] = (k * 0.5 + 0.5) * 255; dn.data[o + 3] = 255;
    dr.data.fill(Math.max(0, Math.min(255, rug[y * w + x]! * 255)), o, o + 3); dr.data[o + 3] = 255;
  }
  xn.putImageData(dn, 0, 0); xr.putImageData(dr, 0, 0);
  const tex = (c: HTMLCanvasElement): THREE.CanvasTexture => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  return { normal: tex(cn), rugosidad: tex(cr) };
}
let TEX: { hoja: ParTexturas; caliz: ParTexturas } | null = null;
function texturas(): { hoja: ParTexturas; caliz: ParTexturas } {
  if (TEX) return TEX;
  const r = rngFrom(0xc3a1);
  // Hoja de azúcar: nervio central hundido, nervaduras laterales en diagonal y grano fino
  const grano = ruidoRepetible(48, r), manchas = ruidoRepetible(8, r);
  const hoja = texturasDesdeAlturas(128, 256, (u, v) => {
    const X = (u - 0.5) * 0.44;                          // ancho real aproximado de la hoja
    const central = Math.exp(-(((u - 0.5) / 0.025) ** 2));
    const fase = (v - 1.6 * Math.abs(X)) / 0.12;        // nervaduras que suben hacia el borde
    const lateral = Math.exp(-(((fase - Math.round(fase)) / 0.09) ** 2)) * Math.min(1, Math.abs(X) * 18) * (1 - Math.abs(u - 0.5) * 1.6);
    const g = grano(u, v), m = manchas(u, v);
    return [-0.5 * central - 0.18 * lateral + 0.12 * g + 0.15 * m, 0.88 - 0.25 * central - 0.15 * lateral + 0.12 * (g - 0.5)];
  }, 9);
  // Cáliz: ruido fino que se repite (pequeños bultos de la superficie)
  const fino = ruidoRepetible(32, r), medio = ruidoRepetible(9, r);
  const caliz = texturasDesdeAlturas(128, 128, (u, v) => {
    const f = fino(u, v), m = medio(u, v);
    return [0.6 * f * f + 0.3 * m, 0.7 + 0.3 * f - 0.1 * m];
  }, 7);
  caliz.normal.repeat.set(4, 3); caliz.rugosidad.repeat.set(4, 3);
  TEX = { hoja, caliz };
  return TEX;
}

/* =========================================================
   MATERIALES CON SHADER PROPIO
   ========================================================= */
/**
 * Tricomas: material estándar + destello tipo escarcha. Cada tricoma tiene una "faceta" con
 * orientación propia (sale de su posición, así que es determinística) y brilla cuando esa faceta
 * queda a mitad de camino entre la luz y la cámara (vector medio de Blinn-Phong).
 * @param brillo  intensidad del destello (depende de la escarcha de la variedad)
 */
function materialTricomas(brillo: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xdedbcc, roughness: 0.45, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms['uBrillo'] = { value: brillo };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFaceta;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 sem = fract(sin(instanceMatrix[3].xyz * 91.7 + vec3(0.0, 1.3, 2.9)) * 43758.5453) * 2.0 - 1.0;
        vFaceta = normalize(normalMatrix * mat3(instanceMatrix) * sem);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFaceta;\nuniform float uBrillo;')
      .replace('#include <opaque_fragment>', `
        #if NUM_DIR_LIGHTS > 0
          vec3 nf = normalize(normal + vFaceta * 0.85), aCam = normalize(vViewPosition);
          for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            float d = max(dot(nf, normalize(directionalLights[i].direction + aCam)), 0.0);
            outgoingLight += directionalLights[i].color * uBrillo * (pow(d, 120.0) * 14.0 + pow(d, 16.0) * 0.4);
          }
        #endif
        #include <opaque_fragment>`);
  };
  return m;
}

/**
 * Translucidez simulada (más barata que transmission, que pide un render extra por frame):
 * suma luz cuando la fuente queda detrás de la pieza (contraluz) y un borde claro en los contornos,
 * teñidos con el color de la superficie, como la luz que atraviesa un tejido fino.
 */
function translucidez(m: THREE.MeshPhysicalMaterial, fuerza: number): void {
  m.onBeforeCompile = (sh) => {
    sh.uniforms['uTransluc'] = { value: fuerza };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTransluc;')
      .replace('#include <opaque_fragment>', `
        #if NUM_DIR_LIGHTS > 0
          vec3 aCam = normalize(vViewPosition);
          float borde = pow(1.0 - abs(dot(normal, aCam)), 3.0);
          vec3 tinte = diffuseColor.rgb * vec3(1.05, 1.15, 0.8);
          for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            vec3 Ld = directionalLights[i].direction;
            float atras = pow(max(dot(-Ld, aCam), 0.0), 2.0) * (0.5 - 0.5 * dot(normal, Ld));
            outgoingLight += directionalLights[i].color * tinte * uTransluc * (atras * 0.7 + borde * 0.25);
          }
        #endif
        #include <opaque_fragment>`);
  };
}

interface DatoCaliz { pos: THREE.Vector3; dir: THREE.Vector3; s: number; y: number }

export function construirCogollo(v: Semilla): THREE.Group {
  const p = paleta(v), r = p.r, F = p.F, T = texturas();
  const L = F.L * (0.9 + r() * 0.2), W = F.W * (0.9 + r() * 0.2);
  const radio = (y: number): number => { // perfil del cogollo según la altura y∈[0,1]
    const base = Math.pow(Math.sin(Math.PI * Math.min(1, y * 0.94 + 0.06)), 0.55) * (1 - 0.4 * y);
    const nodo = 1 - F.zorro + F.zorro * Math.pow(Math.abs(Math.sin((y * F.nodos + 0.5) * Math.PI)), 1.5);
    return W * base * nodo;
  };
  const g = new THREE.Group();
  const blanco = new THREE.Color(1, 1, 1);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), dir = new THREE.Vector3(), c = new THREE.Color();

  // Núcleo: rellena huecos entre cálices
  const perfil: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) { const y = i / 40; perfil.push(new THREE.Vector2(radio(y) * 0.7, y * L - L / 2)); }
  perfil.push(new THREE.Vector2(0.001, L / 2 + 0.02));
  const nucleo = new THREE.Mesh(new THREE.LatheGeometry(perfil, 18),
    new THREE.MeshStandardMaterial({ color: p.verde.clone().multiplyScalar(0.55), roughness: 0.9, normalMap: T.caliz.normal }));
  g.add(nucleo);

  // Tallo
  const tallo = new THREE.Mesh(GEO.tallo, new THREE.MeshStandardMaterial({ color: p.verde.clone().lerp(new THREE.Color(0x6b5a3a), 0.5), roughness: 0.85 }));
  tallo.scale.set(W * 0.12, 0.3, W * 0.12); tallo.position.y = -L / 2 - 0.1;
  g.add(tallo);

  // Cálices: filotaxis con ángulo áureo
  const N = Math.round(560 * F.dens * (L / 1.9));
  const matCaliz = new THREE.MeshPhysicalMaterial({
    roughness: 0.85, roughnessMap: T.caliz.rugosidad, normalMap: T.caliz.normal, normalScale: new THREE.Vector2(0.4, 0.4),
    sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xf1efe2).multiplyScalar(0.5 + p.escarcha * 0.5),
  });
  translucidez(matCaliz, 0.55);
  const caliz = new THREE.InstancedMesh(GEO.caliz, matCaliz, N);
  const datosCaliz: DatoCaliz[] = [];
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = (i + 0.5) / N, th = i * GOLD, rr = radio(y) * (0.78 + 0.22 * r());
    pos.set(Math.cos(th) * rr, y * L - L / 2, Math.sin(th) * rr);
    dir.set(Math.cos(th) * 0.75 + (r() - 0.5) * 0.25, 0.55 + 0.3 * y + (r() - 0.5) * 0.25, Math.sin(th) * 0.75 + (r() - 0.5) * 0.25).normalize();
    q.setFromUnitVectors(UP, dir);
    const s = W * (0.2 + 0.08 * r());
    sc.set(s, s * (1.1 + 0.4 * r()), s);
    m4.compose(pos, q, sc);
    caliz.setMatrixAt(i, m4);
    // Todo cáliz se tiñe algo de violeta (si la variedad tiene nivel); después, brillo y escarcha
    c.copy(p.verde).lerp(p.purpura, p.morado * (0.45 + 0.55 * Math.pow(r(), 1.5))).offsetHSL(0, 0, (r() - 0.5) * 0.06).lerp(blanco, p.escarcha * 0.18);
    caliz.setColorAt(i, c);
    datosCaliz.push({ pos: pos.clone(), dir: dir.clone(), s, y });
  }
  g.add(caliz);

  // Hojas de azúcar (escarchadas)
  const matHoja = new THREE.MeshPhysicalMaterial({
    color: p.verde.clone().offsetHSL(0, -0.05, 0.04).lerp(p.purpura, p.morado * 0.35).lerp(blanco, 0.2 + p.escarcha * 0.25), side: THREE.DoubleSide,
    roughness: 1, roughnessMap: T.hoja.rugosidad, normalMap: T.hoja.normal, sheen: 0.8, sheenColor: new THREE.Color(0xffffff),
  });
  translucidez(matHoja, 0.8);
  const nh = F.hojas + Math.round(r() * 5);
  const bx = new THREE.Vector3(), bz = new THREE.Vector3();
  for (let i = 0; i < nh; i++) {
    const y = 0.05 + r() * 0.85, th = r() * Math.PI * 2, rr = radio(y) * 0.8;
    const out = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    dir.copy(out).multiplyScalar(0.7).addScaledVector(UP, 0.8 + r() * 0.4).normalize();
    bz.copy(out).addScaledVector(dir, -out.dot(dir)).normalize();   // la curvatura de la hoja mira hacia afuera
    bx.crossVectors(dir, bz).normalize();
    const hoja = new THREE.Mesh(GEO.hojas[i % 3], matHoja);
    hoja.matrix.makeBasis(bx, dir, bz);
    hoja.quaternion.setFromRotationMatrix(hoja.matrix);
    hoja.rotateY((r() - 0.5) * 0.8);
    hoja.position.set(out.x * rr, y * L - L / 2, out.z * rr);
    hoja.scale.setScalar(W * (0.6 + r() * 0.5));
    g.add(hoja);
  }

  // Pistilos: salen de la punta de los cálices
  const NP = Math.round(N * 0.55);
  const pist = new THREE.InstancedMesh(GEO.pistilo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), NP);
  const roll = new THREE.Quaternion(), d2 = new THREE.Vector3();
  for (let i = 0; i < NP; i++) {
    const k = datosCaliz[Math.floor(Math.pow(r(), 0.8) * (N - 1))]!;
    pos.copy(k.pos).addScaledVector(k.dir, k.s * 0.85);
    d2.copy(k.dir).add(new THREE.Vector3(r() - 0.5, r() - 0.3, r() - 0.5).multiplyScalar(0.9)).normalize();
    q.setFromUnitVectors(UP, d2);
    roll.setFromAxisAngle(UP, r() * Math.PI * 2);
    q.multiply(roll);
    sc.setScalar(W * (0.22 + 0.14 * r()));
    m4.compose(pos, q, sc);
    pist.setMatrixAt(i, m4);
    c.copy(p.pistilo).offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.1);
    if (r() < 0.35) c.multiplyScalar(0.7);  // pistilos maduros, más oscuros
    pist.setColorAt(i, c);
  }
  g.add(pist);

  // Tricomas: puntitos brillantes sobre los cálices
  const NT = Math.round(4500 * p.escarcha);
  const tric = new THREE.InstancedMesh(GEO.tricoma, materialTricomas(0.6 + p.escarcha * 0.8), NT);
  const rnd = new THREE.Vector3();
  q.identity();
  for (let i = 0; i < NT; i++) {
    const k = datosCaliz[Math.floor(r() * N)]!;
    rnd.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    if (rnd.dot(k.dir) < 0) rnd.negate();
    pos.copy(k.pos).addScaledVector(rnd, k.s * (0.38 + r() * 0.1)).addScaledVector(k.dir, k.s * r() * 0.5);
    sc.setScalar(W * (0.006 + r() * 0.006));
    m4.compose(pos, q, sc);
    tric.setMatrixAt(i, m4);
  }
  g.add(tric);
  return g;
}
