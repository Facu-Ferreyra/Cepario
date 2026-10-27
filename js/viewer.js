// Copyright 2026 Facundo Agustín Ferreyra
// SPDX-License-Identifier: Apache-2.0

// Visor 3D: escena Three.js, encuadre, interacción (puntero, teclado, botones), transición entre variedades y loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { construirCogollo, hashStr } from './bud.js';

/* =========================================================
   ESCENA THREE.JS
   ========================================================= */
const $ = (id) => document.getElementById(id);
const hero = $('hero'), stage = $('stage');
const ground = $('ground'), hint = $('hint');
const btnZin = $('zin'), btnZout = $('zout'), btnExpand = $('expand'), btnLight = $('light');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const clampZoom = (z) => Math.min(3.4, Math.max(0.55, z));

const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), alpha: true, antialias: true });
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
function crearRig(v) {
  const pivot = new THREE.Group(), spin = new THREE.Group(), holder = new THREE.Group();
  pivot.add(spin); spin.add(holder);
  spin.quaternion.copy(HOME);
  const modelo = construirCogollo(v);
  modelo.updateMatrixWorld(true);
  const esfera = new THREE.Box3().setFromObject(modelo).getBoundingSphere(new THREE.Sphere());
  modelo.position.sub(esfera.center);
  holder.scale.setScalar(1 / (esfera.radius || 1));
  modelo.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  holder.add(modelo);
  pivot.visible = false;
  scene.add(pivot);
  return { slug: v.id, pivot, spin, seed: hashStr(v.id) % 7 };
}
function liberarRig(rig) {
  if (!rig) return;
  scene.remove(rig.pivot);
  rig.pivot.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh) o.dispose();
    if (!o.geometry.userData.shared) o.geometry.dispose();
    o.material.dispose();
  });
}

/* =========================================================
   ENCUADRE
   ========================================================= */
const Fr = { W: 1, H: 1, st: { x: 0, y: 0, w: 1, h: 1 }, cx: 0, cy: 0, px: 300, init: false };
function medir() {
  const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  Fr.W = Math.max(1, hr.width); Fr.H = Math.max(1, hr.height);
  Fr.st = { x: sr.left - hr.left, y: sr.top - hr.top, w: Math.max(1, sr.width), h: Math.max(1, sr.height) };
  renderer.setSize(Fr.W, Fr.H, false);
}
new ResizeObserver(medir).observe(hero);
new ResizeObserver(medir).observe(stage);
medir();

/* =========================================================
   INTERACCIÓN
   ========================================================= */
let zoom = 1, tzoom = 1, focusMode = false, dusk = false;
let dragging = false, homing = false, turnQueue = 0;
const vel = { x: 0, y: 0 };
let lastMoveT = 0, lastInteract = performance.now(), idleRaw = 0, hinted = false;
let rigActual = null, sw = null, closeupBtn = null;

function interact() { lastInteract = performance.now(); if (!hinted) { hinted = true; hint.classList.add('gone'); } }
const setZoom = (z) => { tzoom = clampZoom(z); };
function rotate(yaw, pitch) {
  if (!rigActual) return;
  const q = rigActual.spin.quaternion;
  if (yaw) q.premultiply(qTmp.setFromAxisAngle(AX_Y, yaw));
  if (pitch) q.premultiply(qTmp.setFromAxisAngle(AX_X, pitch));
}
function goHome() { homing = true; vel.x = vel.y = 0; turnQueue = 0; setZoom(1); }
const dragK = () => Math.PI / Math.max(260, Fr.px * 1.6);

const pts = new Map(); let pinchD = 0;
const pinchDist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.rail, .turn')) return;
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
function endPointer(e) {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  if (pts.size < 2) pinchD = 0;
  if (pts.size === 1) { dragging = true; vel.x = vel.y = 0; lastMoveT = performance.now(); }
  if (pts.size === 0) { dragging = false; stage.classList.remove('dragging'); if (performance.now() - lastMoveT > 80) vel.x = vel.y = 0; }
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('wheel', (e) => {
  e.preventDefault(); interact();
  const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
  setZoom(tzoom * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
}, { passive: false });
stage.addEventListener('dblclick', (e) => { if (e.target.closest('.rail, .turn')) return; interact(); goHome(); });
stage.addEventListener('keydown', (e) => {
  const map = {
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
  hero.dataset.light = $('gate').dataset.light = dusk ? 'dusk' : 'day';
  document.body.style.background = dusk ? '#14170f' : '';
});
$('tl').addEventListener('click', () => { interact(); homing = false; turnQueue -= Math.PI / 2; });
$('tr').addEventListener('click', () => { interact(); homing = false; turnQueue += Math.PI / 2; });
$('t360').addEventListener('click', () => { interact(); homing = false; turnQueue += Math.PI * 2; });
function setFocus(on) { focusMode = on; hero.classList.toggle('focus', on); }

/** Sale del modo ampliado. Devuelve true si estaba activo (para que Escape no haga nada más). */
export function salirDeFoco() {
  if (!focusMode) return false;
  setFocus(false);
  return true;
}
/** Botón "Ver de cerca" de la ficha: el loop mantiene su aria-pressed sincronizado con el zoom. */
/** @param {HTMLElement | null} btn */
export function setBotonCerca(btn) { closeupBtn = btn; }
export function alternarCerca() { interact(); setZoom(tzoom > 2.2 ? 1 : 2.6); }

/* =========================================================
   CAMBIO DE VARIEDAD (transición del modelo)
   ========================================================= */
const DUR = RM ? 0 : 780;
/**
 * Cambia el modelo 3D con una transición. Alcanza con el resumen: el cogollo sale de id y tipo.
 * @param {import('./tipos.js').Resumen} v
 * @param {number} [dir]  1 = viene de la derecha, -1 = de la izquierda
 */
export function mostrarVariedad(v, dir = 1) {
  if (sw) { liberarRig(sw.from); sw = null; }       // si había una transición a medias, se corta
  const from = rigActual;
  rigActual = crearRig(v);
  setZoom(1); vel.x = vel.y = 0; turnQueue = 0; homing = false;
  sw = { from, to: rigActual, dir: from ? Math.sign(dir) || 1 : 0, t0: performance.now() };
  ground.classList.add('switching');
}

const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const outBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/* =========================================================
   LOOP
   ========================================================= */
let last = performance.now();
const prev = {};
const setOnce = (k, val, fn) => { if (prev[k] !== val) { prev[k] = val; fn(val); } };
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const t = now / 1000;

  // Encuadre: el cogollo es alto, así que el radio se ajusta por la altura del visor
  let tcx, tcy, tpx;
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
  const pose = (rig, scale, x, yaw) => {
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
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/** Arranca el loop de render (antes de que lleguen los datos, para que el loader se vea animado). */
export function arrancarVisor() { requestAnimationFrame(frame); }
