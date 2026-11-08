// El códice vivo · Three.js + GSAP ScrollTrigger. Prototipo local.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches;           // celular / iPad: el dedo lanza el scroll más lejos
const $ = (s) => document.querySelector(s);
document.body.classList.add('loading');



// GSAP llega con «defer»; el módulo puede ejecutarse antes
await new Promise((r) => (window.gsap && window.ScrollTrigger ? r() : addEventListener('DOMContentLoaded', r)));
const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });     // la barra del navegador en móvil no recalcula todo

// Títulos que entran letra por letra (se separan antes de crear las animaciones)
document.querySelectorAll('[data-split], .mega').forEach((el) => {
  el.innerHTML = el.innerHTML.split(/<br\s*\/?>/).map((ln) =>
    `<span class="line">${ln.split(' ').map((w) => `<span class="word">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`).join(' ')}</span>`).join('');
});

// ---------- Renderizador ----------
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch {
  location.replace('/clasica/');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 900 ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const key = new THREE.DirectionalLight(0xfff0dc, 1.4);
key.position.set(3, 5, 5);
const rim = new THREE.DirectionalLight(0xdfffe8, 0.4);
rim.position.set(-4, 3, -5);
scene.add(key, rim, new THREE.HemisphereLight(0xfff8ee, 0xcbb894, 0.5));

// ---------- Colores del códice ----------
const C = { ink: 0x2b2622, salvia: 0x3f6b4f, sanguine: 0xb5522e, violet: 0x7a4e8c, ochre: 0xb87a2e, blue: 0x2f6f8f };

// ---------- iPad ----------
const W = 2.25, H = 3.0, D = 0.09, SW = W - 0.16, SH = H - 0.16;
const FLOOR = -H / 2 - 0.12;                  // la mesa / el suelo
const desk = document.getElementById('desk');
// Fotos del escritorio (prueba): pantalla del iPad en fracciones de la imagen
const PHOTOS = {
  a: { src: '/codice/escritorio-a', w: 1536, h: 1024, cx: 0.5, cy: 0.4688, sw: 0.1615, sh: 0.3477 },
  b: { src: 'escritorio-b', w: 1536, h: 1024, cx: 0.4987, cy: 0.4551, sw: 0.1823, sh: 0.3945 },
  c: { src: 'escritorio-c', w: 2528, h: 1696, cx: 0.5005, cy: 0.548, sw: 0.179, sh: 0.362 },
};
let photoKey = 'a';
const PHOTO = { fill: 1 };
const flash = document.getElementById('flash');
const p3 = document.querySelector('.p3');
const glow = document.getElementById('glow');
let glIntro = 0;
function placePhoto() {
  const ph = PHOTOS[photoKey], vw = innerWidth, vh = innerHeight;
  const cover = Math.max(vw / ph.w, vh / ph.h);                 // como object-fit: cover
  const iw = ph.w * cover, ih = ph.h * cover;
  const ox = (vw - iw) / 2, oy = (vh - ih) / 2;
  const scx = ox + ph.cx * iw, scy = oy + ph.cy * ih;            // centro de la pantalla en la vista
  const sw = ph.sw * iw, sh = ph.sh * ih;
  PHOTO.fill = Math.max(vw / sw, vh / sh) * 1.04;                // escala para que la pantalla llene la vista
  desk.style.transformOrigin = `${scx}px ${scy}px`;
}
function setPhoto(key) {
  photoKey = key;
  const img = desk.querySelector('img'), ph = PHOTOS[key];
  img.srcset = `${ph.src}-1100.webp 1100w, ${ph.src}.webp 2000w`;
  img.src = `${ph.src}.webp`;
  placePhoto();
}
const rig = new THREE.Group();          // todo lo que se mueve junto
const ipad = new THREE.Group();
rig.add(ipad);
scene.add(rig);

const body = new THREE.Mesh(
  new RoundedBoxGeometry(W, H, D, 6, 0.17),
  new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.35, roughness: 0.5 })
);
ipad.add(body);

await document.fonts.load('600 70px Fraunces');
await document.fonts.load('600 30px Nunito');

await document.fonts.load('400 52px "STIX Two Text"');
await document.fonts.load('italic 400 52px "STIX Two Text"');
await document.fonts.load('700 52px "STIX Two Text"');

