// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Visor 3D: escena Three.js, encuadre, interacción (puntero, teclado, botones), transición entre variedades y loop.
// El canvas persiste entre páginas (transition:persist), así que la escena, el modelo y el loop
// viven todo el recorrido. Lo que cambia con cada página son los elementos de alrededor (el visor,
// los botones, la ficha): conectar() los vuelve a buscar y les engancha los eventos.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import type { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import type { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { construirCogollo, hashStr, type Semilla } from './bud.ts';

/* =========================================================
   ESCENA THREE.JS
   ========================================================= */
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
// Elementos de la página actual (los reemplaza conectar() en cada navegación)
let hero: HTMLElement, stage: HTMLElement, ground: HTMLElement, hint: HTMLElement;
let btnZin: HTMLElement, btnZout: HTMLElement, btnExpand: HTMLElement, btnLight: HTMLElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TACTIL = matchMedia('(hover: none) and (pointer: coarse)').matches;   // celulares y tablets
const PARAMS = new URLSearchParams(location.search);                       // ?fps muestra un contador; ?post=0|1 fuerza el postprocesado
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const clampZoom = (z: number): number => Math.min(3.4, Math.max(0.55, z));

const renderer = new THREE.WebGLRenderer({ canvas: $<HTMLCanvasElement>('gl'), alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.95;

const FOV = 26, TAN = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 200);
camera.position.set(0, 0, 6);
const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.6); keyLight.position.set(2.5, 4, 5);
const rimLight = new THREE.DirectionalLight(0xbfd8ff, 0.5); rimLight.position.set(-4, 2, -3);
scene.add(keyLight, rimLight);
const LIGHTS = {
  day:  { env: 0.95, key: 1.6, keyColor: new THREE.Color(0xfff4e2), rim: 0.5, exp: 1.05 },
  dusk: { env: 0.28, key: 2.6, keyColor: new THREE.Color(0xffc98a), rim: 1.9, exp: 1.0 },
};
// Vista inicial: cogollo erguido, levemente inclinado hacia la cámara
const HOME = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, 0.6, 0, 'YXZ'));
const AX_X = new THREE.Vector3(1, 0, 0), AX_Y = new THREE.Vector3(0, 1, 0);
const qTmp = new THREE.Quaternion();

/* ---------- Rig: pivot (deslizar/escalar/balanceo) > spin (rotación del usuario) > holder (normaliza) ---------- */
interface Rig { slug: string; pivot: THREE.Group; spin: THREE.Group; seed: number }
function crearRig(v: Semilla): Rig {
  const pivot = new THREE.Group(), spin = new THREE.Group(), holder = new THREE.Group();
  pivot.add(spin); spin.add(holder);
  spin.quaternion.copy(HOME);
  const modelo = construirCogollo(v);
  modelo.updateMatrixWorld(true);
  const esfera = new THREE.Box3().setFromObject(modelo).getBoundingSphere(new THREE.Sphere());
  modelo.position.sub(esfera.center);
  holder.scale.setScalar(1 / (esfera.radius || 1));
  modelo.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.frustumCulled = false; });
  holder.add(modelo);
  pivot.visible = false;
  scene.add(pivot);
  return { slug: v.id, pivot, spin, seed: hashStr(v.id) % 7 };
}
function liberarRig(rig: Rig | null): void {
  if (!rig) return;
  scene.remove(rig.pivot);
  rig.pivot.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    if (!m.geometry.userData['shared']) m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  });
}

/* =========================================================
   POSTPROCESADO: oclusión ambiental (GTAO) + profundidad de campo suave
   Se apaga en pantallas táctiles y con "reducir movimiento", y se apaga solo si el visor baja de 50 FPS.
   Los módulos se piden recién cuando hacen falta: en celulares ni se descargan.
   ========================================================= */
