// El códice vivo · Three.js + GSAP ScrollTrigger. Prototipo local.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
document.body.classList.add('loading');

// ---------- Tema de color (selector del prototipo) ----------
const THEMES = { salvia: 'Salvia', noche: 'Noche', blanco: 'Blanco', pergamino: 'Pergamino' };
let theme = 'salvia';
try { theme = localStorage.getItem('codice-theme') || theme; } catch {}
if (!THEMES[theme]) theme = 'salvia';
document.documentElement.dataset.theme = theme;

// GSAP llega con «defer»; el módulo puede ejecutarse antes
await new Promise((r) => (window.gsap && window.ScrollTrigger ? r() : addEventListener('DOMContentLoaded', r)));
const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

// ---------- Renderizador ----------
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch {
  location.replace('/');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
const C = { ink: 0x2b2622, salvia: 0x3f6b4f, sanguine: 0xb5522e, violet: 0x7a4e8c, ochre: 0xc9772e };

// ---------- iPad ----------
const W = 2.25, H = 3.0, D = 0.09, SW = W - 0.16, SH = H - 0.16;
const rig = new THREE.Group();          // todo lo que se mueve junto
const ipad = new THREE.Group();
rig.add(ipad);
scene.add(rig);

const body = new THREE.Mesh(
  new RoundedBoxGeometry(W, H, D, 6, 0.17),
  new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.55, roughness: 0.38 })
);
ipad.add(body);

await document.fonts.load('600 70px Fraunces');
await document.fonts.load('600 30px Nunito');

function paperTexture() {
  const c = document.createElement('canvas');
  c.width = 1050; c.height = 1400;
  const g = c.getContext('2d');
  const r = 60;
  g.beginPath(); g.roundRect(0, 0, c.width, c.height, r); g.clip();
  g.fillStyle = '#FBF6EA'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#DED5C2'; g.lineWidth = 2;
  for (let y = 300; y < c.height - 40; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.strokeStyle = 'rgba(181,82,46,.35)'; g.beginPath(); g.moveTo(100, 0); g.lineTo(100, c.height); g.stroke();
  g.fillStyle = '#2B2622'; g.font = '600 76px Fraunces'; g.fillText('La célula', 130, 190);
  g.fillStyle = '#7A6E5C'; g.font = '600 30px Nunito'; g.fillText('Biología celular · Unidad 2', 132, 240);
  g.fillStyle = '#3A342D'; g.font = '600 31px Nunito';
  ['• Membrana: controla qué entra y qué sale', '• Núcleo: guarda el ADN', '• Mitocondria: produce la energía (ATP)']
    .forEach((t, i) => g.fillText(t, 132, 330 + i * 46));
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
const strokeDefs = [
  { pts: [px(130, 212), px(220, 222), px(330, 206), px(440, 220), px(520, 210)], color: C.salvia, r: 0.012 },
  { pts: loop(0, -0.42, 0.82, 0.55, 2.3, Math.PI * 2 + 0.32, 90, 1), color: C.salvia, r: 0.014 },
  { pts: loop(0.2, -0.34, 0.26, 0.19, 0.9, Math.PI * 2 + 0.25, 46, 3), color: C.violet, r: 0.013 },
  { pts: loop(-0.42, -0.6, 0.18, 0.075, 3.4, Math.PI * 2 + 0.2, 40, 5, 5), color: C.ochre, r: 0.012 },
  { pts: line([[0.7, 0.22], [0.56, 0.06], [0.42, -0.1], [0.33, -0.2]]), color: C.ink, r: 0.009 },
  { pts: line([[0.43, -0.17], [0.33, -0.2], [0.35, -0.09]]), color: C.ink, r: 0.009 },
  { pts: line([[-0.55, -1.15], [-0.5, -0.95], [-0.46, -0.72]]), color: C.ink, r: 0.009 },
  { pts: line([[-0.53, -0.8], [-0.46, -0.72], [-0.4, -0.81]]), color: C.ink, r: 0.009 },
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
  new GLTFLoader(manager).load('leonardo.glb', res, (e) => e.total && setProgress(e.loaded / e.total * 0.95), rej);
});
const model = gltf.scene;
const box = new THREE.Box3().setFromObject(model);
const s = LEO_H / (box.max.y - box.min.y);
model.scale.setScalar(s);
model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
model.traverse((o) => { if (o.material) { o.material.envMapIntensity = 0.9; } });
leo.add(model);
leo.position.set(leoBase.x, -H / 2 - 0.12, leoBase.z);

// ---------- Estado que anima la línea de tiempo ----------
const S = {
  hero: 1,                                    // 1 = composición de portada (rig a la derecha)
  cx: 0.0, cy: 0.35, cz: 8.4, tx: 0, ty: -0.1, tz: 0,
  rx: -0.22, ry: -0.42,
  ink: 0, lift: 0, pen: 0,
  leoTurn: 0.4,
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
  else if (a >= 0.8) L = { heroX: 0.3, zoom: 1.3, lift: 0.9, side: 0.6, portrait: true };
  else L = { heroX: 0.55, zoom: 1.7, lift: 1.25, side: 0.35, portrait: true };
}
layout();
addEventListener('resize', () => { layout(); ScrollTrigger.refresh(); });

// ---------- Ratón: Leonardo te sigue con la mirada ----------
const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1; });

