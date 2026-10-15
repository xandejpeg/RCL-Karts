// RCL-Karts · etapa 1: o Circuito 101 em 3D e a corrida da IA do RCL-Trânsito (traffic-kart.js, cópia congelada).
import * as T from 'three';
import { KartRace } from '../vendor/rcl-transito/traffic-kart.js';
import { KartView } from '../vendor/rcl-transito/traffic-kart-view.js';
import { montaPista } from './pista.js';
import { tracadoDaCorrida } from './pista-dados.js';
import { Camera } from './camera.js';
import { Hud } from './hud.js';

const PILOTOS = 10;

async function inicia() {
  const bruto = await fetch('./assets/pista/tracado101.json').then((r) => {
    if (!r.ok) throw new Error(`tracado101.json: HTTP ${r.status}`);
    return r.json();
  });
  const json = tracadoDaCorrida(bruto);
  let seed = 74;
  // Largada parada em fila atrás da linha. O traffic-kart.js só acerta a distância percorrida (ordem da torre) na lançada.
  const novaCorrida = () => {
    const r = new KartRace(json, { seed, pilotos: PILOTOS, start: 'grid' });
    for (const k of r.karts) k.dist = r.rel({ s: 0 }, k);
    return r;
  };
  let race = novaCorrida();
  const track = race.track;
  const origem = { x: Math.round(track.center.x), z: Math.round(track.center.z) };

  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  document.getElementById('cena').appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color(0x9fb4c8);
  scene.fog = new T.Fog(0x9fb4c8, 250, 700);
  scene.add(new T.HemisphereLight(0xdfe8f5, 0x3a4a2a, 1.4));
  const sol = new T.DirectionalLight(0xfff2e0, 2.4);
  sol.position.set(track.center.x - origem.x + 80, 160, track.center.z - origem.z - 60);
  sol.target.position.set(track.center.x - origem.x, 0, track.center.z - origem.z);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -140, right: 140, top: 90, bottom: -90, near: 10, far: 400 });
  sol.shadow.bias = -0.0005;
  scene.add(sol, sol.target);

  montaPista(scene, track, origem);
  const view = new KartView(scene, { capacity: PILOTOS + 2 });

  const camera = new T.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
  const cam = new Camera(camera, renderer.domElement, track, origem);
  const hud = new Hud(document.getElementById('hud'));

  let seguido = 0, pausado = false, ultimoHud = 0, antes = performance.now();
  const kartSeguido = () => race.karts[seguido % race.karts.length];

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'c') cam.proximo();
    else if (e.key === 'ArrowRight') seguido = (seguido + 1) % race.karts.length;
    else if (e.key === 'ArrowLeft') seguido = (seguido - 1 + race.karts.length) % race.karts.length;
    else if (k === 'p') pausado = !pausado;
    else if (k === 'h') hud.alterna();
    else if (k === 'r') { seed++; race = novaCorrida(); }
    else return;
    e.preventDefault();
  });

  const quadro = (agora) => {
    const dt = Math.min(0.1, (agora - antes) / 1000);
    antes = agora;
    if (!pausado) race.update(dt);
    view.sync(race.karts, origem);
    cam.update(dt, kartSeguido(), origem);
    if (agora - ultimoHud > 250) {
      hud.update(race, kartSeguido(), cam.modo, pausado);
      ultimoHud = agora;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);

  globalThis.__rclKarts = { get race() { return race; }, snapshot: () => race.snapshot() };
  document.body.classList.add('pronto');
}

inicia().catch((e) => {
  console.error(e);
  const aviso = document.getElementById('aviso');
  aviso.textContent = `Falha ao carregar a pista. ${e.message}`;
  aviso.hidden = false;
});