// Página del cuaderno: ecuaciones de Navier–Stokes (lo impreso; el lápiz dibuja el resto)
const MATH = (st, size) => `${st === 'i' ? 'italic 400' : st === 'b' ? '700' : '400'} ${size}px "STIX Two Text"`;
function drawFormula(g, x, base, parts, size) {
  const spans = {};
  const mark = (tag, x0, x1) => { if (!tag) return; const sp = spans[tag] || (spans[tag] = [Infinity, -Infinity]); sp[0] = Math.min(sp[0], x0); sp[1] = Math.max(sp[1], x1); };
  const run = (items, sz, draw, bx, by) => {          // dibuja (o mide) una lista de piezas
    let cx = bx;
    for (const it of items) {
      if (it.frac) {
        const fs = sz * 0.78;
        const wn = run(it.frac[0], fs, false, 0, 0), wd = run(it.frac[1], fs, false, 0, 0);
        const w = Math.max(wn, wd) + sz * 0.2;
        if (draw) {
          run(it.frac[0], fs, true, cx + (w - wn) / 2, by - sz * 0.42);
          run(it.frac[1], fs, true, cx + (w - wd) / 2, by + sz * 0.5);
          g.fillRect(cx, by - sz * 0.3, w, Math.max(2, sz * 0.045));
          mark(it.tag, cx, cx + w);
        }
        cx += w;
      } else {
        g.font = MATH(it.st, sz);
        const w = g.measureText(it.t).width;
        if (draw) { g.fillText(it.t, cx, by); mark(it.tag, cx, cx + w); }
        cx += w;
        if (it.sup) {
          g.font = MATH('r', sz * 0.6);
          const ws = g.measureText(it.sup).width;
          if (draw) { g.fillText(it.sup, cx + 1, by - sz * 0.42); mark(it.tag, cx, cx + ws); }
          cx += ws + 2;
        }
      }
    }
    return cx - bx;
  };
  run(parts, size, true, x, base);
  return spans;
}
const T = (t, st = 'r', tag, sup) => ({ t, st, tag, sup });
const momentum = [
  T('ρ', 'i'), T(' ('),
  { frac: [[T('∂'), T('u', 'b')], [T('∂'), T('t', 'i')]], tag: 'inercia' },
  T(' + (', 'r', 'inercia'), T('u', 'b', 'inercia'), T(' · ∇) ', 'r', 'inercia'), T('u', 'b', 'inercia'), T(')'),
  T('  =  '), T('−∇', 'r', 'presion'), T('p', 'i', 'presion'),
  T('  +  '), T('μ', 'i', 'viscosidad'), T('∇', 'r', 'viscosidad', '2'), T('u', 'b', 'viscosidad'),
  T('  +  '), T('f', 'b', 'fuerzas'),
];
let pageSpans = {};
function paperTexture() {
  const c = document.createElement('canvas');
  c.width = 1050; c.height = 1400;
  const g = c.getContext('2d');
  g.beginPath(); g.roundRect(0, 0, c.width, c.height, 60); g.clip();
  g.fillStyle = '#FBF6EA'; g.fillRect(0, 0, c.width, c.height);
  // papel de puntos (ingeniería)
  g.fillStyle = '#D9CFBB';
  for (let y = 260; y < c.height - 30; y += 36) for (let x = 36; x < c.width - 20; x += 36) { g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#2B2622'; g.font = '600 68px Fraunces'; g.fillText('Navier–Stokes', 96, 150);
  g.fillStyle = '#7A6E5C'; g.font = '600 28px Nunito'; g.fillText('Mecánica de fluidos · Clase 7 · fluido incompresible', 98, 198);
  // ecuación de momento (ajusta el tamaño al ancho)
  g.fillStyle = '#2B2622';
  let size = 50;
  const probe = document.createElement('canvas').getContext('2d');
  const widthAt = (sz) => { let w = 0; for (const it of momentum) { if (it.frac) { probe.font = MATH('r', sz * 0.78); w += probe.measureText('∂u').width + sz * 0.2; } else { probe.font = MATH(it.st, sz); w += probe.measureText(it.t).width + (it.sup ? sz * 0.4 : 0); } } return w; };
  while (widthAt(size) > 860 && size > 34) size -= 2;
  pageSpans = drawFormula(g, 96, 352, momentum, size);
  // etiquetas bajo cada término (el lápiz dibuja los corchetes)
  const labels = { inercia: ['inercia', '#3F6B4F'], presion: ['presión', '#2F6F8F'], viscosidad: ['viscosidad', '#B87A2E'], fuerzas: ['fuerzas', '#7A4E8C'] };
  g.font = '700 22px Nunito'; g.textAlign = 'center';
  for (const [k, [txt, col]] of Object.entries(labels)) { const sp = pageSpans[k]; if (sp) { g.fillStyle = col; g.fillText(txt, (sp[0] + sp[1]) / 2, 452); } }
  g.textAlign = 'left';
  // continuidad
  g.fillStyle = '#2B2622';
  drawFormula(g, 96, 540, [T('∇ · '), T('u', 'b'), T('  =  0')], 44);
  g.fillStyle = '#7A6E5C'; g.font = '600 26px Nunito'; g.fillText('continuidad: lo que entra, sale', 330, 536);
  // pie del dibujo y Reynolds
  g.fillStyle = '#7A6E5C'; g.font = 'italic 400 26px "STIX Two Text"'; g.fillText('Flujo alrededor de un perfil alar, α ≈ 7°', 96, 1135);
  g.fillStyle = '#2B2622';
  drawFormula(g, 130, 1268, [T('Re', 'i'), T('  =  '), { frac: [[T('ρ', 'i'), T('v', 'i'), T('L', 'i')], [T('μ', 'i')]] }], 48);
  g.fillStyle = '#7A6E5C'; g.font = '600 26px Nunito';
  g.fillText('Número de Reynolds', 470, 1236);
  g.fillText('laminar  →  turbulento  (Re ≳ 2300)', 470, 1278);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
const screen = new THREE.Mesh(
  new THREE.PlaneGeometry(SW, SH),
  new THREE.MeshBasicMaterial({ map: paperTexture(), transparent: true, toneMapped: false })
);
screen.position.z = D / 2 + 0.002;
ipad.add(screen);

// Pantalla de inicio de Meridad (la que se ve con el iPad sobre la mesa)
const logoImg = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = '/assets/logo.png'; });
function splashTexture() {
  const c = document.createElement('canvas');
  c.width = 1050; c.height = 1400;
  const g = c.getContext('2d');
  g.beginPath(); g.roundRect(0, 0, c.width, c.height, 60); g.clip();
  const grd = g.createLinearGradient(0, 0, 0, c.height);
  grd.addColorStop(0, '#FBF7EE'); grd.addColorStop(1, '#F1EADB');
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  if (logoImg) { g.save(); g.beginPath(); g.roundRect(395, 450, 260, 260, 58); g.clip(); g.drawImage(logoImg, 395, 450, 260, 260); g.restore(); }
  g.textAlign = 'center';
  g.fillStyle = '#2B2622'; g.font = '600 112px Fraunces'; g.fillText('Meridad', 525, 860);
  g.fillStyle = '#6E6352'; g.font = '600 38px Nunito'; g.fillText('Escribe, entiende y recuerda.', 525, 930);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
const splash = new THREE.Mesh(
  new THREE.PlaneGeometry(SW, SH),
  new THREE.MeshBasicMaterial({ map: splashTexture(), transparent: true, toneMapped: false, depthWrite: false })
);
splash.position.z = D / 2 + 0.004;
ipad.add(splash);

// px del lienzo → coordenadas de la pantalla
const px = (x, y) => new THREE.Vector3((x / 1050 - 0.5) * SW, (0.5 - y / 1400) * SH, 0);

// ---------- Trazos de tinta (se dibujan solos) ----------
const wob = (i, s) => Math.sin(i * 0.9 + s) * 0.006 + Math.sin(i * 0.37 + s * 2) * 0.008;
function loop(cx, cy, rx, ry, start, sweep, n, seed, sq = 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (sweep * i) / n;
    const c = Math.cos(a), s = Math.sin(a);
    const k = 1 + wob(i, seed) * 3 + (i / n) * 0.04;      // la mano no cierra perfecto
    const e = 2 / sq;
    pts.push(new THREE.Vector3(cx + rx * k * Math.sign(c) * Math.abs(c) ** e, cy + ry * k * Math.sign(s) * Math.abs(s) ** e, 0));
  }
  return pts;
}
const line = (pts) => pts.map(([x, y]) => new THREE.Vector3(x, y, 0));
// corchete bajo un término de la ecuación
const brace = ([x0, x1], y) => { const m = (x0 + x1) / 2; return [px(x0, y - 6), px(x0 + 4, y + 6), px(m - 10, y + 7), px(m, y + 17), px(m + 10, y + 7), px(x1 - 4, y + 6), px(x1, y - 6)]; };
// perfil alar NACA 4412 girado α
function airfoil(lx, ly, chord, alpha) {
  const m = 0.04, pp = 0.4, t = 0.12, pts = [], ca = Math.cos(alpha), sa = Math.sin(alpha);
  const surf = (xc, up) => {
    const yt = 5 * t * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc ** 2 + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const yc = xc < pp ? m / pp ** 2 * (2 * pp * xc - xc ** 2) : m / (1 - pp) ** 2 * (1 - 2 * pp + 2 * pp * xc - xc ** 2);
    const y = yc + (up ? yt : -yt);
    const X = xc * chord, Y = -y * chord;                     // y del lienzo hacia abajo
    return px(lx + X * ca - Y * sa, ly + X * sa + Y * ca);
  };
  for (let i = 40; i >= 0; i--) { const b = (i / 40); pts.push(surf((1 - Math.cos(b * Math.PI)) / 2, true)); }
  for (let i = 1; i <= 40; i++) { const b = (i / 40); pts.push(surf((1 - Math.cos(b * Math.PI)) / 2, false)); }
  return pts;
}
// línea de flujo que rodea el perfil (y arriba se abre más: sustentación)
function streamline(y0) {
  const pts = [], cx = 520, cy = 840;
  for (let x = 140; x <= 920; x += 20) {
    const g = Math.exp(-(((x - cx) / 175) ** 2));
    const d = y0 - cy, dir = Math.sign(d);
    const push = g * 5200 / (Math.abs(d) + 30) * dir;
    const down = 34 * (1 / (1 + Math.exp(-(x - 600) / 60))) * (60 / (Math.abs(d) + 60));
    pts.push(px(x, y0 + push + down));
  }
  return pts;
}
function spiral(cx, cy, r0, r1, turns, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * turns * Math.PI * 2, r = r1 - (r1 - r0) * (i / n); pts.push(px(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8)); }
  return pts;
}
const frameBox = (x0, y0, x1, y1) => [px(x0, y0 + 3), px((x0 + x1) / 2, y0 - 2), px(x1, y0 + 2), px(x1 + 2, (y0 + y1) / 2), px(x1 - 2, y1), px((x0 + x1) / 2, y1 + 3), px(x0 + 1, y1 - 2), px(x0 - 2, (y0 + y1) / 2), px(x0 + 6, y0 + 1)];
const SP = (k) => pageSpans[k] || [0, 10];
const strokeDefs = [
  { pts: brace(SP('inercia'), 400), color: C.salvia, r: 0.008 },
  { pts: brace(SP('presion'), 400), color: C.blue, r: 0.008 },
  { pts: brace(SP('viscosidad'), 400), color: C.ochre, r: 0.008 },
  { pts: brace(SP('fuerzas'), 400), color: C.violet, r: 0.008 },
  { pts: airfoil(330, 820, 390, 0.12), color: C.ink, r: 0.011 },
  ...[650, 712, 770, 912, 975, 1040].map((y) => ({ pts: streamline(y), color: C.blue, r: 0.0065 })),
  { pts: spiral(820, 960, 6, 48, 2.3, 70), color: C.sanguine, r: 0.0075 },
  { pts: frameBox(108, 1196, 420, 1316), color: C.ink, r: 0.007 },
];
const inkGroup = new THREE.Group();
inkGroup.position.z = D / 2 + 0.012;
ipad.add(inkGroup);
const RADIAL = 8;
const strokes = strokeDefs.map((d, i) => {
  const curve = new THREE.CatmullRomCurve3(d.pts, false, 'centripetal');
  const segs = Math.max(24, Math.round(curve.getLength() * 140));
  const geo = new THREE.TubeGeometry(curve, segs, d.r, RADIAL, false);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.35, metalness: 0.1 }));
  geo.setDrawRange(0, 0);
  inkGroup.add(mesh);
  return { curve, geo, mesh, segs, len: curve.getLength(), i };
});
const totalLen = strokes.reduce((a, s) => a + s.len, 0);

