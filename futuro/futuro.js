// Futuro · portada oscura de Meridad en 3D en vivo (Three.js + GSAP).
// La luz sale del iPad: pantalla que ilumina, tinta que se levanta como líneas de luz, suelo pulido que refleja
// con la retícula del códice, Leonardo proyectado, y acabado de cámara (resplandor, desenfoque, grano).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
// El recorrido empieza siempre arriba (con pantalla de carga, restaurar el scroll a media página descuadra las animaciones)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) scrollTo({ top: 0, behavior: 'instant' });
// Sin WebGL, a la portada clásica (sin 3D)
if (!(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })()) {
  location.replace('/clasica/'); throw new Error('Sin WebGL');
}
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches;
const small = innerWidth < 900;
await new Promise((r) => (window.gsap && window.ScrollTrigger ? r() : addEventListener('DOMContentLoaded', r)));
const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });
const { lerp, clamp, degToRad: rad, smoothstep } = THREE.MathUtils;
// Pantalla de carga (la «M» se dibuja con el progreso). Leonardo empieza a bajar desde ya, en paralelo con lo demás.
const LOAD = { steps: 0, glb: 0, shown: 0 }, pctEl = $('#pct'), mPath = $('#loader .m');
function progress(force) {
  const p = force ?? Math.min(0.97, LOAD.steps / 3 * 0.2 + LOAD.glb * 0.8);
  gsap.to(LOAD, { shown: p, duration: 0.4, overwrite: true, onUpdate() { pctEl.textContent = Math.round(LOAD.shown * 100); mPath.style.strokeDashoffset = 400 * (1 - LOAD.shown); } });
}
const step = () => { LOAD.steps++; progress(); };
const leoGLTF = new GLTFLoader().loadAsync('/codice/leonardo.glb', (e) => { if (e.total) { LOAD.glb = e.loaded / e.total; progress(); } });
const seg = (x, a, b) => smoothstep(x, a, b);         // 0→1 entre a y b

// ---------- Renderizador ----------
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(devicePixelRatio, small ? 1.5 : 2);
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const ANISO = renderer.capabilities.getMaxAnisotropy();
const BG = new THREE.Color(0x0a120e);
const scene = new THREE.Scene();
scene.background = BG;
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);

// Luz de estudio para los reflejos del aluminio y el vidrio (softboxes en un cuarto oscuro)
{
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x050807, side: THREE.BackSide })));
  const panel = (w, h, k, color, pos) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m); };
  panel(12, 4, 3.0, '#eaf5ee', [2, 13, 4]);
  panel(2.2, 14, 5.5, '#ffffff', [-12, 3, 3]);
  panel(2.2, 14, 3.0, '#bfe6cf', [12, 2, -5]);
  panel(10, 3, 0.9, '#ffd9b0', [0, -3, 12]);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(s, 0.02).texture;
}
const key = new THREE.DirectionalLight(0xeaf3ff, 1.1); key.position.set(-4, 6, 5);
const rim = new THREE.DirectionalLight(0x9fe0b8, 1.6); rim.position.set(5, 3, -6);
scene.add(key, rim);

// ---------- Utilidades ----------
const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t; }
const mesh = (g, m) => new THREE.Mesh(g, m);
await Promise.all(['600 80px Fraunces', 'italic 500 60px Fraunces', '700 30px Nunito', 'italic 500 54px "STIX Two Text"', '600 30px Caveat'].map((f) => document.fonts.load(f)));
step();

// ---------- iPad ----------
const W = 2.25, H = 3.0, D = 0.078, SW = W - 0.16, SH = H - 0.16;
const FLOOR = -H / 2 - 0.62;
function ipadOutline(w, h, r, p = 2.8, n = 14) {
  const s = new THREE.Shape(), pts = [];
  for (const [cx, cy, a0] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]]) {
    for (let i = 0; i <= n; i++) {
      const t = rad(a0 + 90 * i / n), co = Math.cos(t), si = Math.sin(t);
      pts.push([cx + r * Math.sign(co) * Math.abs(co) ** (2 / p), cy + r * Math.sign(si) * Math.abs(si) ** (2 / p)]);
    }
  }
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath(); return s;
}
// ---------- Contenido: Navier–Stokes ----------
// PROVISIONAL: la página se redibuja sobre el marco REAL de la app (barra, botones, panel del tutor). Cuando haya una captura
// real con esta página, se sustituye `compose(...)` por loadTex('/assets/....webp') y las coordenadas de abajo (en px de la
// captura) se ajustan a su letra.
const SHOT = { w: 1100, h: 1467 };
const CROP = (SW / SH) / (SHOT.w / SHOT.h);          // la captura es un poco más ancha que la pantalla: se recorta a los lados
const BOX = { main: { x: 146, y: 162, w: 808, h: 1270 }, tutor: { x: 14, y: 162, w: 668, h: 1270 } };
const LW = 808;                                       // ancho de la página en coordenadas locales
const NSP = (() => {
  const g0 = mk(8).getContext('2d'), eq = [['ρ ∂v/∂t', 1], ['+', 0], ['ρ (v·∇)v', 1], ['=', 0], ['−∇p', 1], ['+', 0], ['μ ∇²v', 1]];
  const font = (sz) => `italic 500 ${sz}px "STIX Two Text", serif`, gap = 22;
  const widths = (sz) => { g0.font = font(sz); return eq.map(([t]) => g0.measureText(t).width); };
  let fs = 60, w = widths(fs);
  fs *= Math.min(1, 680 / (w.reduce((a, b) => a + b, 0) + gap * (eq.length - 1))); w = widths(fs);
  const baseY = 318, boxes = [], items = []; let x = 62;
  eq.forEach(([t, isTerm], i) => { items.push({ t, x, isTerm }); if (isTerm) boxes.push({ x, y: baseY - fs * 0.92, w: w[i], h: fs * 1.3, text: t }); x += w[i] + gap; });
  const CX = 400, CY = 650, CH = 330, AL = rad(-9);
  const rot = ([px_, py_]) => { const dx = px_ - CX, dy = py_ - CY; return [CX + dx * Math.cos(AL) - dy * Math.sin(AL), CY + dx * Math.sin(AL) + dy * Math.cos(AL)]; };
  const yt = (t) => 5 * 0.13 * CH * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1015 * t ** 4);
  const foil = [], N = 34;
  for (let i = 0; i <= N; i++) { const t = i / N; foil.push(rot([CX - CH / 2 + CH * t, CY - yt(t)])); }
  for (let i = N - 1; i >= 1; i--) { const t = i / N; foil.push(rot([CX - CH / 2 + CH * t, CY + yt(t)])); }
  const streams = [-152, -102, -54, 60, 108, 152].map((dy) => {
    const pts = [];
    for (let X = CX - CH / 2 - 130; X <= CX + CH / 2 + 130; X += 15) {
      const bump = Math.exp(-(((X - CX) / (CH * 0.38)) ** 2)), amp = 50 * (1 - Math.abs(dy) / 270);
      pts.push([X, CY + dy + (dy < 0 ? -1 : 0.4) * amp * bump]);
    }
    return pts;
  });
  const vortex = Array.from({ length: 70 }, (_, i) => { const t = i / 69, a = t * Math.PI * 5.2, r = 10 + 56 * t; return [668 + Math.cos(a) * r, 928 + Math.sin(a) * r * 0.92]; });
  const clock = { c: [150, 925], r: 42 };
  clock.circle = Array.from({ length: 40 }, (_, i) => [clock.c[0] + Math.cos(i / 40 * 6.2832) * clock.r, clock.c[1] + Math.sin(i / 40 * 6.2832) * clock.r]);
  clock.hands = [[clock.c, [clock.c[0], clock.c[1] - 29]], [clock.c, [clock.c[0] + 22, clock.c[1] + 11]]];
  // dibuja todo el contenido de la página (coordenadas locales)
  function draw(g, lh) {
    g.strokeStyle = 'rgba(150,140,118,.2)'; g.lineWidth = 2;
    for (let y = 70; y < lh; y += 43) { g.beginPath(); g.moveTo(0, y); g.lineTo(LW, y); g.stroke(); }
    g.fillStyle = '#2B2622'; g.font = '600 52px Fraunces'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('Navier–Stokes', 58, 100);
    g.strokeStyle = '#3F6B4F'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(58, 116); g.bezierCurveTo(150, 124, 250, 108, 352, 116); g.stroke();
    g.fillStyle = '#8C826F'; g.font = '600 17px Nunito'; g.fillText('Mecánica de fluidos · Clase 4', 60, 144);
    g.fillStyle = '#2F4F8F'; g.font = font(fs);
    items.forEach((it) => g.fillText(it.t, it.x, baseY));
    g.font = font(fs * 0.62); g.fillText('Re = ρ v L / μ', 62, baseY + 78);
    g.strokeStyle = '#B5522E'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(60, baseY + 100); g.bezierCurveTo(130, baseY + 108, 220, baseY + 96, 300, baseY + 102); g.stroke();
    g.lineJoin = 'round';
    const poly = (pts, close) => { g.beginPath(); pts.forEach(([x_, y_], i) => (i ? g.lineTo(x_, y_) : g.moveTo(x_, y_))); if (close) g.closePath(); g.stroke(); };
    g.strokeStyle = '#2F4F8F'; g.lineWidth = 3; streams.forEach((p) => poly(p));
    g.fillStyle = 'rgba(63,107,79,.16)'; g.strokeStyle = '#2B2622'; g.lineWidth = 4.5; g.beginPath(); foil.forEach(([x_, y_], i) => (i ? g.lineTo(x_, y_) : g.moveTo(x_, y_))); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#B5522E'; g.lineWidth = 3.5; poly(vortex);
    g.strokeStyle = '#2B2622'; g.lineWidth = 3.5; poly(clock.circle, true); clock.hands.forEach((h) => poly(h));
    g.fillStyle = '#B5522E'; g.font = '600 27px Caveat'; g.fillText('líneas de corriente', 92, 478); g.fillText('perfil alar', CX - 50, CY + 208); g.fillText('vórtice', 628, 1020); g.fillText('tiempo', 118, 1000);
    g.fillStyle = '#3a3530'; g.font = '400 21px Fraunces'; g.fillText('¿Por qué un ala sostiene a un avión?', 60, 1110);
  }
  return { name: 'Navier–Stokes', fs, font, boxes, foil, streams, vortex, clock, CX, CY, draw, eq: items };
})();
// Ensayo: «¿Por qué cayó el Imperio romano?» — página provisional, igual que la de Navier–Stokes
const ESP = (() => {
  const g0 = mk(8).getContext('2d'), FS = 46, hand = (sz) => `600 ${sz}px Caveat, cursive`;
  const labelsAt = [['Tesis', 215], ['Causas', 410], ['Evidencia', 640], ['Conclusión', 850]];
  g0.font = hand(FS);
  const boxes = labelsAt.map(([t, y]) => ({ x: 58, y: y - FS * 0.82, w: g0.measureText(t).width, h: FS * 1.2, text: t }));
  const circ = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * 6.2832) * r, cy + Math.sin(i / n * 6.2832) * r]);
  const head = (tail, tip, len = 18) => { const a = Math.atan2(tail[1] - tip[1], tail[0] - tip[0]); return [[tip[0] + Math.cos(a + 0.5) * len, tip[1] + Math.sin(a + 0.5) * len], tip, [tip[0] + Math.cos(a - 0.5) * len, tip[1] + Math.sin(a - 0.5) * len]]; };
  const tesis = { rings: [circ(120, 312, 42), circ(120, 312, 18, 20)], arrow: [[192, 250], [126, 306]] }; tesis.head = head(tesis.arrow[0], tesis.arrow[1]);
  const causas = { root: circ(95, 507, 14, 20), branches: [440, 507, 574].map((y) => [[109, 507], [319, y]]), ends: [440, 507, 574].map((y) => circ(331, y, 12, 18)) };
  const evid = { line: [[90, 737], [530, 737]], ticks: [130, 250, 370, 490].map((x) => [[x, 722], [x, 752]]) };
  const concl = { check: [[80, 952], [115, 987], [182, 912]], rect: [[58, 940], [72, 922], [198, 922], [212, 940], [212, 1008], [198, 1026], [72, 1026], [58, 1008]] };
  function draw(g, lh) {
    g.strokeStyle = 'rgba(150,140,118,.2)'; g.lineWidth = 2;
    for (let y = 70; y < lh; y += 43) { g.beginPath(); g.moveTo(0, y); g.lineTo(LW, y); g.stroke(); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.fillStyle = '#2B2622'; g.font = '600 38px Fraunces'; g.fillText('¿Por qué cayó el Imperio romano?', 58, 100);
    g.strokeStyle = '#3F6B4F'; g.lineWidth = 4; g.beginPath(); g.moveTo(58, 116); g.bezierCurveTo(200, 124, 380, 108, 600, 116); g.stroke();
    g.fillStyle = '#8C826F'; g.font = '600 17px Nunito'; g.fillText('Historia · Ensayo', 60, 144);
    g.fillStyle = '#B5522E'; g.font = hand(FS); labelsAt.forEach(([t, y]) => g.fillText(t, 58, y));
    g.fillStyle = '#2F4F8F'; g.font = '600 31px Caveat, cursive';
    g.fillText('No fue un solo golpe:', 205, 304); g.fillText('fue una suma de causas.', 205, 342);
    g.font = '600 28px Caveat, cursive';
    ['crisis económica', 'invasiones', 'inestabilidad política'].forEach((t, i) => g.fillText(t, 356, 448 + i * 67));
    ['235 d. C.', '376', '410', '476'].forEach((t, i) => g.fillText(t, [130, 250, 370, 490][i] - 26, 786));
    g.font = '600 31px Caveat, cursive'; g.fillText('Roma se debilitó desde dentro.', 232, 972);
    const poly = (pts, close) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); g.stroke(); };
    g.lineWidth = 3.5;
    g.strokeStyle = '#B5522E'; tesis.rings.forEach((r) => poly(r, true)); poly(tesis.arrow); poly(tesis.head);
    g.strokeStyle = '#2F4F8F'; poly(causas.root, true); causas.branches.forEach((b) => poly(b)); causas.ends.forEach((e) => poly(e, true));
    g.strokeStyle = '#2B2622'; poly(evid.line); evid.ticks.forEach((t) => poly(t));
    g.strokeStyle = '#3F6B4F'; poly(concl.check); poly(concl.rect, true);
    g.fillStyle = '#3a3530'; g.font = '400 21px Fraunces'; g.fillText('Idea central: el imperio no cayó de golpe.', 60, 1110);
  }
  return { name: 'Imperio romano', fs: FS, fontFn: hand, boxes, tesis, causas, evid, concl, draw };
})();
function compose(img, box, tutor, topic) {
  const c = mk(SHOT.w, SHOT.h), g = c.getContext('2d'), s = box.w / LW;
  g.drawImage(img, 0, 0, SHOT.w, SHOT.h);
  g.fillStyle = '#F3EADD'; g.fillRect(110, 46, 122, 44);                                         // pastilla superior: nombre del cuaderno
  g.fillStyle = '#2B2622'; g.font = '600 17px Fraunces'; g.fillText(topic.name, 113, 66);
  g.fillStyle = '#8C826F'; g.font = '600 13.5px Nunito'; g.fillText('Pág. 1 / 1', 113, 83);
  g.fillStyle = '#FFFDFC'; g.fillRect(box.x + 5, 124, 250, 30);                                  // cabecera de la hoja
  g.fillStyle = '#3a3530'; g.font = '600 16px Nunito'; g.fillText(topic.name, box.x + 14, 145);
  g.fillStyle = tutor ? '#FFFDFA' : '#F9F5E6'; g.fillRect(box.x + 2, 162, box.w - 4, 1266);       // papel
  g.save(); g.beginPath(); g.rect(box.x + 2, 162, box.w - 4, 1266); g.clip();
  g.translate(box.x, box.y); g.scale(s, s); topic.draw(g, 1266 / s); g.restore();
  return c;
}
const loadTex = (src) => new THREE.TextureLoader().loadAsync(src).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; return t; });
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
const copyImg = (img) => { const c = mk(SHOT.w, SHOT.h); c.getContext('2d').drawImage(img, 0, 0, SHOT.w, SHOT.h); return c; };
const [imgNotebook, imgTutor, imgLibrary] = await Promise.all([loadImg('/assets/02-cuaderno.webp'), loadImg('/assets/03-tutor.webp'), loadImg('/assets/01-biblioteca.webp')]);
step();
// Orden de los temas: Física (provisional) → Historia (provisional) → Biología (captura REAL de la app, y su panel del tutor real)
const canvasNS = compose(imgNotebook, BOX.main, false, NSP), canvasES = compose(imgNotebook, BOX.main, false, ESP);
const shotTex = [tex(canvasNS), tex(canvasES), tex(copyImg(imgNotebook)), tex(copyImg(imgTutor)), tex(copyImg(imgLibrary))];   // 4: biblioteca (Funciones)
if (q.get('debug') === 'pantalla') { [canvasNS, canvasES].forEach((cv, i) => { cv.style.cssText = `position:fixed;top:0;left:${i * 50}vw;height:100vh;z-index:99;background:#fff`; document.body.appendChild(cv); }); }
const screens = [];
let IPG;                                              // geometrías y materiales del iPad, para los iPads pequeños del cierre
const rig = new THREE.Group(), ipad = new THREE.Group();
rig.add(ipad); scene.add(rig);
{
  const CORNER = 0.27, BEV = 0.011;
  const bodyGeo = new THREE.ExtrudeGeometry(ipadOutline(W - 2 * BEV, H - 2 * BEV, CORNER - BEV), { depth: D - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 5, curveSegments: 1 });
  bodyGeo.translate(0, 0, -(D - 2 * BEV) / 2);
  const alu = new THREE.MeshPhysicalMaterial({ color: 0x6f7176, metalness: 1, roughness: 0.3, clearcoat: 0.2, clearcoatRoughness: 0.45 });
  const glass = mesh(new THREE.ShapeGeometry(ipadOutline(W - 0.016, H - 0.016, CORNER - 0.008), 1), new THREE.MeshPhysicalMaterial({ color: 0x020303, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }));
  glass.position.z = D / 2 + 0.0006;
  const screenGeo = new THREE.ShapeGeometry(ipadOutline(SW, SH, 0.19), 1);
  { const uv = screenGeo.attributes.uv, p = screenGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + p.getX(i) / SW * CROP, 0.5 + p.getY(i) / SH); }
  // cuatro pantallas apiladas: Física, Historia, Biología (real) y el panel del tutor (real); se funden entre sí
  shotTex.forEach((map, i) => {
    const m = mesh(screenGeo, new THREE.MeshBasicMaterial({ map, transparent: i > 0, opacity: i ? 0 : 1 }));
    m.material.color.setScalar(1.04);                // emite: la pantalla es la luz de la escena (sin quemarse con el resplandor)
    m.position.z = D / 2 + 0.002 + i * 0.0006; screens.push(m);
  });
  ipad.add(mesh(bodyGeo, alu), glass, ...screens);
  IPG = { bodyGeo, alu, glassGeo: glass.geometry, glassMat: glass.material, screenGeo };
  const lensM = new THREE.MeshPhysicalMaterial({ color: 0x0a0d16, roughness: 0.05, metalness: 0.3, clearcoat: 1 });
  const bx = W / 2 - 0.17, by = H / 2 - 0.17;
  const bump = mesh(new THREE.CylinderGeometry(0.07, 0.073, 0.014, 40).rotateX(Math.PI / 2), alu); bump.position.set(bx, by, -D / 2 - 0.005);
  const lens = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.004, 40).rotateX(Math.PI / 2), lensM); lens.position.set(bx, by, -D / 2 - 0.0125);
  ipad.add(bump, lens);
  const btn = (len, alongX) => { const m = mesh(new THREE.CapsuleGeometry(0.011, len, 4, 12), alu); if (alongX) m.rotation.z = Math.PI / 2; m.scale.z = 1.5; return m; };
  const b1 = btn(0.24, true); b1.position.set(W / 2 - 0.45, H / 2 + 0.002, 0);
  const b2 = btn(0.15, false); b2.position.set(-W / 2 - 0.002, H / 2 - 0.45, 0);
  const b3 = btn(0.15, false); b3.position.set(-W / 2 - 0.002, H / 2 - 0.66, 0);
  ipad.add(b1, b2, b3);
  // Apple Pencil, pegado al canto derecho
  const P = (a) => a.map(([x, y]) => new THREE.Vector2(x * 1.3, y * 1.3));
  const pen = new THREE.Group();
  pen.add(mesh(new THREE.LatheGeometry(P([[0.009, 0.022], [0.014, 0.03], [0.0435, 0.2], [0.0445, 0.215], [0.0445, 1.55], [0.042, 1.568], [0.03, 1.58], [0, 1.583]]), 32), new THREE.MeshPhysicalMaterial({ color: 0xf2f1ec, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.4 })),
    mesh(new THREE.LatheGeometry(P([[0, 0], [0.004, 0.002], [0.0075, 0.01], [0.0092, 0.022]]), 20), new THREE.MeshStandardMaterial({ color: 0xb4b0a8, roughness: 0.6 })));
  pen.position.set(W / 2 + 0.058, -1.0, 0);
  ipad.add(pen);
}
// La pantalla ilumina lo que tiene delante
const screenLight = new THREE.PointLight(0xfff3dc, 3.2, 9, 1.6);
screenLight.position.set(0, 0, 1.2); ipad.add(screenLight);

