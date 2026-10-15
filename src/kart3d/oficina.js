// RCL-Karts · oficina (kart.html): ver e ouvir o kart novo antes de ele entrar no jogo. Duas cenas:
// - Oficina: o kart sozinho num palco escuro, girando; acelerador e volante na mão, número e cor; o motor soa como no
//   jogo (o kart "anda" numa esteira: só a velocidade, para ouvir a embreagem patinar, colar e o governador).
// - Pista 101: os 20 karts da IA (montaCorrida do grid.js, só lido) com o desenho novo e o som da corrida (6 vozes com
//   posição e Doppler); câmera atrás, no capacete ou na TV.
// Não mexe no jogo (index.html/main.js): é uma página à parte.
import * as T from 'three';
import { KartView3D } from './kart-view.js';
import { PONTOS, KART_ALUGUEL } from './medidas.js';
import { SomKarts } from '../som/som-karts.js';
import { montaPista } from '../pista.js';
import { tracadoDaCorrida } from '../pista-dados.js';
import { montaCorrida } from '../grid.js';

const CORES = [0xe10600, 0x1f4fbf, 0xf2c419, 0x2e8b3a, 0xff7a1a, 0x7b2fbf, 0x18a7b5, 0xe8e8e8];
const $ = (id) => document.getElementById(id);
const aviso = (t) => { $('aviso').textContent = t; };

const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping;
$('cena').appendChild(renderer.domElement);
const camera = new T.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 2000);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------- comandos
const teclas = new Set();
let segurando = false;
addEventListener('keydown', (e) => { teclas.add(e.code); if (e.code === 'KeyC') camPista.proxima(); if (e.code === 'BracketRight') seguido++; if (e.code === 'BracketLeft') seguido--; });
addEventListener('keyup', (e) => teclas.delete(e.code));
addEventListener('blur', () => teclas.clear());
const botaoAcel = $('acelerar');
botaoAcel.addEventListener('pointerdown', () => { segurando = true; });
addEventListener('pointerup', () => { segurando = false; });
const comandos = () => ({
  acel: teclas.has('KeyW') || teclas.has('ArrowUp') || segurando ? 1 : 0,
  freio: teclas.has('KeyS') || teclas.has('ArrowDown') || teclas.has('Space') ? 1 : 0,
  volante: (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0) - (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0)
});

// ---------------- painel
const sel = $('numero');
for (let n = KART_ALUGUEL.numeros.de; n <= KART_ALUGUEL.numeros.ate; n++) sel.add(new Option(String(n).padStart(3, '0'), n));
sel.value = 44;
let cor = CORES[0];
for (const c of CORES) {
  const b = document.createElement('button');
  b.style.background = '#' + c.toString(16).padStart(6, '0'); b.title = 'cor';
  if (c === cor) b.classList.add('ativo');
  b.onclick = () => { cor = c; for (const x of $('cores').children) x.classList.toggle('ativo', x === b); };
  $('cores').appendChild(b);
}
const som = new SomKarts({ vozes: 6 });
$('ligar').onclick = async () => {
  if (som.ligado) { await som.desliga(); $('ligar').textContent = 'Ligar motor'; return; }
  try { await som.liga(); som.volume(+$('volume').value); $('ligar').textContent = 'Desligar motor'; }
  catch (e) { console.error(e); aviso('Som indisponível neste navegador. ' + e.message); }
};
$('volume').oninput = (e) => som.volume(+e.target.value);
let modo = 'oficina';
for (const b of document.querySelectorAll('.modos button')) b.onclick = () => { modo = b.dataset.modo; for (const x of document.querySelectorAll('.modos button')) x.classList.toggle('ativo', x === b); if (modo === 'pista') pista(); };