// ---------- Apple Pencil (genérico) ----------
const pencil = new THREE.Group();
{
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf7f5f0, roughness: 0.35, clearcoat: 0.6 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 1.25, 32), white);
  shaft.position.y = 0.09 + 0.625;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.008, 0.09, 32), white);
  cone.position.y = 0.045;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 8), new THREE.MeshStandardMaterial({ color: 0x9a948a }));
  const flat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.012), white);
  flat.position.set(0, 0.8, 0.03);
  pencil.add(shaft, cone, tip, flat);
  pencil.rotation.set(0.55, 0, -0.45);
  pencil.scale.setScalar(0.0001);
  inkGroup.add(pencil);
}

// ---------- Sombra suave ----------
function shadowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(70,50,30,.55)'); grd.addColorStop(1, 'rgba(70,50,30,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.6), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(-0.4, -H / 2 - 0.12, 0.2);
rig.add(shadow);


// ---------- Leonardo ----------
const leo = new THREE.Group();
rig.add(leo);
const LEO_H = 1.55;
const leoBase = new THREE.Vector3(-W / 2 - 0.38, 0, 0.55);

const pctEl = $('#pct');
const mPath = $('#loader .m');
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, done, total) => setProgress(done / total);
let shown = 0;
function setProgress(p) {
  gsap.to({ v: shown }, { v: p, duration: 0.4, onUpdate() { shown = this.targets()[0].v; pctEl.textContent = Math.round(shown * 100); mPath.style.strokeDashoffset = 400 * (1 - shown); } });
}
const gltf = await new Promise((res, rej) => {
  new GLTFLoader(manager).load('/codice/leonardo.glb', res, (e) => e.total && setProgress(e.loaded / e.total * 0.95), rej);
});
const model = gltf.scene;
const box = new THREE.Box3().setFromObject(model);
const s = LEO_H / (box.max.y - box.min.y);
model.scale.setScalar(s);
model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
model.traverse((o) => { if (o.material) { o.material.envMapIntensity = 0.9; } });
leo.add(model);
leo.position.set(leoBase.x, -H / 2 - 0.12, leoBase.z);