// ---------- «Los tres a la vez»: al tumbarse, el iPad principal (Física) pasa a la columna izquierda y aparecen dos iPads
// pequeños (Historia al centro, Biología a la derecha); los tres temas proyectan sus piezas a la vez ----------
const COL = 3.5, CS = 0.6, TRIO_RZ = -0.12;          // separación entre columnas (mundo), escala de cada columna, giro común
const TRIO_W = 12.2, TRIO_H = 4.9;                    // lo que la cámara debe abarcar con las tres columnas
const minis = [1, 2].map((i) => {
  const g = new THREE.Group();
  const body = mesh(IPG.bodyGeo, IPG.alu.clone()), glass = mesh(IPG.glassGeo, IPG.glassMat.clone());
  glass.position.z = D / 2 + 0.0006;
  const scr = mesh(IPG.screenGeo, new THREE.MeshBasicMaterial({ map: shotTex[i] }));
  scr.material.color.setScalar(0.46); scr.position.z = D / 2 + 0.002;
  const mats = [body.material, glass.material, scr.material];
  mats.forEach((m) => { m.transparent = true; m.opacity = 0; });
  g.add(body, glass, scr); g.rotation.set(-Math.PI / 2, 0, TRIO_RZ); g.visible = false; scene.add(g);
  return { g, mats };
});
// Planes: un segundo iPad, de pie, con el tutor abierto (el principal se queda con el cuaderno solo)
const planPad = (() => {
  const g = new THREE.Group();
  const body = mesh(IPG.bodyGeo, IPG.alu.clone()), glass = mesh(IPG.glassGeo, IPG.glassMat.clone());
  glass.position.z = D / 2 + 0.0006;
  const scr = mesh(IPG.screenGeo, new THREE.MeshBasicMaterial({ map: shotTex[3] }));
  scr.material.color.setScalar(1.04); scr.position.z = D / 2 + 0.002;
  const mats = [body.material, glass.material, scr.material];
  mats.forEach((m) => { m.transparent = true; m.opacity = 0; });
  g.add(body, glass, scr); g.visible = false; scene.add(g);
  return { g, mats };
})();

// ---------- Tinta de luz: se dibuja sobre la pantalla y se levanta ----------
const px = (x, y) => new THREE.Vector3(((x / SHOT.w - 0.5) / CROP) * SW, (0.5 - y / SHOT.h) * SH, 0);   // píxel de la captura → pantalla
const C = { cream: '#fff1d6', mint: '#9ff0c4', orange: '#ffb070', lilac: '#d3b4ff', red: '#ff8a78' };
const inks = [0, 1, 2].map(() => { const g = new THREE.Group(); g.position.z = D / 2 + 0.012; ipad.add(g); return g; });   // una tinta por tema
const strokes = [], parts = [];
function stroke(points, color, lift, radius, closed, parent, topic) {
  radius *= 1.5;
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5);
  const g = new THREE.TubeGeometry(curve, Math.max(40, points.length * 14), radius, 6, closed);
  const m = mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3.0), transparent: true, opacity: 0, depthWrite: false }));
  m.userData = { lift, count: g.index.count, len: curve.getLength(), topic };
  parent.add(m); strokes.push(m); return m;
}
const ovalRaw = (cx, cy, rx, ry, n = 48) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * rx, cy + Math.sin(i / n * Math.PI * 2) * ry]);
const PX = ([x, y]) => px(x + BOX.main.x, y + BOX.main.y);                   // coordenadas locales de la página (Física, Historia) → pantalla
const PXS = ([x, y]) => px(x, y);                                             // px de la captura real (Biología) → pantalla
// Una «parte» de un tema: su nombre, qué hace, el dibujo que la explica y el término (palabra o fórmula) de la página que
// vuela hasta ese dibujo. Se separan en el espacio sobre el iPad. Para añadir o cambiar un tema basta con otra lista.
function part(topic, { name, desc, at, spin, color, plate: pl, map = PX, strokes: defs, side = 'down' }) {
  const ink = inks[topic], mapped = defs.map((d) => ({ ...d, pts: d.pts.map(map) }));
  const all = mapped.flatMap((d) => d.pts), c = all.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(all.length);
  let minY = 1e9, maxY = -1e9; all.forEach((p) => { minY = Math.min(minY, p.y - c.y); maxY = Math.max(maxY, p.y - c.y); });
  const group = new THREE.Group(); group.position.copy(c); ink.add(group);
  mapped.forEach((d) => stroke(d.pts.map((p) => p.clone().sub(c)), d.color, d.lift, d.r, d.closed, group, topic));
  const bx = pl.box, pad = 10, fs = pl.fs;
  const cv = mk(Math.ceil((bx.w + pad * 2) * 2), Math.ceil((bx.h + pad * 2) * 2)), g = cv.getContext('2d');
  g.font = pl.fontFn(fs * 2); g.textBaseline = 'middle'; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 22;
  g.fillText(pl.text, pad * 2, cv.height / 2 + fs * 0.1);
  const unitsW = ((bx.w + pad * 2) / SHOT.w / CROP) * SW, unitsH = ((bx.h + pad * 2) / SHOT.h) * SH, ps = clamp(0.72 / unitsW, 1, 3.4);
  const plate = mesh(new THREE.PlaneGeometry(unitsW, unitsH), new THREE.MeshBasicMaterial({ map: tex(cv), transparent: true, opacity: 0, depthWrite: false }));
  plate.material.color.setScalar(1.9); group.add(plate);
  const centre = map([bx.x + bx.w / 2, bx.y + bx.h / 2]);
  parts.push({ topic, idx: parts.filter((p) => p.topic === topic).length, name, desc, side, group, home: c, spin, at, anchor: new THREE.Vector3(0, minY - 0.06, 0),
    plate: { mesh: plate, homeRel: centre.clone().sub(c), hoverRel: new THREE.Vector3(0, maxY + unitsH * ps * 0.5 + 0.1, 0.06), scale: ps } });
}
const ROW4 = [-1.95, -0.65, 0.65, 1.95], ROW3 = [-1.3, 0, 1.3], UP = 1.95;
// ----- Tema 0 · Física: Navier–Stokes
const nsPlate = (i) => ({ text: NSP.boxes[i].text, box: NSP.boxes[i], fontFn: NSP.font, fs: NSP.fs });
part(0, { name: 'Cambio en el tiempo', desc: 'Cómo varía la velocidad en cada instante.', at: [ROW4[0], UP, 0.15], spin: 0.4, color: C.cream, plate: nsPlate(0),
  strokes: [{ pts: NSP.clock.circle, color: C.cream, lift: 1.0, r: 0.009, closed: true }, { pts: NSP.clock.hands[0], color: C.cream, lift: 1.0, r: 0.008 }, { pts: NSP.clock.hands[1], color: C.cream, lift: 1.0, r: 0.008 }] });