// ---------- Anotaciones ----------
const annos = [...document.querySelectorAll('[data-anchor]')].map((el) => ({ el, key: el.dataset.anchor, o: 0 }));
const annoOpacity = { ipad: 1, leoFeet: 1, pencil: 0, nucleus: 0, mito: 0, lift: 0, leoHead: 0 };
const v = new THREE.Vector3();
function anchorWorld(key) {
  switch (key) {
    case 'ipad': return v.set(W / 2 - 0.1, H / 2 - 0.1, D / 2).applyMatrix4(ipad.matrixWorld);
    case 'leoFeet': return v.set(leoBase.x + 0.28, -H / 2 + 0.2, leoBase.z).applyMatrix4(rig.matrixWorld);
    case 'pencil': return pencil.getWorldPosition(v);
    case 'nucleus': return v.set(0.42, -0.2, 0).applyMatrix4(inkGroup.matrixWorld);
    case 'mito': return v.set(-0.58, -0.62, 0).applyMatrix4(inkGroup.matrixWorld);
    case 'lift': return v.set(-0.8, -0.3, 0).applyMatrix4(strokes[1].mesh.matrixWorld);
    case 'leoHead': return v.copy(headLocal).add(new THREE.Vector3(0.1, 0.18, 0)).applyMatrix4(rig.matrixWorld);
  }
}

// ---------- Línea de tiempo con el scroll ----------
const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, paused: true });
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
tl.to(S, { hero: 0, cx: 1.1, cy: -0.05, cz: 6.2, tx: 1.15, ty: -0.3, rx: 0, ry: 0, leoTurn: 0.9, duration: 1.1 }, 0.5);
tl.to(S, { pen: 1, duration: 0.25 }, 1.25);
tl.to(S, { ink: 1, duration: 1.5, ease: 'none' }, 1.35);
tl.to(S, { pen: 0, duration: 0.25 }, 2.85);
showPanel('.p1', 1.2);
anno('pencil', 1.4, 2.8);
anno('nucleus', 2.55, 3.35); anno('mito', 2.75, 3.35);
hidePanel('.p1', 3.0);
// 3 → 4 · la tinta se levanta del papel; giro de cámara
tl.to(S, { lift: 1, cx: 2.6, cy: 0.7, cz: 5.4, tx: 1.35, ty: -0.35, ry: -0.22, duration: 1.0 }, 3.1);
showPanel('.p2', 3.35);
anno('lift', 3.6, 4.25);
hidePanel('.p2', 4.2);
// 4 → 5.3 · el tutor: primer plano de Leonardo
tl.to(S, { cx: headLocal.x - 0.25, cy: headLocal.y + 0.05, cz: headLocal.z + 3.7, tx: headLocal.x - 0.7, ty: headLocal.y - 0.35, tz: headLocal.z, lift: 0.6, ry: -0.35, leoTurn: -0.08, focus: 1, duration: 1.0 }, 4.25);
showPanel('.p3', 4.75);
anno('leoHead', 4.9, 5.75);
hidePanel('.p3', 5.65);
tl.to({}, { duration: 0.3 }, 5.9);