// ---------- Avatares que vienen: siluetas de plano técnico ----------
const avatars = [];
{
  const fill = new THREE.MeshStandardMaterial({ color: 0xcfe3c9, transparent: true, opacity: 0.1, depthWrite: false, roughness: 0.6 });
  const wire = new THREE.LineBasicMaterial({ color: 0xf08a4b, transparent: true, opacity: 0.55 });
  const ringM = new THREE.MeshBasicMaterial({ color: 0xf08a4b, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const bodyG = new THREE.CapsuleGeometry(0.3, 0.5, 3, 9);
  const headG = new THREE.SphereGeometry(0.25, 9, 6);
  const ringG = new THREE.RingGeometry(0.42, 0.45, 48);
  [[-2.6, 0.3], [-3.45, 0.6], [-4.3, 0.35]].forEach(([x, z]) => {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    const body = new THREE.Mesh(bodyG, fill); body.position.y = 0.58;
    const head = new THREE.Mesh(headG, fill); head.position.y = 1.3;
    const bw = new THREE.LineSegments(new THREE.WireframeGeometry(bodyG), wire); bw.position.y = 0.58;
    const hw = new THREE.LineSegments(new THREE.WireframeGeometry(headG), wire); hw.position.y = 1.3;
    inner.add(body, head, bw, hw);
    const ring = new THREE.Mesh(ringG, ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005;
    g.add(inner, ring);
    g.position.set(x, -H / 2 - 0.12, z);
    g.scale.setScalar(0.88);
    g.visible = false;
    rig.add(g);
    avatars.push({ g, inner, ring });
  });
}

// ---------- Estado que anima la línea de tiempo ----------
const S = {
  desk: 1,                                    // 1 = iPad acostado sobre el escritorio (foto)
  hero: 1,                                    // 1 = composición de portada (rig a la derecha)
  cx: 0.0, cy: 0.35, cz: 8.4, tx: 0, ty: -0.1, tz: 0,
  rx: -0.22, ry: -0.42,
  ink: 0, lift: 0, pen: 0,
  leoTurn: 0.4,
  av: 0, away: 0, splashOn: 0, leoHide: 0,    // cierre: pantalla de Meridad y sin Leonardo
                              // escena de avatares (siluetas / iPad que se aparta)
  focus: 0, end: 0,                           // escena de Leonardo / cierre (ajustes en vertical)
};

// Cámara: orbitar a la cabeza de Leonardo usa estos objetivos
const headLocal = new THREE.Vector3(leoBase.x, -H / 2 - 0.12 + LEO_H * 0.78, leoBase.z);

// ---------- Diseño según pantalla ----------
let L = {};
function layout() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h, false);
  camera.aspect = a;
  camera.updateProjectionMatrix();
  if (a >= 1.15) L = { heroX: THREE.MathUtils.clamp(1.1 * a, 1.3, 1.9), zoom: 1, lift: 0 };
  else if (a >= 0.8) L = { heroX: 0.3, zoom: 1.3, lift: 0.9, side: 0, portrait: true };
  else L = { heroX: 0.55, zoom: 1.7, lift: 1.25, side: 0, portrait: true };
}
layout();
let lastW = innerWidth;
addEventListener('resize', () => {
  layout(); placePhoto();
  if (innerWidth !== lastW) { lastW = innerWidth; ScrollTrigger.refresh(); }   // solo si cambia el ancho
});

// ---------- Ratón: Leonardo te sigue con la mirada ----------
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; });