part(0, { name: 'Convección', desc: 'El fluido se arrastra a sí mismo.', at: [ROW4[1], UP, 0.3], spin: -0.4, color: C.mint, plate: nsPlate(1),
  strokes: NSP.streams.map((p, i) => ({ pts: p, color: C.mint, lift: 0.7 + (i % 3) * 0.2, r: 0.008, closed: false })) });
part(0, { name: 'Presión', desc: 'Empuja de la zona de más presión a la de menos.', at: [ROW4[2], UP, 0.3], spin: 0.45, color: C.orange, plate: nsPlate(2),
  strokes: [{ pts: NSP.foil, color: C.orange, lift: 1.2, r: 0.011, closed: true }] });
part(0, { name: 'Viscosidad', desc: 'La fricción interna que suaviza el flujo.', at: [ROW4[3], UP, 0.15], spin: -0.5, color: C.lilac, plate: nsPlate(3),
  strokes: [{ pts: NSP.vortex, color: C.lilac, lift: 1.5, r: 0.009, closed: false }] });
// ----- Tema 1 · Historia: ¿Por qué cayó el Imperio romano?
const esPlate = (i) => ({ text: ESP.boxes[i].text, box: ESP.boxes[i], fontFn: ESP.fontFn, fs: ESP.fs });
part(1, { name: 'Tesis', desc: 'La idea que defiendes, en una frase.', at: [ROW4[0], UP, 0.15], spin: 0.4, color: C.orange, plate: esPlate(0),
  strokes: [...ESP.tesis.rings.map((r) => ({ pts: r, color: C.orange, lift: 1.0, r: 0.009, closed: true })), { pts: ESP.tesis.arrow, color: C.orange, lift: 1.1, r: 0.009 }, { pts: ESP.tesis.head, color: C.orange, lift: 1.1, r: 0.009 }] });
part(1, { name: 'Causas', desc: 'Por qué ocurrió: económicas, políticas y militares.', at: [ROW4[1], UP, 0.3], spin: -0.4, color: C.mint, plate: esPlate(1),
  strokes: [{ pts: ESP.causas.root, color: C.mint, lift: 1.0, r: 0.009, closed: true }, ...ESP.causas.branches.map((b) => ({ pts: b, color: C.mint, lift: 0.8, r: 0.008 })), ...ESP.causas.ends.map((e) => ({ pts: e, color: C.mint, lift: 1.2, r: 0.008, closed: true }))] });
part(1, { name: 'Evidencia', desc: 'Hechos y fechas que respaldan tu tesis.', at: [ROW4[2], UP, 0.3], spin: 0.45, color: C.cream, plate: esPlate(2),
  strokes: [{ pts: ESP.evid.line, color: C.cream, lift: 0.9, r: 0.009 }, ...ESP.evid.ticks.map((t) => ({ pts: t, color: C.cream, lift: 1.2, r: 0.009 }))] });
part(1, { name: 'Conclusión', desc: 'Qué demuestra todo, dicho con tus palabras.', at: [ROW4[3], UP, 0.15], spin: -0.5, color: C.lilac, plate: esPlate(3),
  strokes: [{ pts: ESP.concl.check, color: C.lilac, lift: 1.2, r: 0.011 }, { pts: ESP.concl.rect, color: C.lilac, lift: 0.9, r: 0.009, closed: true }] });
// ----- Tema 2 · Biología: «La célula» (captura REAL; los términos son las palabras de sus apuntes)
const wPlate = (text, x, y, w) => ({ text, box: { x, y, w, h: 23 }, fontFn: (sz) => `700 ${sz}px Nunito`, fs: 19 });
part(2, { name: 'Membrana', desc: 'Controla qué entra y qué sale.', at: [ROW3[0], UP, 0.3], spin: 0.35, color: C.mint, map: PXS, plate: wPlate('Membrana', 217, 345, 88),
  strokes: [{ pts: ovalRaw(441, 641, 206, 141), color: C.mint, lift: 0.75, r: 0.011, closed: true }] });
part(2, { name: 'Núcleo', desc: 'Guarda el ADN.', at: [ROW3[1], UP, 0.3], spin: -0.5, color: C.lilac, map: PXS, plate: wPlate('Núcleo', 217, 366, 62),
  strokes: [{ pts: ovalRaw(456, 626, 63, 48, 32), color: C.lilac, lift: 1.45, r: 0.01, closed: true }, { pts: [[576, 510], [535, 549], [493, 588]], color: C.cream, lift: 1.0, r: 0.008 }, { pts: [[510, 586], [493, 588], [497, 570]], color: C.cream, lift: 1.0, r: 0.008 }] });
part(2, { name: 'Mitocondria', desc: 'Produce la energía (ATP).', at: [ROW3[2], UP, 0.3], spin: 0.55, color: C.orange, map: PXS, plate: wPlate('Mitocondria', 217, 387, 100),
  strokes: [{ pts: [[291, 657], [365, 657], [371, 663], [371, 688], [365, 694], [291, 694], [285, 688], [285, 663]], color: C.orange, lift: 1.2, r: 0.01, closed: true }, { pts: [[327, 810], [327, 756], [327, 703]], color: C.cream, lift: 0.9, r: 0.008 }, { pts: [[316, 716], [327, 703], [338, 716]], color: C.cream, lift: 0.9, r: 0.008 }] });
const PIVOT = [PX([NSP.CX, NSP.CY]), PX([400, 640]), px(441, 641)];            // centro del dibujo de cada tema: desde ahí crece su holograma
[0, 1, 2].forEach((ti) => { const ss = strokes.filter((st) => st.userData.topic === ti), tot = ss.reduce((acc, st) => acc + st.userData.len, 0); let acc = 0; for (const st of ss) { st.userData.t0 = acc / tot; acc += st.userData.len; } });

// Motas de luz que suben desde la pantalla
const motes = (() => {
  const n = small ? 60 : 130, pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) seed.push({ x: (Math.random() - 0.5) * SW * 1.2, y: (Math.random() - 0.5) * SH, z: Math.random() * 2.4, s: 0.15 + Math.random() * 0.35, p: Math.random() * 6 });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = mk(64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const m = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, map: tex(c), color: new THREE.Color(C.mint).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  ipad.add(m);
  return { m, pos, seed, n };
})();

// Resplandor del ambiente detrás del iPad
{
  const c = mk(256), x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(120,200,160,.55)'); gr.addColorStop(0.5, 'rgba(60,120,95,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: q.get('fondo') !== '0' ? 0.2 : 0.5 }));
  sp.scale.set(13, 10, 1); sp.position.set(0.4, 0.4, -3.2); scene.add(sp);
}