// Profundidad de campo propia: BokehPass de Three.js fuerza alfa = 1 y taparía la página detrás del canvas.
// Cada píxel junta vecinos en espiral; un vecino aporta si su propio desenfoque alcanza a este píxel.
// Autofoco: la distancia de foco es la de la superficie que queda en el centro del visor.
const DOF = {
  uniforms: {
    tDiffuse: { value: null }, tProf: { value: null }, cameraNear: { value: 0.01 }, cameraFar: { value: 200 },
    focoUv: { value: new THREE.Vector2(0.5, 0.5) }, focoRespaldo: { value: 6 }, escala: { value: 1 }, maxCoc: { value: 4 },
    resolucion: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    #include <packing>
    #define MUESTRAS 16
    uniform sampler2D tDiffuse, tProf;
    uniform float cameraNear, cameraFar, focoRespaldo, escala, maxCoc;
    uniform vec2 resolucion, focoUv;
    varying vec2 vUv;
    float foco;
    float distancia(vec2 uv) { float d = texture2D(tProf, uv).x; return d >= 1.0 ? -1.0 : -perspectiveDepthToViewZ(d, cameraNear, cameraFar); }  // -1 = fondo vacío
    float coc(float z) { return z < 0.0 ? 0.0 : min(maxCoc, abs(z - foco) * escala); }  // radio de desenfoque en píxeles
    void main() {
      // autofoco: promedio de 5 puntos alrededor del centro del visor (ignora el fondo vacío)
      float sz = 0.0, nz = 0.0;
      for (int i = 0; i < 5; i++) {
        vec2 o = i == 0 ? vec2(0.0) : vec2(cos(float(i) * 1.5708), sin(float(i) * 1.5708)) * 0.025;
        float z = distancia(focoUv + o);
        if (z > 0.0) { sz += z; nz += 1.0; }
      }
      foco = nz > 0.0 ? sz / nz : focoRespaldo;
      float zc = distancia(vUv), cc = coc(zc);
      vec4 suma = texture2D(tDiffuse, vUv);
      float peso = 1.0;
      // giro distinto por píxel (ruido de gradiente intercalado): cambia el patrón repetido por un grano fino
      float giro = 6.2832 * fract(52.9829 * fract(dot(gl_FragCoord.xy, vec2(0.06711, 0.00584))));
      for (int i = 0; i < MUESTRAS; i++) {
        float r = sqrt((float(i) + 0.5) / float(MUESTRAS)) * maxCoc, a = float(i) * 2.39996 + giro;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r / resolucion;
        float zs = distancia(uv), cs = coc(zs);
        float alcance = (zs < 0.0 || (zc > 0.0 && zs > zc + 0.02)) ? min(cs, cc) : cs;  // lo de atrás no tapa lo de adelante
        float w = clamp(alcance - r + 1.0, 0.0, 1.0);
        suma += texture2D(tDiffuse, uv) * w; peso += w;
      }
      gl_FragColor = suma / peso;  // el canvas usa alfa premultiplicado: promediar rgba junto respeta los bordes
    }`,
};
let post: { composer: EffectComposer; gtao: GTAOPass; dof: ShaderPass; desde: number } | null = null;
const quierePost = PARAMS.has('post') ? PARAMS.get('post') === '1' : !RM && !TACTIL;
async function activarPost(): Promise<void> {
  // Rutas fijas (no armadas con variables) para que el bundler las encuentre y las separe en otro archivo
  const [{ EffectComposer }, { RenderPass }, { GTAOPass }, { ShaderPass }, { OutputPass }] = await Promise.all([
    import('three/addons/postprocessing/EffectComposer.js'), import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/GTAOPass.js'), import('three/addons/postprocessing/ShaderPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
  ]);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  const tamGtao = gtao.setSize.bind(gtao);
  gtao.setSize = (w: number, h: number) => tamGtao(Math.ceil(w / 2), Math.ceil(h / 2));   // a media resolución: cuesta la mitad y el AO es suave igual
  gtao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  composer.addPass(gtao);
  const dof = new ShaderPass(DOF);
  dof.uniforms['tProf']!.value = gtao.depthTexture;
  composer.addPass(dof);
  // Tone mapping y sRGB como hace el renderer sin postprocesado. Los colores llegan premultiplicados por alfa:
  // se separan antes de la curva sRGB y se vuelven a multiplicar después (si no, los bordes salen con un halo claro).
  const salida = new OutputPass();
  salida.material.fragmentShader = salida.material.fragmentShader
    .replace('gl_FragColor = texture2D( tDiffuse, vUv );', '$& gl_FragColor.rgb /= max( gl_FragColor.a, 1e-4 );')
    .replace(/}\s*$/, 'gl_FragColor.rgb *= gl_FragColor.a; }');
  composer.addPass(salida);
  post = { composer, gtao, dof, desde: performance.now() };
  medir();
}
function desactivarPost(): void {
  if (!post) return;
  post.composer.dispose(); post.gtao.dispose();
  post = null;
  console.info('Cepario: postprocesado desactivado para mantener la fluidez.');
}
function actualizarDof(): void {
  const u = post!.dof.uniforms, pr = renderer.getPixelRatio();
  u['focoUv']!.value.set(Fr.cx / Fr.W, 1 - Fr.cy / Fr.H);   // centro del visor en coordenadas de textura
  u['focoRespaldo']!.value = camera.position.z;             // si el centro cae en el fondo: el centro del cogollo
  u['escala']!.value = 3 * Math.pow(zoom, 1.4) * pr;       // más cerca = menos profundidad de campo, como en macro
  u['maxCoc']!.value = Math.min(6, 1 + 1.6 * zoom) * pr;
  u['cameraNear']!.value = camera.near; u['cameraFar']!.value = camera.far;
}

/* ---------- Medidor de FPS: apaga el postprocesado si no llega a 50 y alimenta el contador de ?fps ---------- */
const hud = PARAMS.has('fps') ? Object.assign(document.createElement('div'), { ariaHidden: 'true' }) : null;
if (hud) hud.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99;padding:4px 8px;border-radius:6px;background:#000a;color:#fff;font:12px/1.3 monospace;pointer-events:none';
const fps = { t0: 0, n: 0, lentos: 0 };
function contarFrame(now: number): void {
  if (!fps.t0) { fps.t0 = now; return; }
  fps.n++;
  const dur = now - fps.t0;
  if (dur < 1000) return;
  const valor = fps.n * 1000 / dur;
  fps.t0 = now; fps.n = 0;
  if (hud) hud.textContent = `${valor.toFixed(0)} FPS, ${post ? 'con' : 'sin'} postprocesado`;
  if (dur > 1500 || !post || PARAMS.has('post') || now - post.desde < 3000) return;   // pestaña en pausa o recién activado: no cuenta
  fps.lentos = valor < 47.5 ? fps.lentos + 1 : 0;   // margen para monitores de 50 Hz
  if (fps.lentos >= 3) desactivarPost();
}

/* =========================================================
   ENCUADRE
   ========================================================= */
const Fr = { W: 1, H: 1, st: { x: 0, y: 0, w: 1, h: 1 }, cx: 0, cy: 0, px: 300, init: false };
function medir(): void {
  const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  Fr.W = Math.max(1, hr.width); Fr.H = Math.max(1, hr.height);
  Fr.st = { x: sr.left - hr.left, y: sr.top - hr.top, w: Math.max(1, sr.width), h: Math.max(1, sr.height) };
  renderer.setSize(Fr.W, Fr.H, false);
  if (post) {
    post.composer.setPixelRatio(renderer.getPixelRatio());
    post.composer.setSize(Fr.W, Fr.H);
    post.dof.uniforms['resolucion']!.value.set(Fr.W, Fr.H).multiplyScalar(renderer.getPixelRatio());
  }
}
const observador = new ResizeObserver(medir);

/* =========================================================
   INTERACCIÓN
   ========================================================= */
let zoom = 1, tzoom = 1, focusMode = false, dusk = false;
let dragging = false, homing = false, turnQueue = 0;
const vel = { x: 0, y: 0 };
let lastMoveT = 0, lastInteract = performance.now(), idleRaw = 0, hinted = false;
let rigActual: Rig | null = null, closeupBtn: HTMLElement | null = null;
let sw: { from: Rig | null; to: Rig; dir: number; t0: number } | null = null;

function interact(): void { lastInteract = performance.now(); if (!hinted) { hinted = true; hint.classList.add('gone'); } }
const setZoom = (z: number): void => { tzoom = clampZoom(z); };
function rotate(yaw: number, pitch: number): void {
  if (!rigActual) return;
  const q = rigActual.spin.quaternion;
  if (yaw) q.premultiply(qTmp.setFromAxisAngle(AX_Y, yaw));
  if (pitch) q.premultiply(qTmp.setFromAxisAngle(AX_X, pitch));
}
function goHome(): void { homing = true; vel.x = vel.y = 0; turnQueue = 0; setZoom(1); }
const dragK = (): number => Math.PI / Math.max(260, Fr.px * 1.6);

const pts = new Map<number, { x: number; y: number }>(); let pinchD = 0;
const pinchDist = (): number => { const [a, b] = [...pts.values()]; return Math.hypot(a!.x - b!.x, a!.y - b!.y); };
const enControles = (e: Event): boolean => !!(e.target as Element).closest('.rail, .turn');
function endPointer(e: PointerEvent): void {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size < 2) pinchD = 0;
  if (pts.size === 1) { dragging = true; vel.x = vel.y = 0; lastMoveT = performance.now(); }
  if (pts.size === 0) { dragging = false; stage.classList.remove('dragging'); if (performance.now() - lastMoveT > 80) vel.x = vel.y = 0; }
}

// Tema: "papel" (claro) o "frasco" (oscuro). Sin elección guardada, sigue al sistema.
// El <head> ya aplicó la elección guardada antes de pintar, para que no haya un destello claro.
const html = document.documentElement, SISTEMA_OSCURO = matchMedia('(prefers-color-scheme: dark)');
dusk = html.dataset['tema'] ? html.dataset['tema'] === 'frasco' : SISTEMA_OSCURO.matches;
SISTEMA_OSCURO.addEventListener('change', (e) => { if (!html.dataset['tema']) dusk = e.matches; });
function setFocus(on: boolean): void { focusMode = on; hero.classList.toggle('focus', on); }

/**
 * Engancha el visor a los elementos de la página actual. Corre en la primera carga y después de
 * cada navegación: la página nueva trae su propio #stage, sus botones y su ficha.
 */
function conectar(): void {
  hero = $('hero'); stage = $('stage'); ground = $('ground'); hint = $('hint');
  btnZin = $('zin'); btnZout = $('zout'); btnExpand = $('expand'); btnLight = $('light');
  observador.disconnect(); observador.observe(hero); observador.observe(stage);
  medir();
  // El estado del visor sigue igual: se refleja en los elementos nuevos
  if (hinted) hint.classList.add('gone');
  if (sw) ground.classList.add('switching');
  setFocus(focusMode);
  for (const k of Object.keys(prev)) delete prev[k];   // el loop vuelve a sincronizar los aria-pressed
  if (hud && !hud.isConnected) document.body.append(hud);
  $('loader').classList.remove('show');

  stage.addEventListener('pointerdown', (e) => {
    if (enControles(e)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    interact(); homing = false;
    if (pts.size === 1) { dragging = true; vel.x = vel.y = 0; lastMoveT = performance.now(); stage.classList.add('dragging'); }
    else if (pts.size === 2) { dragging = false; pinchD = pinchDist(); }
  });
  stage.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    interact();
    if (pts.size >= 2) { const d = pinchDist(); if (pinchD > 0) setZoom(tzoom * d / pinchD); pinchD = d; }
    else if (dragging) {
      const k = dragK();
      rotate(dx * k, dy * k);
      const now = performance.now(), dts = Math.max(8, now - lastMoveT) / 1000;
      lastMoveT = now;
      vel.y = THREE.MathUtils.clamp(vel.y * 0.5 + (dx * k / dts) * 0.5, -14, 14);
      vel.x = THREE.MathUtils.clamp(vel.x * 0.5 + (dy * k / dts) * 0.5, -14, 14);
    }
  });
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault(); interact();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    setZoom(tzoom * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
  }, { passive: false });
  stage.addEventListener('dblclick', (e) => { if (enControles(e)) return; interact(); goHome(); });
  stage.addEventListener('keydown', (e) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => rotate(-0.18, 0), ArrowRight: () => rotate(0.18, 0), ArrowUp: () => rotate(0, -0.18), ArrowDown: () => rotate(0, 0.18),
      '+': () => setZoom(tzoom * 1.2), '=': () => setZoom(tzoom * 1.2), '-': () => setZoom(tzoom / 1.2), '_': () => setZoom(tzoom / 1.2), '0': goHome,
    };
    const fn = map[e.key];
    if (!fn) return;
    e.preventDefault(); interact();
    if (e.key !== '0') homing = false;
    fn();
  });
  btnZin.addEventListener('click', () => { interact(); homing = false; setZoom(tzoom * 1.35); });
  btnZout.addEventListener('click', () => { interact(); homing = false; setZoom(tzoom / 1.35); });
  btnExpand.addEventListener('click', () => { interact(); setFocus(!focusMode); });
  btnLight.addEventListener('click', () => {
    interact(); dusk = !dusk;
    html.dataset['tema'] = dusk ? 'frasco' : 'papel';
    try { localStorage.setItem('cepario-tema', html.dataset['tema']); } catch { /* sin almacenamiento: vale para esta visita */ }
  });
  $('tl').addEventListener('click', () => { interact(); homing = false; turnQueue -= Math.PI / 2; });
  $('tr').addEventListener('click', () => { interact(); homing = false; turnQueue += Math.PI / 2; });
  $('t360').addEventListener('click', () => { interact(); homing = false; turnQueue += Math.PI * 2; });
  // "Ver de cerca" de la ficha: el loop mantiene su aria-pressed sincronizado con el zoom
  closeupBtn = document.querySelector<HTMLElement>('#article .closeup');
  closeupBtn?.addEventListener('click', () => { interact(); setZoom(tzoom > 2.2 ? 1 : 2.6); });
}

/** Sale del modo ampliado. Devuelve true si estaba activo (para que Escape no haga nada más). */
export function salirDeFoco(): boolean {
  if (!focusMode) return false;
  setFocus(false);
  return true;
}

/* =========================================================
   CAMBIO DE VARIEDAD (transición del modelo)
   ========================================================= */
const DUR = RM ? 0 : 780;
/**
 * Cambia el modelo 3D con una transición. Alcanza con la semilla: el cogollo sale de id, tipo y violeta.
 * @param dir  1 = viene de la derecha, -1 = de la izquierda
 */
function mostrarVariedad(v: Semilla, dir = 1): void {
  if (sw) { liberarRig(sw.from); sw = null; }       // si había una transición a medias, se corta
  const from = rigActual;
  rigActual = crearRig(v);
  setZoom(1); vel.x = vel.y = 0; turnQueue = 0; homing = false;
  sw = { from, to: rigActual, dir: from ? Math.sign(dir) || 1 : 0, t0: performance.now() };
  ground.classList.add('switching');
}

const easeInCubic = (t: number): number => t * t * t;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const outBack = (t: number): number => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/* =========================================================
   LOOP
   ========================================================= */
let last = performance.now();
const prev: Record<string, boolean> = {};
const setOnce = (k: string, val: boolean, fn: (v: boolean) => void): void => { if (prev[k] !== val) { prev[k] = val; fn(val); } };
function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const t = now / 1000;

  // Encuadre: el cogollo es alto, así que el radio se ajusta por la altura del visor
  let tcx: number, tcy: number, tpx: number;
  if (focusMode) { tcx = Fr.W / 2; tcy = Fr.H / 2; tpx = Math.min(Fr.W * 0.5, Fr.H * 0.5) * 0.92; }
  else { tcx = Fr.st.x + Fr.st.w / 2; tcy = Fr.st.y + Fr.st.h * 0.47; tpx = Math.min(Fr.st.w * 0.5, Fr.st.h * 0.5) * 0.88; }
  if (!Fr.init) { Fr.cx = tcx; Fr.cy = tcy; Fr.px = tpx; Fr.init = true; }
  const kf = 1 - Math.exp(-dt * 7);
  Fr.cx += (tcx - Fr.cx) * kf; Fr.cy += (tcy - Fr.cy) * kf; Fr.px += (tpx - Fr.px) * kf;
  zoom += (tzoom - zoom) * (1 - Math.exp(-dt * 6));

  if (rigActual) {
    const qq = rigActual.spin.quaternion;
    if (homing) { qq.slerp(HOME, 1 - Math.exp(-dt * 6)); if (qq.angleTo(HOME) < 1e-3) { qq.copy(HOME); homing = false; } }
    if (!dragging && (vel.x || vel.y)) {
      rotate(vel.y * dt, vel.x * dt);
      const d = Math.exp(-dt * 4.5); vel.x *= d; vel.y *= d;
      if (Math.abs(vel.x) < 1e-3 && Math.abs(vel.y) < 1e-3) vel.x = vel.y = 0;
    }
    if (turnQueue) {
      const step = turnQueue * (1 - Math.exp(-dt * 4.2));
      turnQueue -= step; rotate(step, 0);
      if (Math.abs(turnQueue) < 1e-4) { rotate(turnQueue, 0); turnQueue = 0; }
    }
  }

  const L = dusk ? LIGHTS.dusk : LIGHTS.day, kl = 1 - Math.exp(-dt * 4);
  scene.environmentIntensity += (L.env - scene.environmentIntensity) * kl;
  keyLight.intensity += (L.key - keyLight.intensity) * kl;
  keyLight.color.lerp(L.keyColor, kl);
  rimLight.intensity += (L.rim - rimLight.intensity) * kl;
  renderer.toneMappingExposure += (L.exp - renderer.toneMappingExposure) * kl;

  const idleWanted = !RM && !dragging && !sw && now - lastInteract > 1800;
  idleRaw = idleWanted ? Math.min(1, idleRaw + dt / 1.5) : Math.max(0, idleRaw - dt / 0.4);
  const idle = idleRaw * idleRaw * (3 - 2 * idleRaw);

  // Transición entre variedades
  const slide = Fr.st.w * 0.95 / Fr.px;
  let outP = 1, inP = 1;
  if (sw) {
    outP = !sw.from || DUR === 0 ? 1 : clamp01((now - sw.t0) / (DUR * 0.6));
    inP = DUR === 0 ? 1 : clamp01((now - sw.t0) / DUR);
    if (outP >= 1 && inP >= 1) { liberarRig(sw.from); sw = null; ground.classList.remove('switching'); }
  }
  const pose = (rig: Rig, scale: number, x: number, yaw: number): void => {
    rig.pivot.visible = scale > 0.001;
    rig.pivot.scale.setScalar(Math.max(0.001, scale));
    rig.pivot.position.x = x;
    rig.pivot.position.y = RM ? 0 : Math.sin(t * 1.3 + rig.seed) * 0.028;
    rig.pivot.rotation.y = Math.sin(t * 0.55) * 0.16 * idle + yaw;
    rig.pivot.rotation.x = Math.sin(t * 0.9) * 0.03 * idle;
  };
  if (sw) {
    if (sw.from) { const e = easeInCubic(outP); pose(sw.from, 1 - e, -sw.dir * e * slide, -sw.dir * e * 1.4); }
    const e = easeOutCubic(inP);
    pose(sw.to, outBack(inP) * (0.25 + 0.75 * e), sw.dir * (1 - e) * slide, sw.dir * (1 - e) * 1.6);
  } else if (rigActual) pose(rigActual, 1, 0, 0);

  setOnce('zin', tzoom >= 1, (v) => { btnZin.classList.toggle('on', v); btnZin.setAttribute('aria-pressed', String(v)); });
  setOnce('zout', tzoom < 1, (v) => { btnZout.classList.toggle('on', v); btnZout.setAttribute('aria-pressed', String(v)); });
  setOnce('focus', focusMode, (v) => { btnExpand.classList.toggle('on', v); btnExpand.setAttribute('aria-pressed', String(v)); });
  setOnce('dusk', dusk, (v) => { btnLight.classList.toggle('on', v); btnLight.setAttribute('aria-pressed', String(v)); });
  if (closeupBtn) closeupBtn.setAttribute('aria-pressed', String(tzoom > 2.2));

  camera.position.z = Fr.H / (2 * TAN * Fr.px * zoom);
  camera.setViewOffset(Fr.W, Fr.H, Fr.W / 2 - Fr.cx, Fr.H / 2 - Fr.cy, Fr.W, Fr.H);
  if (post) { actualizarDof(); post.composer.render(dt); }
  else renderer.render(scene, camera);
  contarFrame(now);
  requestAnimationFrame(frame);
}

/* =========================================================
   ENTRADA: lo que usa el componente Visor.astro
   ========================================================= */
/** Lee la variedad de la página actual (atributos data-* de #hero que pone el build). */
function semillaDePagina(): Semilla {
  const d = $('hero').dataset;
  return { id: d['slug']!, tipo: d['tipo'] as Semilla['tipo'], violeta: d['violeta'] as Semilla['violeta'] };
}

/** Primera carga: arranca el loop y muestra la variedad de la página. */
export function arrancarVisor(): void {
  conectar();
  mostrarVariedad(semillaDePagina(), 1);
  requestAnimationFrame(frame);
  if (quierePost) activarPost().catch((err) => console.warn('No se pudo cargar el postprocesado', err));
}

/** Después de navegar a otra variedad: se engancha a la página nueva y cambia el modelo con su animación. */
export function alNavegar(dir: number): void {
  conectar();
  const v = semillaDePagina();
  if (v.id !== rigActual?.slug) mostrarVariedad(v, dir);
}