// ---------- Anotaciones ----------
const annos = [...document.querySelectorAll('[data-anchor]')].map((el) => ({ el, key: el.dataset.anchor, o: 0 }));
const annoOpacity = { ipad: 0, leoFeet: 0, pencil: 0, nucleus: 0, mito: 0, lift: 0, leoHead: 0, av: 0, leoAv: 0 };
const v = new THREE.Vector3();
function anchorWorld(key) {
  switch (key) {
    case 'ipad': return v.set(W / 2 - 0.1, H / 2 - 0.1, D / 2).applyMatrix4(ipad.matrixWorld);
    case 'leoFeet': return v.set(leoBase.x + 0.28, -H / 2 + 0.2, leoBase.z).applyMatrix4(rig.matrixWorld);
    case 'pencil': return pencil.getWorldPosition(v);
    case 'nucleus': return v.copy(px(610, 800)).applyMatrix4(inkGroup.matrixWorld);
    case 'mito': return v.copy(px(800, 985)).applyMatrix4(inkGroup.matrixWorld);
    case 'lift': return v.copy(px(560, 400)).applyMatrix4(strokes[0].mesh.matrixWorld);
    case 'av0': case 'av1': case 'av2': { const a = avatars[+key[2]]; return v.set(0, 1.66, 0).applyMatrix4(a.g.matrixWorld); }
    case 'leoAv': return v.set(leoBase.x, -H / 2 - 0.12 + LEO_H + 0.05, leoBase.z).applyMatrix4(rig.matrixWorld);
    case 'leoHead': return v.copy(headLocal).add(new THREE.Vector3(0.1, 0.18, 0)).applyMatrix4(rig.matrixWorld);
  }
}

// ---------- Línea de tiempo con el scroll ----------
const tl = gsap.timeline({ defaults: { ease: 'sine.inOut' }, paused: true });   // curvas suaves: menos tirones
const P = (sel) => document.querySelector(sel);
const showPanel = (sel, at, dur = 0.35) => tl.fromTo(P(sel), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: dur, ease: 'power2.out' }, at);
const hidePanel = (sel, at, dur = 0.3) => tl.to(P(sel), { autoAlpha: 0, y: -30, duration: dur, ease: 'power2.in' }, at);
const anno = (key, at, out) => {
  tl.to(annoOpacity, { [key]: 1, duration: 0.2 }, at);
  if (out != null) tl.to(annoOpacity, { [key]: 0, duration: 0.2 }, out);
};