// ---------- Suelo pulido: refleja la escena (difuminada) y lleva la retícula del códice ----------
const floorShader = {
  name: 'CodexFloor',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uBg: { value: BG }, uFade: { value: 1 }, uCenter: { value: new THREE.Vector2() }, uTime: { value: 0 }, uPhoto: { value: 0 }, uPx: { value: new THREE.Vector2(1 / 1024, 1 / 1024) }, uLeo: { value: new THREE.Vector3(0, 0, 0) },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main() { vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec3 uBg; uniform float uFade; uniform vec2 uCenter; uniform float uTime, uPhoto; uniform vec2 uPx; uniform vec3 uLeo;
    varying vec4 vUv; varying vec3 vW;
    float ring(float d, float r, float w) { return 1.0 - smoothstep(0.0, w, abs(d - r)); }
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      vec3 refl = vec3(0.0);
      for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) refl += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * uPx * 3.0).rgb;
      refl = max(refl / 25.0 - uBg, 0.0);                               // solo lo que brilla más que el fondo
      float d = distance(vW.xz, uCenter), fade = exp(-d * 0.085);
      float camD = distance(vW, cameraPosition);
      vec3 col = refl * (0.15 + 0.35 * fade);
      float dl = distance(vW.xz, uLeo.xy);
      col += vec3(0.62, 0.94, 0.77) * uLeo.z * (ring(dl, 0.62, 0.02) * 0.9 + exp(-dl * dl * 3.0) * 0.22);  // base de la proyección
      float far = 1.0 - smoothstep(14.0, 55.0, camD);
      col *= far;
      float shade = 0.5 * exp(-d * d * 0.045) + 0.2;                    // sobre la foto: oscurece la mesa bajo el iPad
      gl_FragColor = vec4(uBg * (1.0 - uPhoto) + col, mix(1.0, shade, uPhoto)) * uFade;
    }`,
};
const floor = new Reflector(new THREE.PlaneGeometry(240, 240), { textureWidth: small ? 512 : 1024, textureHeight: small ? 512 : 1024, clipBias: 0.003, shader: floorShader });
floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; scene.add(floor);
const FU = floor.material.uniforms;
floor.material.transparent = true; floor.material.premultipliedAlpha = true; floor.material.depthWrite = false;

// ---------- Lugares reales de fondo: biblioteca, aula y casa (se alternan con el recorrido) ----------
const PHOTO = q.get('fondo') !== '0';
FU.uPhoto.value = PHOTO ? 1 : 0;
const places = [];
if (PHOTO) {
  scene.add(camera); camera.layers.enable(1);        // capa 1: el suelo no los refleja
  const defs = [['biblioteca', 0.51, 'Biblioteca · 7:40 p. m.'], ['aula', 0.54, 'Aula · 6:15 p. m.'], ['casa', 0.44, 'En casa · 11:05 p. m.']];
  const byName = {}; await Promise.all([...new Set(defs.map(([n]) => n))].map(async (n) => { byName[n] = await loadTex(`/futuro/lugar-${n}.webp`); }));
  defs.forEach(([n, hp, label], i) => {
    const m = mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshBasicMaterial({ map: byName[n], transparent: true, opacity: i ? 0 : 1, depthWrite: false, fog: false }));
    m.material.color.setScalar(0.78); m.layers.set(1); m.renderOrder = -10 + i; m.userData = { hp, label };
    camera.add(m); places.push(m);
  });
}
// Portada: toma abierta de la biblioteca con la mesa de estudio (foto real); el iPad 3D está de pie sobre la mesa
let mesa = null;
const MESA = { u: 0.5, v: 0.56, bu: 0.5, bv: 0.565, h: 0.25, rz: -0.06, tilt: -1.0 };   // escritorio visto desde arriba (~70°): centro del iPad (y del acercamiento) en la foto, su alto, su giro y la inclinación de la mesa
if (PHOTO) {
  mesa = mesh(new THREE.PlaneGeometry(1.5, 1), new THREE.MeshBasicMaterial({ map: await loadTex('/futuro/lugar-mesa.webp'), transparent: true, depthWrite: false, fog: false }));
  mesa.material.color.setScalar(0.86); mesa.layers.set(1);
  { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 256, 0);   // bordes izquierdo e inferior difuminados (la foto se corre)
    g.addColorStop(0, '#000'); g.addColorStop(0.1, '#fff'); g.addColorStop(1, '#fff'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const g2 = x.createLinearGradient(0, 0, 0, 256); g2.addColorStop(0.86, 'rgba(0,0,0,0)'); g2.addColorStop(1, '#000'); x.fillStyle = g2; x.fillRect(0, 0, 256, 256); mesa.material.alphaMap = new THREE.CanvasTexture(c); } mesa.renderOrder = -4; camera.add(mesa);
  // sombra suave del iPad sobre el escritorio (la luz viene de la lámpara, arriba a la izquierda)
  const rc = mk(256, 320), rx = rc.getContext('2d');
  rx.shadowColor = 'rgba(0,0,0,1)'; rx.shadowBlur = 34; rx.shadowOffsetX = 1000; rx.fillStyle = '#000'; rx.beginPath(); rx.roundRect(48 - 1000, 48, 160, 224, 18); rx.fill();
  mesa.userData.refl = mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(rc), transparent: true, depthWrite: false, opacity: 0 }));
  mesa.userData.refl.layers.set(1); mesa.userData.refl.renderOrder = -3; camera.add(mesa.userData.refl);
}
step();
const placeEl = $('#place'); let placeNow = -1;

// ---------- Leonardo en 3D a color: se arma de abajo hacia arriba (plano de corte) con un anillo de luz que sube ----------
const LEO = new THREE.Vector3(-2.15, FLOOR, 0.75), LEO_H = 2.05;
renderer.localClippingEnabled = true;
const leoClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), FLOOR - 0.01);       // se ve lo que está por debajo de la altura del corte
const leo = new THREE.Group(); leo.position.copy(LEO); leo.rotation.y = rad(28); scene.add(leo);
const leoScan = mesh(new THREE.RingGeometry(0.5, 0.56, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.mint).multiplyScalar(3), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
leoScan.rotation.x = -Math.PI / 2; leoScan.position.set(LEO.x, FLOOR, LEO.z); scene.add(leoScan);
const leoLight = new THREE.PointLight(0xfff1e0, 0, 7, 1.4); leoLight.position.set(LEO.x + 0.9, FLOOR + 1.9, LEO.z + 1.8); scene.add(leoLight);
const leoReady = leoGLTF.then((gltf) => {
  const model = gltf.scene, box = new THREE.Box3().setFromObject(model), s = LEO_H / (box.max.y - box.min.y);
  model.scale.setScalar(s);
  model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  model.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.clippingPlanes = [leoClip]; m.envMapIntensity = 0.9; }); } });
  leo.add(model);
}).catch(() => {});

// ---------- Tu avatar: Leonardo hoy y tres siluetas de plano técnico «Próximamente» (el iPad se aparta hacia arriba) ----------
const avatars = [];
{
  const fill = new THREE.MeshStandardMaterial({ color: 0xcfe3c9, transparent: true, opacity: 0.1, depthWrite: false, roughness: 0.6 });
  const wire = new THREE.LineBasicMaterial({ color: new THREE.Color(0xf08a4b).multiplyScalar(1.4), transparent: true, opacity: 0.6 });
  const ringM = new THREE.MeshBasicMaterial({ color: 0xf08a4b, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const bodyG = new THREE.CapsuleGeometry(0.3, 0.5, 3, 9), headG = new THREE.SphereGeometry(0.25, 9, 6), ringG = new THREE.RingGeometry(0.42, 0.45, 48);
  [[-0.75, 0.45], [0.5, 0.1], [1.75, 0.45]].forEach(([x, z]) => {
    const g = new THREE.Group(), inner = new THREE.Group();
    const body = mesh(bodyG, fill); body.position.y = 0.58;
    const head = mesh(headG, fill); head.position.y = 1.3;
    const bw = new THREE.LineSegments(new THREE.WireframeGeometry(bodyG), wire); bw.position.y = 0.58;
    const hw = new THREE.LineSegments(new THREE.WireframeGeometry(headG), wire); hw.position.y = 1.3;
    inner.add(body, head, bw, hw);
    const ring = mesh(ringG, ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005;
    g.add(inner, ring); g.position.set(x, FLOOR, z); g.scale.setScalar(1.22); g.visible = false; scene.add(g);
    avatars.push({ g, inner, ring });
  });
}

// ---------- Cierre: páginas al estilo de los cuadernos de Leonardo que, al voltearse, son apuntes de hoy en Meridad ----------
// Dibujadas en canvas (sin imágenes externas): al frente, boceto en sepia con escritura en espejo; detrás, la misma pregunta resuelta hoy
const codex = (() => {
  const PW = 600, PH = 800;
  let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const jit = (v) => v + (rnd() - 0.5) * 3;
  function sk(x, pts, closed = false, passes = 2) {        // trazo a mano: dos pasadas con temblor
    for (let p = 0; p < passes; p++) {
      x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(jit(a), jit(b)) : x.moveTo(jit(a), jit(b)))); if (closed) x.closePath(); x.stroke();
    }
  }
  const circ = (cx, cy, r, n = 48, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  function parchment(x) {
    const g = x.createRadialGradient(PW / 2, PH / 2, 60, PW / 2, PH / 2, 520); g.addColorStop(0, '#ead9b0'); g.addColorStop(0.7, '#d6bd88'); g.addColorStop(1, '#a98450');
    x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${120 + rnd() * 40},${80 + rnd() * 30},40,${0.03 + rnd() * 0.05})`; x.beginPath(); x.arc(rnd() * PW, rnd() * PH, 10 + rnd() * 90, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(90,60,30,.25)'; x.lineWidth = 6; x.strokeRect(3, 3, PW - 6, PH - 6);
  }
  function mirror(x, lines, y0, size = 23) {               // escritura en espejo, como en sus cuadernos
    x.save(); x.translate(PW, 0); x.scale(-1, 1); x.fillStyle = 'rgba(74,44,18,.78)'; x.font = `italic 500 ${size}px "STIX Two Text"`;
    lines.forEach((t, i) => x.fillText(t, 46 + (i % 2) * 8, y0 + i * size * 1.45)); x.restore();
  }
  const SEP = 'rgba(78,46,18,.86)';
  // bocetos (frente)
  const sketches = [
    (x) => { const px = 120, py = 470; for (let i = 0; i < 7; i++) { const a = -0.15 - i * 0.16, L = 330 - i * 26; sk(x, Array.from({ length: 12 }, (_, j) => { const t = j / 11; return [px + Math.cos(a) * L * t, py + Math.sin(a) * L * t - Math.sin(t * Math.PI) * 26]; })); }
      sk(x, Array.from({ length: 30 }, (_, j) => { const t = j / 29, a = -0.15 - t * 0.96, L = 330 - t * 156; return [px + Math.cos(a) * L + Math.sin(t * 40) * 8, py + Math.sin(a) * L]; }));
      for (let i = 0; i < 26; i++) sk(x, [[px + 40 + i * 10, py - 10 - i * 3], [px + 50 + i * 10, py - 30 - i * 4]], false, 1); },
    (x) => { [[230, 330, 1], [380, 420, 0.7], [250, 520, 0.55]].forEach(([cx, cy, s]) => sk(x, Array.from({ length: 90 }, (_, i) => { const a = i * 0.21, r = (8 + a * 11) * s; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8]; })));
      for (let i = 0; i < 6; i++) sk(x, Array.from({ length: 20 }, (_, j) => [60 + j * 26, 180 + i * 16 + Math.sin(j * 0.6 + i) * 12])); },
    (x) => { const gear = (cx, cy, r, n) => { const pts = []; for (let i = 0; i < n * 4; i++) { const a = i / (n * 4) * Math.PI * 2, rr = i % 4 < 2 ? r : r - 18; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } sk(x, pts, true); sk(x, circ(cx, cy, r * 0.32)); sk(x, circ(cx, cy, 8, 16));
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; sk(x, [[cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32], [cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22)]], false, 1); } };
      gear(240, 360, 130, 16); gear(420, 510, 82, 10); },
    (x) => { const cx = 300, cy = 380; sk(x, circ(cx, cy, 200, 80)); sk(x, [[cx - 168, cy - 140], [cx + 168, cy - 140], [cx + 168, cy + 196], [cx - 168, cy + 196]], true);
      sk(x, circ(cx, cy - 118, 26, 30)); sk(x, [[cx, cy - 92], [cx, cy + 40]]); sk(x, [[cx - 168, cy - 54], [cx + 168, cy - 54]]); sk(x, [[cx, cy - 60], [cx - 176, cy - 120]], false, 1); sk(x, [[cx, cy - 60], [cx + 176, cy - 120]], false, 1);
      sk(x, [[cx, cy + 40], [cx - 40, cy + 196]]); sk(x, [[cx, cy + 40], [cx + 40, cy + 196]]); sk(x, [[cx, cy + 40], [cx - 120, cy + 170]], false, 1); sk(x, [[cx, cy + 40], [cx + 120, cy + 170]], false, 1); },
    (x) => { sk(x, Array.from({ length: 20 }, (_, j) => [300 + Math.sin(j * 0.3) * 20, 640 - j * 22]));
      [[0.9, 520], [-0.8, 470], [1.1, 410], [-1.0, 360], [0.7, 300]].forEach(([d, y]) => { const sx = 300 + Math.sin((640 - y) / 22 * 0.3) * 20; sk(x, Array.from({ length: 16 }, (_, j) => { const t = j / 15; return [sx + d * 150 * t, y - Math.sin(t * Math.PI) * 30 - t * 40]; })); sk(x, Array.from({ length: 16 }, (_, j) => { const t = j / 15; return [sx + d * 150 * t, y + Math.sin(t * Math.PI) * 18 - t * 40]; })); });
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; sk(x, [[300, 200], [300 + Math.cos(a) * 60, 200 + Math.sin(a) * 60]]); } sk(x, circ(300, 200, 14, 20)); },
    (x) => { const ph = (1 + Math.sqrt(5)) / 2, V = [[-1, ph, 0], [1, ph, 0], [-1, -ph, 0], [1, -ph, 0], [0, -1, ph], [0, 1, ph], [0, -1, -ph], [0, 1, -ph], [ph, 0, -1], [ph, 0, 1], [-ph, 0, -1], [-ph, 0, 1]];
      const P = V.map(([a, b, c]) => { const ca = Math.cos(0.5), sa = Math.sin(0.5), x1 = a * ca - c * sa, z1 = a * sa + c * ca, cb = Math.cos(0.3), sb = Math.sin(0.3), y2 = b * cb - z1 * sb; return [300 + x1 * 105, 380 + y2 * 105]; });
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) { const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]); if (Math.abs(d - 2) < 0.01) sk(x, [P[i], P[j]]); } },
  ];
  const ITAL = ['del volare delli uccelli e de' + "'" + ' sua moti', "dell'acqua che si raggira in sé", 'delle rote dentate e lor forza', 'le misure dell' + "'" + 'omo secondo Vetruvio', 'come la pianta si nutrica', 'de' + "'" + ' corpi regolari e lor facce'];
  // apuntes de hoy (reverso)
  const INK = '#1f3f8f', HL = 'rgba(80,200,140,.35)';
  const Q = ['¿Cómo vuela un ave?', '¿Por qué el agua forma remolinos?', '¿Cómo se transmite el movimiento?', '¿Cuánto mides con los brazos abiertos?', '¿De qué se alimenta una planta?', '¿Qué cumplen todos los poliedros?'];
  const F = ['L = ½ ρ v² S C', '∂u/∂t + (u·∇)u = −∇p/ρ + ν∇²u', 'ω₁ · r₁ = ω₂ · r₂', 'envergadura ≈ estatura', '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂', 'V − A + C = 2'];
  const TUT = ['El ala empuja el aire hacia abajo y el aire la empuja hacia arriba.', 'Hoy lo escribimos con las ecuaciones de Navier–Stokes.', 'El engrane chico da más vueltas que el grande.', 'Con los brazos abiertos mides casi lo mismo que de alto.', 'Con luz, la hoja convierte agua y aire en azúcar.', 'Icosaedro: 12 − 30 + 20 = 2. Y vale en cualquier poliedro convexo.'];
  const notes = [
    (x) => { x.beginPath(); x.moveTo(110, 400); x.bezierCurveTo(200, 300, 420, 320, 500, 400); x.bezierCurveTo(400, 410, 220, 420, 110, 400); x.stroke();
      for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(60, 300 + i * 50 + (i > 1 ? 80 : 0)); x.bezierCurveTo(200, 290 + i * 50 + (i > 1 ? 90 : -40), 380, 290 + i * 50 + (i > 1 ? 110 : -30), 560, 330 + i * 50 + (i > 1 ? 90 : 0)); x.globalAlpha = 0.45; x.stroke(); x.globalAlpha = 1; }
      arrow(x, 300, 360, 300, 250, '#e0702c'); x.fillStyle = '#e0702c'; x.font = '600 34px Caveat'; x.fillText('L', 314, 262); },
    (x) => { [[200, 360, 1], [400, 400, 0.8]].forEach(([cx, cy, s]) => { x.beginPath(); for (let i = 0; i < 70; i++) { const a = i * 0.2, r = (6 + a * 8) * s; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8); } x.stroke(); }); },
    (x) => { x.beginPath(); x.arc(240, 380, 110, 0, 7); x.stroke(); x.beginPath(); x.arc(400, 380, 50, 0, 7); x.stroke(); x.font = 'italic 500 30px "STIX Two Text"'; x.fillStyle = INK; x.fillText('r₁', 230, 385); x.fillText('r₂', 390, 385);
      x.beginPath(); x.arc(240, 380, 135, -2.4, -1.4); x.stroke(); x.beginPath(); x.arc(400, 380, 72, -1.7, -0.6); x.stroke(); },
    (x) => { x.beginPath(); x.arc(300, 270, 24, 0, 7); x.moveTo(300, 294); x.lineTo(300, 420); x.moveTo(150, 330); x.lineTo(450, 330); x.moveTo(300, 420); x.lineTo(250, 530); x.moveTo(300, 420); x.lineTo(350, 530); x.stroke();
      arrow(x, 150, 560, 450, 560, '#e0702c'); arrow(x, 490, 240, 490, 530, '#e0702c'); },
    (x) => { x.beginPath(); x.moveTo(200, 500); x.bezierCurveTo(220, 330, 380, 300, 430, 260); x.bezierCurveTo(420, 380, 330, 480, 200, 500); x.stroke(); x.beginPath(); x.moveTo(200, 500); x.lineTo(380, 310); x.stroke();
      x.strokeStyle = '#e0a020'; x.beginPath(); x.arc(110, 250, 30, 0, 7); x.stroke(); arrow(x, 150, 280, 250, 360, '#e0a020'); x.strokeStyle = INK; },
    (x) => { const ph = (1 + Math.sqrt(5)) / 2, V = [[-1, ph, 0], [1, ph, 0], [-1, -ph, 0], [1, -ph, 0], [0, -1, ph], [0, 1, ph], [0, -1, -ph], [0, 1, -ph], [ph, 0, -1], [ph, 0, 1], [-ph, 0, -1], [-ph, 0, 1]];
      const P = V.map(([a, b, c]) => [300 + (a * 0.88 - c * 0.48) * 80, 390 + b * 80]); x.beginPath();
      for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) if (Math.abs(Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]) - 2) < 0.01) { x.moveTo(...P[i]); x.lineTo(...P[j]); } x.stroke(); },
  ];
  function arrow(x, a, b, c, d, col) { x.save(); x.strokeStyle = col; x.lineWidth = 4; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); const t = Math.atan2(d - b, c - a); x.moveTo(c, d); x.lineTo(c - 18 * Math.cos(t - 0.45), d - 18 * Math.sin(t - 0.45)); x.moveTo(c, d); x.lineTo(c - 18 * Math.cos(t + 0.45), d - 18 * Math.sin(t + 0.45)); x.stroke(); x.restore(); }
  function wrap(x, txt, X, Y, mw, lh) { let line = '', y = Y; txt.split(' ').forEach((w) => { const tt = line ? line + ' ' + w : w; if (x.measureText(tt).width > mw && line) { x.fillText(line, X, y); line = w; y += lh; } else line = tt; }); x.fillText(line, X, y); }
  const front = (i) => { const c = mk(PW, PH), x = c.getContext('2d'); sd = 11 + i * 97; parchment(x); x.strokeStyle = SEP; x.lineWidth = 2.2; x.lineCap = x.lineJoin = 'round'; sketches[i](x);
    mirror(x, [ITAL[i], 'la sperienza non falla mai', 'ma sol fallano i nostri giudizi'], 650); mirror(x, ['studia prima la scienza'], 110, 26); return tex(c); };
  const back = (i) => { const c = mk(PW, PH), x = c.getContext('2d'); x.fillStyle = '#f7f5ef'; x.fillRect(0, 0, PW, PH);
    x.strokeStyle = 'rgba(60,110,170,.12)'; x.lineWidth = 1.5; for (let y = 150; y < PH; y += 40) { x.beginPath(); x.moveTo(0, y); x.lineTo(PW, y); x.stroke(); }
    x.fillStyle = INK; x.font = '600 44px Caveat'; wrap(x, Q[i], 44, 92, PW - 88, 44);
    x.strokeStyle = INK; x.lineWidth = 4; x.lineCap = x.lineJoin = 'round'; notes[i](x);
    x.font = `italic 500 ${F[i].length > 22 ? 27 : 40}px "STIX Two Text"`; const fw = x.measureText(F[i]).width; x.fillStyle = HL; x.fillRect(PW / 2 - fw / 2 - 12, 572, fw + 24, 52);
    x.fillStyle = '#16233f'; x.textAlign = 'center'; x.fillText(F[i], PW / 2, 610); if (i === 0) { x.font = 'italic 500 24px "STIX Two Text"'; x.fillText('L', PW / 2 + fw / 2 + 8, 618); } x.textAlign = 'left';
    x.fillStyle = '#e3f1e6'; x.beginPath(); x.roundRect(36, 652, PW - 72, 112, 18); x.fill(); x.fillStyle = '#2f7a52'; x.font = '800 18px Nunito'; x.fillText('TUTOR', 58, 684);
    x.fillStyle = '#1f3a2b'; x.font = '600 22px Nunito'; wrap(x, TUT[i], 58, 714, PW - 116, 28); return tex(c); };
  // dónde flotan (alrededor de Leonardo y del iPad, sin tapar el texto de la izquierda)
  const SPOT = [[2.2, 1.6, -0.5, -0.3, -0.07], [-1.3, 1.3, -0.3, 0.25, 0.07], [2.6, -0.05, 0.15, -0.35, 0.05], [-2.9, 2.0, -1.0, 0.3, -0.08], [0.15, 2.05, -3.2, -0.05, 0.05], [2.05, -1.55, 0.8, -0.25, -0.05]];
  const SPOT_P = [[1.45, 2.45, -1.6, -0.2, -0.07], [-1.75, 1.45, -0.5, 0.25, 0.07], [1.75, 0.35, -2.2, -0.3, 0.05], [-3.3, 1.95, -1.2, 0.3, -0.08], [-0.3, 2.75, -2.4, 0.05, 0.06], [-3.1, 0.15, -2.2, 0.3, -0.05]];   // en vertical
  const geo = new THREE.PlaneGeometry(0.95, 1.27);
  const pages = SPOT.map((s, i) => {
    const g = new THREE.Group(), mf = new THREE.MeshBasicMaterial({ map: front(i), transparent: true, opacity: 0, depthWrite: false }), mb = new THREE.MeshBasicMaterial({ map: back(i), transparent: true, opacity: 0, depthWrite: false });
    mf.color.setScalar(0.92); mb.color.setScalar(0.9);
    const f = mesh(geo, mf), bk = mesh(geo, mb); bk.rotation.y = Math.PI; f.layers.set(1); bk.layers.set(1); g.add(f, bk); g.visible = false; scene.add(g);   // capa 1: el suelo no las refleja
    return { g, mats: [mf, mb], s, sp: SPOT_P[i] };
  });
  camera.layers.enable(1);
  return pages;
})();