ScrollTrigger.create({
  trigger: '#story', start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 1.1,
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
gsap.fromTo(glFade, { o: 0 }, { o: 1, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '#finale', start: 'top bottom', end: 'top 30%', scrub: true } });
const tl2 = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
tl2.to(S, { hero: 0, cx: 0, cy: 0.7, cz: 11.6, tx: -0.2, ty: 1.35, tz: 0, rx: -0.12, ry: -0.3, lift: 0, leoTurn: 0.35, focus: 0, end: 1, duration: 1 }, 0)
  .fromTo('.p4', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.6);
ScrollTrigger.create({ trigger: '#finale', start: 'top 70%', end: 'bottom bottom', scrub: reduce ? true : 1, onUpdate: (st) => tl2.progress(st.progress) });

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

  // composición
  rig.position.x = S.hero * L.heroX;
  ipad.rotation.set(S.rx + (reduce ? 0 : Math.sin(t * 0.6) * 0.015), S.ry + (reduce ? 0 : mouse.sx * 0.06 * S.hero), 0);
  ipad.position.y = reduce ? 0 : Math.sin(t * 0.8) * 0.03 * S.hero;
  leo.rotation.y = S.leoTurn + mouse.sx * 0.45;
  leo.rotation.x = mouse.sy * 0.06;
  model.position.y = -box.min.y * s + (reduce ? 0 : Math.abs(Math.sin(t * 1.6)) * 0.015);

  // cámara (más lejos y con el foco más arriba en pantallas verticales)
  // en vertical: sujetos centrados y más abajo (el texto va arriba)
  const side = THREE.MathUtils.lerp(L.side ?? 1, 1, S.focus);
  const lift = L.lift + (L.portrait ? S.hero * 0.75 - S.end * 0.85 - S.focus * 0.75 : 0);
  const zoom = L.portrait ? THREE.MathUtils.lerp(L.zoom, 1.3, S.end) : L.zoom;
  const dx = L.portrait ? S.focus * 0.7 : 0;      // en vertical, Leonardo al centro
  camera.position.set(S.cx * zoom * side + dx, S.cy + lift * 0.35, S.cz * zoom);
  camera.lookAt(S.tx * side + dx, S.ty + lift, S.tz);

  drawInk(S.ink);
  pencil.scale.setScalar(Math.max(0.0001, S.pen));

  scene.updateMatrixWorld();
  canvas.style.opacity = glFade.o;
  if (glFade.o > 0.01) renderer.render(scene, camera);

  // anotaciones en pantalla
  for (const a of annos) {
    const o = (annoOpacity[a.key] ?? 0) * glFade.o;
    if (o <= 0.001) { if (a.o !== 0) { a.el.style.opacity = 0; a.o = 0; } continue; }
    const p = anchorWorld(a.key).project(camera);
    const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
    a.el.style.transform = `translate(${x}px,${y}px)`;
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
document.querySelectorAll('[data-split]').forEach((el) => {
  el.innerHTML = el.innerHTML.split(/<br\s*\/?>/).map((ln) =>
    `<span class="line">${[...ln].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</span>`).join('');
});
render();
setProgress(1);
const intro = gsap.timeline({ delay: 0.55 });
intro.to('#loader .ring', { scale: 1.6, opacity: 0, transformOrigin: '50% 50%', duration: 0.8, ease: 'expo.in' })
  .to('#loader', { autoAlpha: 0, duration: 0.6, onComplete: () => document.body.classList.remove('loading') }, '-=0.25')
  .from(rig.scale, { x: 0.82, y: 0.82, z: 0.82, duration: 1.4, ease: 'expo.out' }, '-=0.3')
  .from(rig.rotation, { y: 0.6, duration: 1.6, ease: 'expo.out' }, '<')
  .from('h1 .ch', { yPercent: 115, rotate: 6, duration: reduce ? 0.01 : 1.0, stagger: 0.028, ease: 'expo.out' }, '<0.1')
  .from('.p0 .kicker, .p0 .lead, .p0 .store, .p0 .hint', { opacity: 0, y: 16, duration: 0.7, stagger: 0.08 }, '<0.4');

// ---------- Selector de color ----------
const DARK = { salvia: true, noche: true, blanco: false, pergamino: false };
function applyTheme(t) {
  theme = t;
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('codice-theme', t); } catch {}
  $('#themeName').textContent = THEMES[t];
  document.querySelectorAll('.themes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === t)));
  const dark = DARK[t];
  body.material.color.set(dark ? 0x46443f : 0x2a2622);
  rim.intensity = dark ? 1.6 : 0.4;
  shadow.material.color.set(dark ? 0x000000 : 0xffffff);
  shadow.material.opacity = dark ? 0.9 : 1;
  document.querySelector('meta[name=theme-color]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}
document.querySelectorAll('.themes button').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.t)));
applyTheme(theme);