// 0 → 1 · portada
tl.to(annoOpacity, { ipad: 0, leoFeet: 0, duration: 0.2 }, 0.45);
hidePanel('.p0', 0.45);
// 1 → 3 · la tinta: la cámara entra a la pantalla y el lápiz dibuja
tl.to(S, { hero: 0, cx: 1.15, cy: 0.1, cz: 6.7, tx: 1.2, ty: 0.02, rx: 0, ry: 0, leoTurn: 0.9, duration: 1.1 }, 0.5);
tl.to(S, { pen: 1, duration: 0.25 }, 1.25);
tl.to(S, { ink: 1, duration: 1.5, ease: 'none' }, 1.35);
tl.to(S, { pen: 0, duration: 0.25 }, 2.85);
showPanel('.p1', 1.2);
anno('pencil', 1.4, 2.8);
anno('nucleus', 2.55, 3.35); anno('mito', 2.75, 3.35);
hidePanel('.p1', 3.0);
// 3 → 4 · la tinta se levanta del papel; giro de cámara
tl.to(S, { lift: 1, cx: 2.6, cy: 0.75, cz: 6.3, tx: 1.05, ty: -0.05, ry: -0.22, duration: 1.0 }, 3.1);
showPanel('.p2', 3.35);
anno('lift', 3.6, 4.25);
hidePanel('.p2', 4.2);
// 4 → 5.3 · el tutor: primer plano de Leonardo
tl.to(S, { cx: headLocal.x - 0.25, cy: headLocal.y + 0.05, cz: headLocal.z + 3.7, tx: headLocal.x - 0.7, ty: headLocal.y - 0.35, tz: headLocal.z, lift: 0.6, ry: -0.35, leoTurn: -0.08, focus: 1, duration: 1.0 }, 4.25);
showPanel('.p3', 4.75);
anno('leoHead', 4.9, 5.75);
hidePanel('.p3', 5.65);
tl.to({}, { duration: 0.3 }, 5.9);

// 0 → 1.1 · el escritorio: el iPad se levanta de la mesa y la foto se funde en el verde
tl.shiftChildren(1.1);
tl.set('.p0', { autoAlpha: 0 }, 0);
tl.to(S, { desk: 0, duration: 1.0, ease: 'none' }, 0.05);
hidePanel('.pdesk', 0.05, 0.25);
showPanel('.p0', 0.85, 0.3);
tl.fromTo('h1 .ch', { yPercent: 115 }, { yPercent: 0, duration: 0.35, stagger: 0.008, ease: 'expo.out' }, 0.85);
tl.to(annoOpacity, { ipad: 1, leoFeet: 1, duration: 0.15 }, 1.0);

// 6.8 → 8.3 · tus avatares: Leonardo hoy, el tuyo muy pronto
tl.to(S, { cx: -0.75, cy: -0.1, cz: 11, tx: -0.7, ty: -0.85, tz: 0.4, lift: 0, ry: 0, away: 1, leoTurn: -0.12, focus: 1, duration: 1.0 }, 6.8);
tl.to(S, { av: 1, duration: 0.9, ease: 'power1.out' }, 7.2);
showPanel('.pav', 7.25);
tl.to(annoOpacity, { leoAv: 1, duration: 0.2 }, 7.3);
tl.to(annoOpacity, { av: 1, duration: 0.2 }, 7.75);
hidePanel('.pav', 8.35);
tl.to(annoOpacity, { av: 0, leoAv: 0, duration: 0.2 }, 8.35);
tl.to({}, { duration: 0.2 }, 8.55);

ScrollTrigger.create({
  trigger: '#story', start: 'top top', end: 'bottom bottom', scrub: reduce ? true : (touch ? 2.2 : 1.4),
  onUpdate: (st) => tl.progress(st.progress),
});

// ---------- El 3D se atenúa mientras lees el contenido ----------
const glFade = { o: 1 };
gsap.to(glFade, { o: 0, ease: 'none', scrollTrigger: { trigger: '.content', start: 'top bottom', end: 'top 35%', scrub: true } });

// Galería horizontal fijada
const track = document.querySelector('.track');
gsap.to(track, {
  x: () => -(track.scrollWidth - innerWidth), ease: 'none',
  scrollTrigger: { trigger: '.gallery', pin: true, scrub: 1, end: () => '+=' + (track.scrollWidth - innerWidth), invalidateOnRefresh: true },
});