// ---------- Acabado de cámara ----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: small ? 0 : 4 }));
composer.setPixelRatio(DPR);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 9, aperture: 0.00009, maxblur: 0.006 });
if (q.get('dof') !== '0' && !small) composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.75, 1.12);
if (q.get('bloom') !== '0') composer.addPass(bloom);
composer.addPass(new OutputPass());
{ // grano fino
  const c = mk(256), g = c.getContext('2d'), img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const n = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = n; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); $('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

// ---------- Estado, cámara y scroll ----------
const S = { k: 0, in: 0 };                  // k: 0 portada · 1 la tinta se levanta · 2 se descompone en partes · 3 aparece el tutor
let L = {};
function layout() {
  L.w = innerWidth; L.h = innerHeight;
  renderer.setSize(L.w, L.h, false); composer.setSize(L.w, L.h);
  camera.aspect = L.w / L.h;
  L.portrait = L.w / L.h < 1;
  L.tan = Math.tan(rad(camera.fov / 2));
}
layout();
let lastW = innerWidth;
addEventListener('resize', () => { layout(); if (innerWidth !== lastW) { lastW = innerWidth; ScrollTrigger.refresh(); } });
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; } });

// Ventanas de tiempo (en unidades de S.k) de cada tema: tr = la luz recorre su dibujo · rise = se levanta de la página ·
// up = las piezas se proyectan sobre su iPad · out = se apagan. Física sale de la página del iPad principal; Historia y
// Biología se dibujan sobre sus iPads pequeños en cuanto aparecen, y los tres quedan proyectados a la vez.
const TW = [
  { tr: [0.05, 0.5], rise: [0.3, 1.0], up: [1.05, 1.7], out: [2.9, 3.2] },
  { tr: [1.45, 1.85], rise: [1.5, 1.9], up: [1.7, 2.25], out: [2.9, 3.2] },
  { tr: [1.5, 1.9], rise: [1.55, 1.95], up: [1.75, 2.3], out: [2.9, 3.2] },
];
// in = mientras el iPad se tumba, los temas se reparten en tres columnas · out = todo se apaga · back = el iPad vuelve al centro
const TRIO = { in: [1.1, 1.7], out: [2.9, 3.2], back: [3.05, 3.5] };
// tutor (3.05): el iPad se levanta con el panel del tutor · Fig. IV «Tu tutor ve lo que escribes» · LEO: Leonardo se
// materializa (Fig. V «Te enseña») · AV: el iPad se aparta y aparecen las siluetas de los avatares que vienen (Fig. VI)
const LEOW = [3.95, 4.55], AVW = [5.0, 5.6];
// FEW: transición sin texto (Leonardo y las siluetas se desarman, el iPad vuelve al centro) · FUNW: las funciones en tres
// pasos · PRIW: privacidad (frase que se enciende y 4 anotaciones) · al final el 3D se atenúa y siguen Planes y Preguntas
// PLW: planes (in = el iPad va a la izquierda y aparece el del tutor con Leonardo · out = se van) · luego Preguntas
const FEW = [5.85, 6.55], FUNW = [6.65, 8.45], PRIW = [8.55, 9.65], PLW = { in: [9.75, 10.25], out: [11.05, 11.35] }, DIMW = [11.35, 11.65], DIM = 0.8;
const PAD_A = -1.75, PAD_B = 1.55, LEO_P = new THREE.Vector3(3.3, FLOOR, 0.95);
const KEND = 11.7;
// shadeS: atenuado al final del recorrido · shadeF/fin: cierre (se tapa, cambia la escena y se destapa) · story: textos del recorrido
const view = { shadeS: 0, shadeF: 0, fin: 0, story: 1, nb: 0, fl: 0, intro: 1 };   // intro: 1 = la toma abierta de la mesa (antes del recorrido)   // nb: aparecen las páginas de Leonardo · fl: se voltean (apuntes de hoy)
const shadeEl = $('.shade'), panelsEl = $('.panels'), annosEl = $('.annos');
const planCards = [...document.querySelectorAll('.plan-layer .plan')], planNote = $('.plan-layer .note');
const toScreen = (vec) => { vec.project(camera); return [(vec.x * 0.5 + 0.5) * L.w, (-vec.y * 0.5 + 0.5) * L.h]; };
const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#story', start: 'top top', end: 'bottom bottom', scrub: touch ? 1.6 : 1 } });
tl.addLabel('tinta', 0.05).addLabel('sale', 0.45).addLabel('trio', 1.1).addLabel('tutor', 3.05).addLabel('leo', LEOW[0]).addLabel('avatar', AVW[0]).addLabel('funciones', FUNW[0]).addLabel('privacidad', PRIW[0])
  .to(S, { k: KEND, duration: KEND }, 0)
  .fromTo('.p1', { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -20, duration: 0.2, immediateRender: false }, 'trio-=0.1')
  .fromTo('.pT', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 'trio+=0.6')
  .to('.pT', { autoAlpha: 0, y: -20, duration: 0.2 }, 2.85)
  .fromTo('.p2', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 'tutor+=0.35')
  .to('.p2', { autoAlpha: 0, y: -20, duration: 0.2 }, 'leo-=0.1')
  .fromTo('.p3', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 'leo+=0.2')
  .to('.p3', { autoAlpha: 0, y: -20, duration: 0.2 }, 'avatar-=0.05')
  .fromTo('.pav', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 'avatar+=0.25')
  .to('.pav', { autoAlpha: 0, y: -20, duration: 0.2 }, FEW[0] - 0.1)
  .fromTo('.pF', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 'funciones-=0.15')
  .to('.pF', { autoAlpha: 0, y: -20, duration: 0.2 }, FUNW[1] - 0.05)
  .fromTo('.pP', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 'privacidad-=0.05')
  .to('.pP', { autoAlpha: 0, y: -20, duration: 0.2 }, PRIW[1] - 0.05)
  .fromTo('.pPl', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.25 }, PLW.in[1] - 0.1)
  .to('.pPl', { autoAlpha: 0, y: -20, duration: 0.2 }, PLW.out[0] - 0.05)
  .fromTo(view, { shadeS: 0 }, { shadeS: DIM, duration: DIMW[1] - DIMW[0] }, DIMW[0]);

// Portada: la mesa de la biblioteca con el título y el botón. Al bajar, el título se va, el iPad se levanta de la mesa y
// llega flotando a la biblioteca de los ventanales, donde ya entra «Tus ideas salen de la página» (.p1)
gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#intro', start: 'top top', end: 'bottom top', scrub: touch ? 1.6 : 1 } })
  .fromTo(view, { intro: 1 }, { intro: 0, duration: 1 }, 0)
  .to('.p0', { autoAlpha: 0, y: -30, filter: 'blur(6px)', duration: 0.2 }, 0.02)
  .fromTo('.p1', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.8);
const trioEl = $('.trio'), trioTitles = [...document.querySelectorAll('.trio-t')], trioLines = [...document.querySelectorAll('.trio-l')];
const TRIO_TOP = 3.3;                                 // altura de los títulos sobre cada iPad (en unidades del iPad grande)

// ---------- Resto de la página: funciones, la app, privacidad, planes, preguntas y cierre ----------
// Al entrar al contenido se apagan los textos del recorrido (el 3D sigue atenuado detrás de Planes y Preguntas)
gsap.timeline({ scrollTrigger: { trigger: '.content', start: 'top bottom', end: 'top 70%', scrub: true } }).to(view, { story: 0, ease: 'none' });
// Cierre: se tapa del todo, cambia a la escena del tutor (sin avatares, con el iPad) y se destapa con la llamada a descargar
gsap.timeline({ scrollTrigger: { trigger: '#finale', start: 'top bottom', end: 'top 20%', scrub: true } })
  .fromTo(view, { shadeF: DIM }, { shadeF: 1, ease: 'none', duration: 0.15, immediateRender: false }, 0)
  .fromTo(view, { fin: 0 }, { fin: 1, ease: 'none', duration: 0.05, immediateRender: false }, 0.16)
  .to(view, { shadeF: 0.15, ease: 'none', duration: 0.6 }, 0.25);