// ---------------- oficina: palco escuro (carbono), luz de estúdio com um filete vermelho e um ciano
const oficina = new T.Scene();
oficina.background = new T.Color(0x060608);
oficina.fog = new T.Fog(0x060608, 9, 22);
oficina.add(new T.HemisphereLight(0xdfe6f2, 0x15151a, 1.1));
{
  const key = new T.DirectionalLight(0xffffff, 2.6); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 }); key.shadow.bias = -0.0004;
  oficina.add(key);
  const verm = new T.PointLight(0xe10600, 14, 9); verm.position.set(-3, 1.6, -2.5); oficina.add(verm);
  const ciano = new T.PointLight(0x00a8e8, 8, 9); ciano.position.set(3, 1.2, -3); oficina.add(ciano);
  const chao = new T.Mesh(new T.CircleGeometry(6, 64), new T.MeshStandardMaterial({ color: 0x14141a, roughness: 0.55, metalness: 0.2 }));
  chao.rotation.x = -Math.PI / 2; chao.receiveShadow = true; oficina.add(chao);
  const anel = new T.Mesh(new T.RingGeometry(1.9, 1.94, 96), new T.MeshBasicMaterial({ color: 0xe10600 }));
  anel.rotation.x = -Math.PI / 2; anel.position.y = 0.002; oficina.add(anel);
}
const viewOficina = new KartView3D(oficina, { capacity: 1 });
const kart = { x: 0, y: 0, z: 0, yaw: 0, delta: 0, odo: 0, vx: 0, vy: 0, r: 0, ax: 0, inp: { acel: 0, freio: 0 }, dr: { cor, capacete: 0xf4f4f6, numero: 44 } };
const orbita = { theta: 0.7, phi: 1.2, raio: 4.6, auto: true };
{
  let arr = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { arr = { x: e.clientX, y: e.clientY }; orbita.auto = false; });
  addEventListener('pointerup', () => { arr = null; });
  addEventListener('pointermove', (e) => { if (!arr || modo !== 'oficina') return; orbita.theta -= (e.clientX - arr.x) * 0.006; orbita.phi = Math.min(1.5, Math.max(0.25, orbita.phi - (e.clientY - arr.y) * 0.005)); arr = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('wheel', (e) => { e.preventDefault(); orbita.raio = Math.min(12, Math.max(1.6, orbita.raio * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
}
// esteira: só a velocidade (tração do GX390 caindo com o giro, arrasto, rolamento, freio)
function esteira(dt, c) {
  const v = kart.vx, m = som.motor(kart);
  const tracao = c.acel * Math.min(1500, 8700 / Math.max(v, 1)) * (1 - 0.85 * m.governador) * (m.embreado || m.rpm >= m.m.engata ? 1 : 0);
  const a = (tracao - 0.5 * 1.2 * 0.6 * v * v - 0.02 * 175 * 9.81 * (v > 0.05 ? 1 : 0) - c.freio * 1640 * (v > 0.05 ? 1 : 0)) / 175;
  kart.vx = Math.max(0, v + a * dt); kart.ax = a; kart.odo += kart.vx * dt;
  kart.delta += Math.max(-2.6 * dt, Math.min(2.6 * dt, c.volante * 0.36 - kart.delta));
  kart.inp.acel = c.acel; kart.inp.freio = c.freio;
}

// ---------------- pista 101: os 20 karts da IA com o desenho e o som novos
let cenaPista = null, race = null, viewPista = null, origem = null, seguido = 0;
const camPista = { modo: 0, nomes: ['atrás', 'capacete', 'TV'], proxima() { this.modo = (this.modo + 1) % 3; } };
async function pista() {
  if (cenaPista) return;
  aviso('Carregando a pista 101…');
  const bruto = await fetch('./assets/pista/tracado101.json').then((r) => r.json());
  ({ race } = montaCorrida(tracadoDaCorrida(bruto), { seed: 74, pilotos: 20, jogador: false }));
  const tr = race.track; origem = { x: Math.round(tr.center.x), z: Math.round(tr.center.z) };
  cenaPista = new T.Scene(); cenaPista.background = new T.Color(0x9fb4c8); cenaPista.fog = new T.Fog(0x9fb4c8, 250, 700);
  cenaPista.add(new T.HemisphereLight(0xdfe8f5, 0x3a4a2a, 1.4));
  const sol = new T.DirectionalLight(0xfff2e0, 2.4); sol.position.set(80, 160, -60); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -140, right: 140, top: 90, bottom: -90, near: 10, far: 400 }); sol.shadow.bias = -0.0005;
  cenaPista.add(sol, sol.target);
  montaPista(cenaPista, tr, origem);
  viewPista = new KartView3D(cenaPista, { capacity: 22 });
  aviso('Pista 101 · C troca a câmera · [ ] troca de kart');
}
const _p = new T.Vector3(), _a = new T.Vector3();
function cameraPista(k) {
  const s = Math.sin(k.yaw), c = Math.cos(k.yaw), kx = k.x - origem.x, kz = k.z - origem.z;
  if (camPista.modo === 0) { _p.set(kx - s * 4.4, 1.8, kz - c * 4.4); _a.set(kx + s * 3, 0.6, kz + c * 3); camera.position.lerp(_p, 0.15); }
  else if (camPista.modo === 1) {
    const o = PONTOS.olho; camera.position.set(kx + s * o.z + c * o.x, o.y, kz + c * o.z - s * o.x); _a.set(kx + s * 12, 0.5, kz + c * 12);
  } else {
    const p = {}; race.track.point(k.s + 25, race.track.hw + 9, p); _p.set(p.x - origem.x, 5, p.z - origem.z);
    if (camera.position.distanceTo(_p) > 60) camera.position.copy(_p);
    _a.set(kx, 0.5, kz);
  }
  camera.lookAt(_a);
}

// ---------------- laço
let antes = performance.now(), ultimo = 0;
renderer.setAnimationLoop((agora) => {
  const dt = Math.min(0.05, (agora - antes) / 1000); antes = agora;
  const c = comandos();
  if (modo === 'oficina' || !race) {
    esteira(dt, c);
    kart.dr.cor = cor; kart.dr.numero = +sel.value;
    viewOficina.sync([kart]);
    if (orbita.auto) orbita.theta += dt * 0.25;
    camera.position.set(orbita.raio * Math.sin(orbita.phi) * Math.sin(orbita.theta), 0.35 + orbita.raio * Math.cos(orbita.phi), orbita.raio * Math.sin(orbita.phi) * Math.cos(orbita.theta));
    camera.lookAt(0, 0.35, 0);
    som.update(dt, [kart], { camera, jogador: kart });
    renderer.render(oficina, camera);
  } else {
    race.update(dt);
    const karts = race.karts, k = karts[((seguido % karts.length) + karts.length) % karts.length];
    viewPista.sync(karts, origem);
    cameraPista(k);
    som.update(dt, karts, { camera, origem, jogador: k });
    renderer.render(cenaPista, camera);
  }
  if (agora - ultimo > 100) {
    ultimo = agora;
    const k = modo === 'oficina' || !race ? kart : race.karts[((seguido % race.karts.length) + race.karts.length) % race.karts.length], m = som.motor(k);
    $('rpm').textContent = Math.round(m.rpm).toLocaleString('pt-BR');
    $('kmh').textContent = (Math.hypot(k.vx, k.vy || 0) * 3.6).toFixed(1).replace('.', ',');
    $('embreagem').textContent = m.embreado ? 'Colada' : m.rpm >= m.m.engata ? 'Patinando' : 'Solta';
    $('carga').textContent = Math.round(m.carga * 100) + '%';
  }
});
aviso('Oficina · clique em Ligar motor para ouvir');
globalThis.__rclKarts = { get kart() { return kart; }, get race() { return race; }, som, pista, viewOficina };