// Frase de privacidad: se enciende palabra por palabra
document.querySelectorAll('[data-words]').forEach((el) => {
  el.innerHTML = el.textContent.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
  gsap.to(el.querySelectorAll('.w'), { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 40%', scrub: true } });
});

// Apariciones suaves
gsap.set('.reveal', { opacity: 0, y: 40 });
ScrollTrigger.batch('.reveal', {
  start: 'top 88%',
  onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out', overwrite: true }),
});

// ---------- Cierre: vuelve el 3D y la llamada a descargar ----------
gsap.fromTo(glFade, { o: 0 }, { o: 1, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '#finale', start: 'top 80%', end: 'top 25%', scrub: true } });
// Al entrar al cierre (con el 3D aún oculto) la escena salta a la vitrina: sin Leonardo ni avatares
const tl2 = gsap.timeline({ paused: true, defaults: { ease: 'sine.inOut' } });
tl2.set(S, { hero: 0, cx: 0, cy: 0.5, cz: 16.5, tx: 0, ty: 0.7, tz: 0, rx: -0.06, ry: 0, lift: 0, focus: 0, end: 1, away: 0, av: 0, splashOn: 1, leoHide: 1 }, 0.001)
  .to(S, { cz: 14.2, duration: 1 }, 0.002)
  .fromTo('.p4 .fig', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.4)
  .fromTo('.p4', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, 0.4)
  .fromTo('.p4 .mega .ch', { yPercent: 115 }, { yPercent: 0, duration: 0.35, stagger: 0.006, ease: 'expo.out' }, 0.45)
  .fromTo('.p5', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.7);
ScrollTrigger.create({ trigger: '#finale', start: 'top bottom', end: 'bottom bottom', scrub: reduce ? true : 1, onUpdate: (st) => tl2.progress(st.progress) });

// ---------- Bucle de dibujo ----------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
function drawInk(p) {
  let left = p * totalLen;
  let tipStroke = null, tipT = 0;
  for (const st of strokes) {
    const t = THREE.MathUtils.clamp(left / st.len, 0, 1);
    left -= st.len;
    const segsShown = Math.floor(t * st.segs);
    st.geo.setDrawRange(0, segsShown * RADIAL * 6);
    st.mesh.position.z = S.lift * (0.1 + st.i * 0.06);
    if (t > 0 && t < 1 && !tipStroke) { tipStroke = st; tipT = t; }
  }
  if (!tipStroke) { const last = strokes.findLast((st) => st.geo.drawRange.count > 0) || strokes[0]; tipStroke = last; tipT = last.geo.drawRange.count ? 1 : 0; }
  tipStroke.curve.getPointAt(tipT, tmp);
  pencil.position.set(tmp.x, tmp.y, tipStroke.mesh.position.z + 0.012);
}

function render() {
  const t = clock.getElapsedTime();
  mouse.sx += (mouse.x - mouse.sx) * 0.06;
  mouse.sy += (mouse.y - mouse.sy) * 0.06;

  // Entrada (k = S.desk: 1 → 0)
  //   1.00 → 0.50  la foto se acerca hasta entrar en la pantalla del iPad
  //   0.62 → 0.36  fundido al color de la pantalla (oculta el relevo foto → 3D)
  //   0.40 → 0.00  la cámara sale de la pantalla 3D y aparece el mundo Meridad
  const k = S.desk, lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp, sm = THREE.MathUtils.smoothstep;
  const za = sm(1 - k, 0, 0.5);
  desk.style.transform = `scale(${Math.pow(PHOTO.fill, za)})`;
  desk.style.opacity = k > 0.47 ? 1 : 0;
  desk.style.filter = za > 0.55 && !L.portrait ? `blur(${(za - 0.55) * 14}px)` : 'none';   // en móvil el desenfoque es caro
  flash.style.opacity = k > 0.47 ? sm(1 - k, 0.38, 0.53) : sm(k, 0.33, 0.46);
  const pull = sm(k, 0, 0.4);                       // 1 = cámara pegada a la pantalla 3D
  glIntro = k > 0.47 ? 0 : 1;
  rig.position.x = S.hero * L.heroX * (1 - pull);
  const floatY = reduce ? 0 : Math.sin(t * 0.8) * 0.03 * S.hero * (1 - pull);
  ipad.rotation.set(lerp(S.rx + (reduce ? 0 : Math.sin(t * 0.6) * 0.015), 0, pull), lerp(S.ry + (reduce ? 0 : mouse.sx * 0.06 * S.hero), 0, pull), 0);
  ipad.position.set(0, floatY, 0);
  splash.material.opacity = Math.max(clamp((k - 0.1) / 0.18, 0, 1), S.splashOn);
  inkGroup.visible = S.splashOn < 0.5;
  // cierre: el iPad gira despacio, como en una vitrina
  ipad.rotation.y += reduce ? 0 : S.end * Math.sin(t * 0.5) * 0.38;
  glow.style.opacity = S.end * glFade.o;
  leo.position.set(leoBase.x, FLOOR, leoBase.z);
  // Leonardo no estorba al iPad: solo aparece en la portada y en sus escenas
  const leoVis = clamp(Math.max(S.hero, S.focus) * 2, 0, 1);
  leo.scale.setScalar(Math.max(0.0001, (1 - sm(pull, 0.02, 0.25)) * (1 - S.leoHide) * leoVis));   // aparece al terminar de salir
  leo.rotation.y = S.leoTurn + mouse.sx * 0.45;
  leo.rotation.x = mouse.sy * 0.06;
  // el iPad se aparta hacia arriba para dejar ver la fila de avatares
  const gone = L.portrait ? Math.max(S.away, S.focus) : S.away;     // en vertical también se aparta en el primer plano del tutor
  ipad.position.y += gone * (L.portrait ? 6 : 4.2);
  ipad.visible = !(L.portrait && gone > 0.8);
  avatars.forEach((a, i) => {
    const si = sm(S.av, i * 0.18, i * 0.18 + 0.5);
    a.g.visible = si > 0.001;
    a.inner.scale.set(1, Math.max(0.0001, si), 1);
    a.inner.position.y = reduce ? 0 : Math.sin(t * 1.2 + i) * 0.02 * si;
    a.ring.scale.setScalar(0.4 + si * 0.6);
  });
  model.position.y = -box.min.y * s + (reduce ? 0 : Math.abs(Math.sin(t * 1.6)) * 0.015);

  // cámara (más lejos y con el foco más arriba en pantallas verticales)
  // en vertical: sujetos centrados y más abajo (el texto va arriba)
  const side = THREE.MathUtils.lerp(L.side ?? 1, 1, S.focus);
  const short = L.portrait ? clamp((2.05 - innerHeight / innerWidth) / 0.4, 0, 1) : 0;   // 1 = celular con poca altura visible
  const lift = L.lift + (L.portrait ? S.hero * 0.75 - S.end * 0.85 - S.focus * (0.75 - 0.5 * short) + S.away * (0.55 + 0.45 * short) : 0);
  const zoom = L.portrait ? THREE.MathUtils.lerp(L.zoom, L.zoom > 1.5 ? 1.75 : 1.4, S.end) : L.zoom;
  // en vertical: Leonardo (o la fila de avatares) al centro de la pantalla
  const pcx = L.portrait ? lerp(headLocal.x, -2.85, S.away) : 0;
  const dx = 0;
  // cámara pegada a la pantalla: la pantalla llena la vista (como el final del acercamiento)
  const vt = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fillD = Math.min((SH / 2) / vt, (SW / 2) / (vt * camera.aspect)) * 0.97 + D / 2;
  let camX = S.cx * zoom * side, tgtX = S.tx * side;
  if (L.portrait) { camX = lerp(camX, pcx, S.focus); tgtX = lerp(tgtX, pcx, S.focus); }
  const camZ = S.cz * zoom * (L.portrait ? 1 + S.away * 0.2 + S.focus * (1 - S.away) * 0.3 * short : 1);
  camera.position.set(lerp(camX, 0, pull), lerp(S.cy + lift * 0.35, 0, pull), lerp(camZ, fillD, pull));
  camera.lookAt(lerp(tgtX, 0, pull), lerp(S.ty + lift, 0, pull), lerp(S.tz, 0, pull));

  drawInk(S.ink);
  pencil.scale.setScalar(Math.max(0.0001, S.pen));

  scene.updateMatrixWorld();
  const glo = glFade.o * glIntro;
  canvas.style.opacity = glo;
  if (glo > 0.01) renderer.render(scene, camera);

  // anotaciones en pantalla
  for (const a of annos) {
    const o = (annoOpacity[a.key.startsWith('av') ? 'av' : a.key] ?? 0) * glFade.o * glIntro;
    if (o <= 0.001) { if (a.o !== 0) { a.el.style.opacity = 0; a.o = 0; } continue; }
    const p = anchorWorld(a.key).project(camera);
    const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
    let X = x, Y = y;
    if (a.key === 'leoHead' && L.portrait) {           // centrada y siempre debajo del texto del panel
      const pb = p3.getBoundingClientRect().bottom, bh = a.el.firstElementChild.offsetHeight;
      X = innerWidth / 2; Y = Math.max(y - 6, pb + 14 + bh);
    }
    a.el.style.transform = `translate(${X}px,${Y}px)`;
    if (a.el.classList.contains('anno')) {
      const span = a.el.lastElementChild, wl = span.offsetWidth + 40;
      if (x + wl > innerWidth - 8) a.el.classList.add('left');
      else if (x - wl < 8) a.el.classList.remove('left');
    }
    a.el.style.opacity = o; a.o = o;
  }
  requestAnimationFrame(render);
}

// ---------- Citas de la burbuja ----------
const quotes = [
  ['La sabiduría es hija de la experiencia.', 'Leonardo da Vinci'],
  ['Así como el hierro se oxida sin uso, el ingenio sin ejercicio se echa a perder.', 'Leonardo da Vinci'],
  ['La raíz de la educación es amarga, pero su fruto es dulce.', 'Aristóteles'],
  ['Estudio por ver si con estudiar ignoro menos.', 'Sor Juana Inés de la Cruz'],
  ['La educación es el arma más poderosa que puedes usar para cambiar el mundo.', 'Nelson Mandela'],
];
const q = $('#quote');
let qi = 0;
if (!reduce) setInterval(() => {
  q.classList.add('out');
  setTimeout(() => { qi = (qi + 1) % quotes.length; q.innerHTML = `«${quotes[qi][0]}»<cite>${quotes[qi][1]}</cite>`; q.classList.remove('out'); }, 350);
}, 5500);

// ---------- Entrada ----------

setPhoto(photoKey);
render();
setProgress(1);
const intro = gsap.timeline({ delay: 0.55 });
intro.to('#loader .ring', { scale: 1.6, opacity: 0, transformOrigin: '50% 50%', duration: 0.8, ease: 'expo.in' })
  .to('#loader', { autoAlpha: 0, duration: 0.6, onComplete: () => document.body.classList.remove('loading') }, '-=0.25')
  .from('#desk img', { scale: 1.08, duration: 1.8, ease: 'expo.out' }, '-=0.4')
  .from('.pdesk > *', { opacity: 0, y: 16, duration: 0.8, stagger: 0.1 }, '<0.5');

// ---------- Tema: salvia (elegido) ----------
body.material.color.set(0x3a3935);
rim.intensity = 1.6;
shadow.material.color.set(0x000000);