gsap.timeline({ scrollTrigger: { trigger: '#finale', start: 'top 45%', end: 'top top', scrub: true } })
  .fromTo('.end > *', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, stagger: 0.12, ease: 'power2.out', immediateRender: false });
gsap.timeline({ scrollTrigger: { trigger: '#finale', start: 'top 40%', end: 'bottom bottom', scrub: true } })
  .fromTo(view, { nb: 0 }, { nb: 1, ease: 'none', duration: 0.35, immediateRender: false }, 0)
  .fromTo(view, { fl: 0 }, { fl: 1, ease: 'none', duration: 0.5, immediateRender: false }, 0.45);
gsap.set('.end', { autoAlpha: 1 }); gsap.set('.end > *', { autoAlpha: 0 });
// Frase de privacidad: se enciende palabra por palabra con el recorrido
const pWords = (() => { const el = $('.pP .statement'); el.innerHTML = el.textContent.split(' ').map((w) => `<span class="w">${w}</span>`).join(' '); return [...el.querySelectorAll('.w')]; })();
let pLit = -1;
// Apariciones suaves
if (!reduce) {
  gsap.set('.reveal', { opacity: 0, y: 40 });
  ScrollTrigger.batch('.reveal', { start: 'top 88%', onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out', overwrite: true }) });
}

// Funciones: cada ficha se ancla a un punto de la pantalla (px de la captura que se ve en su paso) y va a la columna
// izquierda o derecha del iPad; en vertical se apilan abajo, sin líneas
const featSvg = $('.feat-lines'), featSteps = [...document.querySelectorAll('.feat-steps li')], SVGNS = 'http://www.w3.org/2000/svg';
const callouts = [...document.querySelectorAll('.callout')].map((el) => {
  const [x, y] = el.dataset.at.split(',').map(Number), path = document.createElementNS(SVGNS, 'path'), d = document.createElementNS(SVGNS, 'circle'), c = document.createElementNS(SVGNS, 'circle');
  d.setAttribute('r', 5); d.setAttribute('class', 'd'); c.setAttribute('r', 1.6); c.setAttribute('class', 'c');
  featSvg.append(path, d, c);
  return { el, g: +el.dataset.g, side: el.dataset.side, local: px(x, y).setZ(D / 2 + 0.004), path, d, c };
});
let featOn = false, featStep = -1;
const band = { t: -1, b: 0 };                         // en vertical: franja libre para el iPad en Funciones/Privacidad
const fv = new THREE.Vector3();
function featFrame(fp, k) {
  featOn = true;
  const vis = seg(k, FUNW[0] - 0.12, FUNW[0] + 0.05) * (1 - seg(k, FUNW[1] - 0.05, FUNW[1] + 0.05));
  const pv = seg(k, PRIW[0] + 0.05, PRIW[0] + 0.25) * (1 - seg(k, PRIW[1] - 0.1, PRIW[1]));
  featSvg.style.opacity = Math.max(vis, pv);
  const gw = [(1 - seg(fp, 0.3, 0.36)) * vis, seg(fp, 0.31, 0.37) * (1 - seg(fp, 0.63, 0.69)) * vis, seg(fp, 0.64, 0.7) * vis, pv];
  const step = fp < 0.335 ? 0 : fp < 0.665 ? 1 : 2;
  if (step !== featStep) { featStep = step; featSteps.forEach((li, i) => li.classList.toggle('on', i === step)); }
  const toScr = (vec) => { fv.copy(vec).project(camera); return [(fv.x * 0.5 + 0.5) * L.w, (-fv.y * 0.5 + 0.5) * L.h]; };
  const [ixL] = toScr(tw.set(-W / 2, 0, 0).applyMatrix4(ipad.matrixWorld)), [ixR] = toScr(tw.set(W / 2, 0, 0).applyMatrix4(ipad.matrixWorld));
  const gap = 56;
  [0, 1, 2, 3].forEach((g) => {
    const o = gw[g];
    const mine = callouts.filter((c) => c.g === g);
    mine.forEach((c) => { c.el.style.opacity = o; c.el.style.visibility = o > 0.002 ? 'visible' : 'hidden'; c.path.style.opacity = c.d.style.opacity = c.c.style.opacity = L.portrait ? 0 : o; });
    if (o < 0.002) return;
    if (L.portrait) {                                  // en vertical: las fichas apiladas abajo
      let y = L.h - 20;
      [...mine].reverse().forEach((c) => { y -= c.el.offsetHeight; c.el.style.transform = `translate(0px,${y}px)`; y -= 10; });
      return;
    }
    const minY = $(g === 3 ? '.pP' : '.pF').getBoundingClientRect().bottom + 24;
    for (const side of ['l', 'r']) {
      const list = mine.filter((c) => c.side === side);
      list.forEach((c) => { c.dot = toScr(tw.copy(c.local).applyMatrix4(ipad.matrixWorld)); c.h = c.el.offsetHeight; c.w = c.el.offsetWidth; });
      list.sort((p, q) => p.dot[1] - q.dot[1]);
      let y = side === 'l' ? minY : 84;                 // a la izquierda, por debajo del título
      list.forEach((c) => { c.y = Math.max(y, c.dot[1] - c.h / 2); y = c.y + c.h + 16; });
      const over = y - 16 - (L.h - 24); if (over > 0) list.forEach((c) => { c.y -= over; });
      list.forEach((c) => {
        const bx = side === 'l' ? Math.min(ixL, ixR) - gap - c.w : Math.max(ixL, ixR) + gap, ey = c.y + c.h / 2, ex = side === 'l' ? bx + c.w : bx;
        c.el.style.transform = `translate(${bx}px,${c.y}px)`;
        const [dx, dy] = c.dot, kx = side === 'l' ? ex + 18 : ex - 18;
        c.path.setAttribute('d', `M${dx},${dy} L${kx},${ey} L${ex},${ey}`);
        c.d.setAttribute('cx', dx); c.d.setAttribute('cy', dy); c.c.setAttribute('cx', dx); c.c.setAttribute('cy', dy);
      });
    }
  });
}

const annos = [...document.querySelectorAll('[data-anchor]')].map((el) => ({ el, key: el.dataset.anchor, sp: el.querySelector(':scope > span'), home: el.classList.contains('left') }));
const v = new THREE.Vector3(), tgt = new THREE.Vector3(), wp = new THREE.Vector3();
function anchor(key) {
  if (key === 'ipad') return v.set(W / 2 - 0.1, H / 2 - 0.1, D / 2).applyMatrix4(ipad.matrixWorld);
  if (key === 'ink') return v.set(-SW * 0.36, -SH * 0.22, 0).applyMatrix4(parts[2].group.matrixWorld);
  if (key === 'screen') return v.copy(px(880, 470)).setZ(D / 2).applyMatrix4(ipad.matrixWorld);          // el panel del tutor en la pantalla
  if (key === 'head') return v.set(LEO.x + 0.05, LEO.y + LEO_H * 1.04, LEO.z);
  if (key === 'leo2') key = 'leo';
  if (key.startsWith('av')) return v.set(0, 1.62, 0).applyMatrix4(avatars[+key[2]].g.matrixWorld);
  return v.set(LEO.x, LEO.y + LEO_H * 0.92, LEO.z);
}

const clock = new THREE.Clock(), tmpC = new THREE.Color();
const hm = new THREE.Vector3(), stage = new THREE.Vector3(), tw = new THREE.Vector3(), tl_ = new THREE.Vector3(), qInk = new THREE.Quaternion(), qW = new THREE.Quaternion(), qL = new THREE.Quaternion(), eul = new THREE.Euler();
function frame() {
  const t = clock.getElapsedTime(), k = S.k;
  const a = seg(k, 0.05, 1), d = seg(k, TW[0].up[0], TW[0].up[1]), b = seg(k, 3.05, 3.7);    // a: la tinta se levanta · d: el iPad se tumba · b: el iPad se levanta con el tutor
  const lv = seg(k, ...LEOW), fe = seg(k, ...FEW) * (1 - view.fin), fp = seg(k, FUNW[0] + 0.1, FUNW[1] - 0.1), plo = seg(k, ...PLW.out), plM = seg(k, ...PLW.in) * (1 - plo) * fe, avs = seg(k, ...AVW) * (1 - Math.max(view.fin, fe));                         // lv: Leonardo · avs: los avatares (no en el cierre)
  const g3 = seg(k, ...TRIO.in), g3o = seg(k, ...TRIO.out), gg = g3 * (1 - seg(k, ...TRIO.back));   // gg: cuánto estamos en las tres columnas
  const tp = TW.map((w) => ({ tr: seg(k, ...w.tr), rise: seg(k, ...w.rise), up: seg(k, ...w.up), out: seg(k, ...w.out) }));
  mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05;
  const ip = mesa ? 1 - view.intro : 1, IN = 1 - seg(ip, 0.04, 0.86), camI = 1 - seg(ip, 0.0, 0.7);   // IN: el iPad sigue sobre la mesa · camI: encuadre centrado de la toma abierta

  // iPad flotando
  rig.position.y = reduce ? 0 : Math.sin(t * 0.8) * 0.05 * (1 - IN);
  // el iPad se desliza al suelo y queda boca arriba (f); al llegar el tutor vuelve a levantarse
  const f = d * (1 - b), sc = lerp(1, CS, gg);       // sc: al tumbarse, el iPad se encoge y pasa a la columna izquierda
  ipad.scale.setScalar(sc);
  ipad.rotation.set(lerp(lerp(-0.06, -0.14, a) + (reduce ? 0 : Math.sin(t * 0.6) * 0.012), -Math.PI / 2, f), lerp(lerp(-0.5, -0.2, a) + lerp(0, 0.42, b) + (reduce ? 0 : mouse.sx * 0.1), 0, f), lerp(lerp(lerp(0.035, 0, a), -0.3, f), TRIO_RZ, gg));
  ipad.position.set(f * (L.portrait ? 0.1 : 0.55) - COL * gg, f * (FLOOR + D / 2 * sc + 0.03 - rig.position.y) + avs * 6, f * (L.portrait ? 0.6 : 0.9));   // avs: se aparta hacia arriba
  ipad.visible = avs < 0.98;
  if (fe > 0.001) {                                   // Funciones: de pie al centro, girando despacio con el avance
    ipad.rotation.set(lerp(ipad.rotation.x, -0.05, fe), lerp(ipad.rotation.y, -0.2 + 0.32 * fp + (reduce ? 0 : mouse.sx * 0.08), fe), lerp(ipad.rotation.z, 0, fe));
    const dk = seg(k, ...DIMW) * fe;                  // Preguntas: el iPad se aparta a la derecha, detrás del texto no
    ipad.position.x += dk * (L.portrait ? 0 : 3.1) + plM * PAD_A * (L.portrait ? 0.55 : 1); ipad.rotation.y += -dk * 0.45 + plM * 0.2;
  }
  // tinta de cada tema: la luz recorre su dibujo, se levanta de la página y, al terminar el tema, se apaga
  for (const s of strokes) {
    const u = s.userData, T = tp[u.topic], p = clamp((T.tr - u.t0 * 0.55) / 0.45, 0, 1);
    s.geometry.setDrawRange(0, Math.floor(u.count * p / 3) * 3);
    s.position.z = (u.lift - 0.9) * T.rise * 0.45 + (reduce ? 0 : Math.sin(t * 0.9 + u.lift * 5) * 0.025 * T.rise);
    s.material.opacity = (1 - T.out) * (1 - b);
    s.visible = p > 0 && T.out < 0.99 && b < 0.99;
  }
  inks.forEach((ink, i) => {                          // el dibujo crece desde su propio centro y queda flotando sobre la página
    const T = tp[i], sc = lerp(1, 1.5, T.rise), P0 = PIVOT[i];
    ink.scale.setScalar(sc);
    ink.position.set(P0.x * (1 - sc) - (L.portrait ? 0.1 : 0.62) * T.rise, P0.y * (1 - sc) + (L.portrait ? 1.0 : 0.62) * T.rise, D / 2 + 0.012 + 0.85 * T.rise);
    ink.rotation.y = T.rise * (0.3 + (reduce ? 0 : Math.sin(t * 0.5) * 0.14));
  });
  // descomposición: las piezas de cada tema se proyectan en una fila sobre el iPad, de pie y mirando a la cámara
  ipad.updateMatrixWorld(true);
  stage.setFromMatrixPosition(ipad.matrixWorld);
  const pitch = L.portrait ? 0.62 : 1;
  const baseX = stage.x + COL * gg, colX = (ti) => baseX + (ti - 1) * COL * gg;     // centro de cada columna (Física, Historia, Biología)
  parts.forEach((p, i) => {
    const T = tp[p.topic], ink = inks[p.topic], vis = (1 - T.out) * (1 - b), cx = colX(p.topic);
    ink.getWorldQuaternion(qInk).invert();
    tw.set(cx + p.at[0] * pitch * sc, stage.y + p.at[1] * sc, stage.z + p.at[2] * sc);   // destino en el mundo: arriba de su iPad
    tl_.copy(tw); ink.worldToLocal(tl_);                                            // …pasado al espacio local de su tinta
    // punto de partida: su página. Historia y Biología cuelgan del iPad principal, así que su página es la de su iPad pequeño
    hm.copy(p.home); if (p.topic) { ink.localToWorld(hm); hm.x += cx - stage.x; ink.worldToLocal(hm); }
    p.group.position.lerpVectors(hm, tl_, T.up);
    eul.set(0, T.up * p.spin * 0.5 + (reduce ? 0 : Math.sin(t * 0.7 + p.spin * 4) * 0.06 * T.up), 0);
    qW.setFromEuler(eul); qL.copy(qInk).multiply(qW);                               // orientación: de pie, mirando a la cámara
    p.group.quaternion.identity().slerp(qL, T.up);
    p.group.scale.setScalar(1 - 0.2 * T.out);
    const pl = p.plate, m = pl.mesh;
    m.position.lerpVectors(pl.homeRel, pl.hoverRel, T.up);                          // el término vuela de la página hasta su dibujo
    m.scale.setScalar(lerp(1, pl.scale, T.up));
    m.material.opacity = seg(T.rise, 0.18, 0.55) * vis; m.visible = m.material.opacity > 0.01;
  });
  // iPads pequeños (Historia al centro, Biología a la derecha), boca arriba junto al principal
  const mv = seg(k, 1.3, 1.7) * (1 - g3o);
  minis.forEach((m, i) => {
    m.g.visible = mv > 0.001;
    if (!m.g.visible) return;
    m.g.position.set(colX(i + 1), stage.y, stage.z); m.g.scale.setScalar(sc * lerp(0.88, 1, mv));
    m.mats.forEach((mt) => { mt.opacity = mv; });
  });
  // pantallas: Física → Historia → Biología (real) → panel del tutor (real)
  // el principal muestra Física y, al llegar el tutor, el panel del tutor (real). En Funciones: cuaderno → biblioteca → tutor
  const g1 = seg(fp, 0.3, 0.37), g2 = seg(fp, 0.63, 0.7);
  screens[2].material.opacity = fe; screens[4].material.opacity = fe * g1 * (1 - g2);
  screens[3].material.opacity = Math.max(b * (1 - fe), fe * g2 * (1 - seg(k, ...PLW.in)));   // en Planes el principal muestra el cuaderno solo screens[4].material.color.setScalar(1.04);
  const dim = lerp(1.04, lerp(0.7, 0.46, d), tp[0].rise * (1 - b));                  // la página se atenúa para que la luz destaque
  for (let i = 0; i < 3; i++) screens[i].material.color.setScalar(dim * (1 - 0.3 * IN));   // en la toma abierta la pantalla no deslumbra
  motes.m.material.opacity = a * 0.9 * (1 - b * 0.7);
  if (a > 0.01) {
    for (let i = 0; i < motes.n; i++) { const m = motes.seed[i], z = (m.z + t * m.s * 0.5) % 2.4; motes.pos[i * 3] = m.x + Math.sin(t * 0.6 + m.p) * 0.06; motes.pos[i * 3 + 1] = m.y + Math.cos(t * 0.5 + m.p) * 0.06; motes.pos[i * 3 + 2] = z; }
    motes.m.geometry.attributes.position.needsUpdate = true;
  }
  screenLight.intensity = lerp(3.2, 4.2, a) * (1 - 0.55 * f);

  // Leonardo
  const lvP = seg(k, PLW.in[0] + 0.2, PLW.in[1] + 0.25) * (1 - plo) * fe;           // en Planes vuelve junto al iPad del tutor
  const lvE = Math.max(lv * (1 - fe), lvP);          // en Funciones se desarma (vuelve el iPad al centro)
  const LP = fe > 0.5 ? LEO_P : LEO;
  leo.position.copy(LP); leoScan.position.x = LP.x; leoScan.position.z = LP.z; leoLight.position.set(LP.x + 0.9, FLOOR + 1.9, LP.z + 1.8);
  leo.rotation.y = fe > 0.5 ? rad(-24) : rad(28);
  leo.visible = lvE > 0.001;
  leoClip.constant = FLOOR - 0.01 + (LEO_H + 0.12) * lvE;
  leoScan.position.y = Math.min(leoClip.constant, FLOOR + LEO_H + 0.05); leoScan.material.opacity = seg(lvE, 0, 0.06) * (1 - seg(lvE, 0.86, 1)) * 0.9;
  leoScan.scale.setScalar(1 - 0.35 * seg(leoScan.position.y - FLOOR, 1.2, 2.0));
  leoLight.intensity = 2.6 * lvE;
  avatars.forEach((av, i) => {                        // las siluetas crecen una tras otra
    const si = seg(avs, i * 0.18, i * 0.18 + 0.5);
    av.g.visible = si > 0.001;
    av.inner.scale.set(1, Math.max(0.0001, si), 1);
    av.inner.position.y = reduce ? 0 : Math.sin(t * 1.2 + i) * 0.02 * si;
    av.ring.scale.setScalar(0.4 + si * 0.6);
  });
  leo.rotation.y += reduce ? 0 : Math.sin(t * 0.5) * 0.08;

  // cámara · nar: pantallas horizontales más angostas que 16:9 (iPad, 4:3…) → la escena se abre y se corre a la derecha para no pisar el texto
  const nar = L.portrait ? 0 : clamp((1.78 - camera.aspect) / 0.45, 0, 1);
  const needH = lerp(L.portrait ? lerp(lerp(7.0, 6.2, a), 7.6, b) : lerp(lerp(4.9, 3.5, a), 5.5, b), 5.6, f), needW = lerp(L.portrait ? lerp(lerp(lerp(3.6, 3.3, a), 6.0, b), 6.4, avs) : lerp(lerp(lerp(7.5, 5.6, a), 9.2 + 2.6 * nar, b), 10.4 + 1.6 * nar, avs), L.portrait ? 4.6 : 7.6, f);
  // en vertical, Funciones y Privacidad: el iPad cabe justo entre el título (arriba) y las fichas apiladas (abajo)
  if (L.portrait && fe > 0.001) {
    const pv = k > PRIW[0] - 0.05, grp = pv ? 3 : featStep < 0 ? 0 : featStep;
    const top = $(pv ? '.pP' : '.pF').getBoundingClientRect().bottom + 16;
    let hc = 0, n = 0; callouts.forEach((c) => { if (c.g === grp) { hc += c.el.offsetHeight; n++; } });
    const bot = L.h - 20 - hc - 10 * (n - 1) - 18;
    if (band.t < 0) { band.t = top; band.b = bot; } else { band.t += (top - band.t) * 0.15; band.b += (bot - band.b) * 0.15; }
  }
  const bandH = Math.max(80, band.b - band.t), fbH = H * 1.12 * L.h / bandH, fbY = (L.h / 2 - (band.t + band.b) / 2) / L.h;
  const oy = lerp(lerp(lerp(0.13, 0.06, gg), fbY, fe), 0, plM) * (1 - camI);      // en vertical, cuánto se sube la vista (deja sitio al texto de abajo)
  // en el cierre se aleja para ver las tres columnas (ancho fijo, centrado: ya no hay texto a la izquierda)
  const dist = Math.max(lerp(lerp(lerp(needH, TRIO_H, gg), L.portrait ? fbH : 4.7 + 0.9 * nar, fe), L.portrait ? 8.4 : 6.0, plM) / (2 * L.tan), lerp(lerp(lerp(needW, L.portrait ? 10.2 : TRIO_W, gg), L.portrait ? 2.9 : 3.0, fe), L.portrait ? 5.0 : 9.6, plM) / (2 * L.tan * camera.aspect));
  const el = rad((PHOTO ? lerp(lerp(3.5, 4.5, a), 4.5, b) : lerp(lerp(5, 11, a), 7, b)) + f * 19 + gg * 3 - (reduce ? 0 : mouse.sy * 2.5)), az = rad(lerp(lerp(lerp(-4, 16, a), -6, b), 0, gg) + (reduce ? 0 : mouse.sx * 5));
  tgt.set(lerp(lerp(lerp(0, 0.15, d), -1.0, b), -0.35, avs), lerp(lerp(lerp(-0.25, 0.05, a), -0.62, b), -0.85, avs), lerp(0, 0.3, a));
  tgt.lerp(tw.set(stage.x, FLOOR + 1.25, stage.z), f);
  tgt.lerp(tw.set(baseX, FLOOR + 0.75, stage.z), gg);
  tgt.lerp(tw.set(0, L.portrait ? rig.position.y : -0.05, 0), fe);
  tgt.lerp(tw.set(L.portrait ? 0 : 0.75, L.portrait ? -1.1 : -0.55, 0), plM);
  camera.position.set(tgt.x + dist * Math.sin(az) * Math.cos(el), tgt.y + dist * Math.sin(el), tgt.z + dist * Math.cos(az) * Math.cos(el));
  camera.lookAt(tgt);
  const xo = L.portrait ? 0 : (1 - camI) * lerp(lerp(lerp(lerp(lerp(0.17, 0.15, a), 0.12 + 0.13 * nar, b), 0, gg), 0.05, fe), 0, plM);     // la vista se corre para dejar sitio al texto
  if (L.portrait) camera.setViewOffset(L.w, L.h, 0, L.h * oy, L.w, L.h);
  else camera.setViewOffset(L.w, L.h, -L.w * xo, PHOTO ? -L.h * 0.08 : 0, L.w, L.h);

  // fondos: cada foto se coloca para que el borde de su mesa coincida con el horizonte del 3D
  if (PHOTO) {
    const o = L.portrait ? oy : -0.08, te = Math.tan(el), Dd = 80;
    const above = L.tan * (1 - 2 * o) - te, below = L.tan * (1 + 2 * o) + te, halfW = L.tan * camera.aspect + 0.035;
    const fx = xo;
    const w = [1, seg(k, 0.45, 0.8), seg(k, 1.5, 1.9)];                      // biblioteca → aula → casa
    places.forEach((m, i) => {
      const hp = m.userData.hp, Hh = Math.max(below / (1 - hp), above / hp, halfW / 0.75) * Dd * 1.03;
      m.scale.set(Hh, Hh, 1);
      m.position.set(-2 * fx * L.tan * camera.aspect * Dd - Math.sin(az) * Dd * 0.1, Dd * te - (0.5 - hp) * Hh, -Dd);
      m.material.opacity = w[i] * (1 - 0.5 * f - 0.15 * gg) * (1 - 0.6 * fe);       // en Funciones y Privacidad solo se atenúa el fondo
      m.visible = w[i] > 0.001 && (i === places.length - 1 || w[i + 1] < 0.999);
    });
    let now = 0; w.forEach((x, i) => { if (x > 0.5) now = i; });
    if (now !== placeNow && placeEl) { placeNow = now; placeEl.classList.add('out'); setTimeout(() => { placeEl.textContent = places[now].userData.label; placeEl.classList.remove('out'); }, 250); }
  }

  // portada: la foto de la mesa se acerca (sobre el iPad) y se funde con la biblioteca; el iPad se levanta de la mesa y vuela a su lugar
  if (mesa) {
    const op = 1 - seg(ip, 0.42, 0.88), oyE = L.portrait ? oy : 0;
    mesa.visible = op > 0.001; FU.uFade.value = seg(ip, 0.5, 0.95); mesa.userData.refl.visible = false;
    places[0].material.color.setScalar(0.78 * lerp(0.35, 1, seg(ip, 0.55, 0.98)));         // la biblioteca entra desde la penumbra
    if (mesa.visible || IN > 0.001) {
      const SX = L.portrait ? 0 : L.w * 0.1 * clamp((camera.aspect - 1.2) / 0.4, 0, 1), sxE = SX * (1 - seg(ip, 0, 0.75));             // en horizontal la mesa va a la derecha y deja sitio al título
      const Dd2 = 60, r = 1.5, Ph = L.portrait ? L.h * 0.8 : Math.max(L.h, L.w / r), syE = L.portrait ? (L.h - Ph) / 2 * (1 - seg(ip, 0, 0.75)) : 0, Pw = Ph * r, Z = 1 + 1.6 * seg(ip, 0, 0.9) ** 1.6, hW = Ph / L.h * 2 * L.tan * Dd2;
      const cx0 = -2 * xo * L.tan * camera.aspect, cy0 = -2 * oyE * L.tan;                // centro de la vista en el espacio de la cámara (por profundidad)
      mesa.scale.set(hW * Z, hW * Z, 1); mesa.rotation.z = 0.045 * seg(ip, 0, 0.7);        // acercamiento con un leve giro de cámara
      mesa.material.color.setScalar(0.86 * (1 - 0.55 * seg(ip, 0.28, 0.62)));               // y se va a penumbra                                                 // la geometría ya mide 1.5 × 1
      mesa.position.set(cx0 * Dd2 + sxE / (L.w / 2) * L.tan * camera.aspect * Dd2 - (MESA.u - 0.5) * hW * r * (Z - 1), cy0 * Dd2 + syE / (L.h / 2) * L.tan * Dd2 + (MESA.v - 0.5) * hW * (Z - 1), -Dd2);
      mesa.material.opacity = op;
      if (IN > 0.001) {
        const hp = MESA.h * Ph * Z, Dp = H * L.h / (2 * L.tan * hp);                       // a qué distancia el iPad mide lo que debe medir en la foto
        const bx = (MESA.u - 0.5) * Pw + (MESA.bu - MESA.u) * Pw * Z, by = (MESA.v - 0.5) * Ph + (MESA.bv - MESA.v) * Ph * Z;
        const cxp = bx + sxE, cyp = by - syE, R = mesa.userData.refl, k2 = Dp + 0.6, lift = 1 - IN;
        R.visible = true; R.material.opacity = 0.9 * IN * op;                              // sombra: se aleja y se desvanece cuando el iPad se levanta
        R.scale.set(W * 1.6 * (1 + lift) * k2 / Dp, H * 1.43 * (1 + lift) * k2 / Dp, 1); R.rotation.set(MESA.tilt, 0, MESA.rz, 'XZY');
        R.position.set((cx0 * Dp + (cxp + hp * (0.05 + 0.3 * lift)) / (L.w / 2) * L.tan * camera.aspect * Dp) * k2 / Dp, (cy0 * Dp - (cyp + hp * (0.05 + 0.3 * lift)) / (L.h / 2) * L.tan * Dp) * k2 / Dp, -k2);
        camera.updateMatrixWorld();
        tw.set(cx0 * Dp + cxp / (L.w / 2) * L.tan * camera.aspect * Dp, cy0 * Dp - cyp / (L.h / 2) * L.tan * Dp, -Dp).applyMatrix4(camera.matrixWorld);
        const w = IN, e = w * w * (3 - 2 * w), hx = ipad.position.x, hy = ipad.position.y + rig.position.y, hz = ipad.position.z;
        qW.setFromEuler(ipad.rotation); eul.set(MESA.tilt + (reduce ? 0 : -mouse.sy * 0.06), 0, MESA.rz + (reduce ? 0 : mouse.sx * 0.06), 'XZY'); qL.copy(camera.quaternion).multiply(qInk.setFromEuler(eul));
        ipad.position.set(lerp(hx, tw.x, e), lerp(hy, tw.y, e) - rig.position.y + Math.sin(Math.PI * e) * 0.7, lerp(hz, tw.z, e));
        ipad.quaternion.slerpQuaternions(qW, qL, e);
        if (!reduce) { tl_.set(0, 0, 1).applyQuaternion(camera.quaternion); ipad.quaternion.premultiply(qInk.setFromAxisAngle(tl_, Math.sin(Math.PI * e) * 0.22)); }   // un giro al volar
        ipad.updateMatrixWorld(true);
      }
    }
  }
  // suelo y enfoque
  ipad.getWorldPosition(wp);
  wp.x = lerp(wp.x, baseX, gg);                       // en el cierre, el centro del suelo y el enfoque van a la columna del medio
  FU.uCenter.value.set(wp.x, wp.z); FU.uTime.value = t;
  FU.uLeo.value.set(leo.position.x, leo.position.z, lvE);
  bokeh.uniforms.focus.value = camera.position.distanceTo(wp) - 0.2;
  { const rf = mesa ? Math.sin(Math.PI * seg(ip, 0.15, 0.9)) : 0; bokeh.uniforms.aperture.value = 0.00009 * (1 + 7 * rf); bokeh.uniforms.maxblur.value = 0.006 + 0.012 * rf; }   // cambio de foco cinematográfico en la entrada
  bloom.strength = lerp(0.35, 0.5, a) * (1 - 0.75 * IN);   // en la mesa, sin destellos en el canto del iPad

  const show = S.in;
  for (const an of annos) {
    const p = anchor(an.key).project(camera), K = an.key;
    let ax = (p.x * 0.5 + 0.5) * L.w;
    if (K === 'head') {                               // la burbuja no se sale: se corre y su pico sigue apuntando a la cabeza
      const bw = an.el.firstElementChild.offsetWidth, cx = clamp(ax, bw / 2 + 12, L.w - bw / 2 - 12);
      an.el.style.setProperty('--ax', `${ax - cx}px`); ax = cx;
    } else if (an.sp) {                               // la etiqueta cambia de lado si no cabe (y vuelve al suyo cuando cabe)
      const sw = an.sw || (an.sw = an.sp.offsetWidth), fitsL = ax - 30 - sw > 8, fitsR = ax + 30 + sw < L.w - 8;
      an.el.classList.toggle('left', an.home ? fitsL || !fitsR : !fitsR && fitsL);
    }
    an.el.style.transform = `translate(${ax}px,${(-p.y * 0.5 + 0.5) * L.h}px)`;
    an.el.style.opacity = K === 'ipad' ? show * (1 - seg(k, 0.1, 0.4)) * (mesa ? seg(1 - view.intro, 0.85, 1) : 1)
      : K === 'ink' ? show * seg(k, 0.6, 0.9) * (1 - seg(k, 1.0, 1.15)) * (L.portrait ? 0 : 1)
      : K === 'screen' ? seg(k, 3.5, 3.75) * (1 - seg(k, 3.85, 4.0))
      : K === 'head' ? seg(k, 4.35, 4.6) * (1 - seg(k, 4.9, 5.05))                         // burbuja con citas
      : K === 'leo2' ? seg(k, 5.3, 5.55) * (1 - seg(k, FEW[0] - 0.1, FEW[0] + 0.1)) * (1 - view.fin)
      : K.startsWith('av') ? seg(k, 5.35 + +K[2] * 0.08, 5.6 + +K[2] * 0.08) * (1 - seg(k, FEW[0] - 0.1, FEW[0] + 0.1)) * (1 - view.fin)
      : seg(k, 4.3, 4.55) * (1 - seg(k, 4.9, 5.05));
  }
  // títulos de columna (FÍSICA │ HISTORIA │ BIOLOGÍA) y las dos líneas verticales que las separan
  { const tv = seg(k, 1.6, 1.95) * (1 - g3o);
    trioEl.style.opacity = tv;
    if (tv > 0.001) {
      const toPx = (x, y, z) => { v.set(x, y, z).project(camera); return [(v.x * 0.5 + 0.5) * L.w, (-v.y * 0.5 + 0.5) * L.h]; };
      const top = stage.y + TRIO_TOP * sc;
      trioTitles.forEach((el, i) => { const [x, y] = toPx(colX(i), top, stage.z); el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`; });
      trioLines.forEach((el, i) => {
        const gx = baseX + (i - 0.5) * COL * gg, [x, y0] = toPx(gx, top + 0.15, stage.z), [, y1] = toPx(gx, stage.y, stage.z + 1.3);
        el.style.transform = `translate(${x}px,${y0}px)`; el.style.height = `${Math.max(0, y1 - y0)}px`;
      });
    } }
  if (fe > 0.01 && k > FUNW[0] - 0.2 && k < PRIW[1] + 0.05) featFrame(fp, k); else if (featOn) { featOn = false; callouts.forEach((c) => { c.el.style.opacity = 0; c.el.style.visibility = 'hidden'; }); featSvg.style.opacity = 0; }
  { const lit = Math.round(seg(k, PRIW[0] + 0.1, PRIW[0] + 0.7) * pWords.length);       // frase de privacidad
    if (lit !== pLit) { pLit = lit; pWords.forEach((w, i) => w.classList.toggle('on', i < lit)); } }
  const shade = view.fin > 0.001 || view.shadeF > DIM + 0.001 ? view.shadeF : view.shadeS;
  // Planes: el iPad del tutor y las fichas, delante de cada iPad
  { const pv = seg(k, PLW.in[0] + 0.1, PLW.in[1]) * (1 - plo) * fe;
    planPad.g.visible = pv > 0.001;
    if (planPad.g.visible) {
      planPad.g.position.set(PAD_B * (L.portrait ? 0.55 : 1), rig.position.y - (1 - pv) * 0.25, 0); planPad.g.rotation.set(-0.05, -0.2 + (reduce ? 0 : mouse.sx * 0.08), 0);
      planPad.g.scale.setScalar(L.portrait ? 0.62 : 1); planPad.mats.forEach((m) => { m.opacity = pv; });
      planPad.g.updateMatrixWorld(true);
    }
    const pc = seg(k, PLW.in[1], PLW.in[1] + 0.2) * (1 - seg(k, PLW.out[0] - 0.1, PLW.out[0] + 0.05)) * fe;
    planNote.style.opacity = pc; placeEl && placeEl.style.setProperty('--po', 1 - pc);   // la etiqueta del lugar no pisa la nota del precio
    planCards.forEach((el, i) => {
      el.style.opacity = pc; el.style.visibility = pc > 0.002 ? 'visible' : 'hidden';
      if (pc < 0.002) return;
      const [x, y] = toScreen(tw.set(0, -H * 0.2, D / 2).applyMatrix4(i ? planPad.g.matrixWorld : ipad.matrixWorld));
      if (L.portrait) {                               // en vertical: lado a lado, debajo del iPad más bajo
        const yb = Math.max(...[ipad, planPad.g].map((o) => toScreen(tw.set(0, -H / 2, D / 2).applyMatrix4(o.matrixWorld))[1]));
        el.style.transform = `translate(${i ? L.w / 2 + 5 : 10}px,${yb + 16}px)`;
      } else el.style.transform = `translate(${x - el.offsetWidth / 2}px,${y - el.offsetHeight * 0.35}px)`;
    }); }
  // cierre: las páginas de Leonardo llegan flotando y, una tras otra, se voltean y son apuntes de hoy
  codex.forEach((p, i) => {
    const e = seg(view.nb, i * 0.08, i * 0.08 + 0.55) * view.fin, fl = seg(view.fl, i * 0.09, i * 0.09 + 0.5);
    p.g.visible = e > 0.001;
    if (!p.g.visible) return;
    const [x, y, z, ry, rz] = L.portrait ? p.sp : p.s;
    p.g.scale.setScalar(L.portrait ? 0.85 : 1);
    p.g.position.set(x > 1 ? x - 0.45 * nar : x, y + (1 - e) * 0.8 + (reduce ? 0 : Math.sin(t * 0.6 + i * 1.7) * 0.06), z - (1 - e) * 1.5);
    p.g.rotation.set(reduce ? 0 : Math.sin(t * 0.4 + i) * 0.05, ry + fl * Math.PI + (reduce ? 0 : Math.sin(t * 0.3 + i * 2) * 0.06), rz);
    p.mats.forEach((m) => { m.opacity = e; });
  });
  shadeEl.style.opacity = shade;
  panelsEl.style.opacity = annosEl.style.opacity = view.story;
  const reading = view.story < 0.5 && shade > 0.3; if (reading !== document.body.classList.contains('reading')) document.body.classList.toggle('reading', reading);
  if (shade < 0.999) composer.render();         // tapado por el contenido: no se dibuja (ahorra batería)
  requestAnimationFrame(frame);
}
// Logo: vuelve al principio de esta página. Menú: desplazamiento suave a cada sección (sin scroll-behavior en CSS: descuadra ScrollTrigger)
$('.brand').addEventListener('click', (e) => { e.preventDefault(); scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' }); });
document.querySelectorAll('.bar nav a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  let top;
  if (a.dataset.k) { const st = tl.scrollTrigger; top = st.start + (+a.dataset.k / KEND) * (st.end - st.start); }
  else { const el = $(a.getAttribute('href')); if (!el) return; top = el.getBoundingClientRect().top + scrollY; }
  scrollTo({ top, behavior: reduce ? 'instant' : 'smooth' });
}));

// ---------- Citas de la burbuja de Leonardo ----------
const quotes = [
  ['La sabiduría es hija de la experiencia.', 'Leonardo da Vinci'],
  ['Así como el hierro se oxida sin uso, el ingenio sin ejercicio se echa a perder.', 'Leonardo da Vinci'],
  ['La raíz de la educación es amarga, pero su fruto es dulce.', 'Aristóteles'],
  ['Estudio por ver si con estudiar ignoro menos.', 'Sor Juana Inés de la Cruz'],
  ['La educación es el arma más poderosa que puedes usar para cambiar el mundo.', 'Nelson Mandela'],
];
{ const qEl = $('#quote'); let qi = 0;
  if (!reduce) setInterval(() => {
    qEl.classList.add('out');
    setTimeout(() => { qi = (qi + 1) % quotes.length; qEl.innerHTML = `«${quotes[qi][0]}»<cite>${quotes[qi][1]}</cite>`; qEl.classList.remove('out'); }, 350);
  }, 5500); }

// ---------- Entrada: espera a Leonardo y precalienta el 3D (shaders y texturas) detrás de la pantalla de carga ----------
await leoReady;
{
  const hid = [leo, ...avatars.map((x) => x.g), ...minis.map((m) => m.g)].map((o) => [o, o.visible]);
  hid.forEach(([o]) => { o.visible = true; });
  renderer.compile(scene, camera);
  scene.traverse((o) => { const m = o.material; if (m && m.map) renderer.initTexture(m.map); });
  hid.forEach(([o, vis]) => { o.visible = vis; });
}
frame();
progress(1);
gsap.timeline({ delay: 0.5 })
  .to('#loader .ring', { scale: 1.6, opacity: 0, transformOrigin: '50% 50%', duration: 0.8, ease: 'expo.in' })
  .to('#loader', { autoAlpha: 0, duration: 0.6, onComplete: () => { document.body.classList.remove('loading'); ScrollTrigger.refresh(); } }, '-=0.25')
  .add(() => document.body.classList.add('ready'), '<')
  .from('.p0 > *', { opacity: 0, y: 18, duration: 0.8, stagger: 0.09 }, '<0.2')
  .to(S, { in: 1, duration: 0.8 }, '<0.6');
// Todas las animaciones con scroll ya existen: recalcula sus posiciones (al recargar, el navegador restaura el scroll antes)
ScrollTrigger.refresh();
