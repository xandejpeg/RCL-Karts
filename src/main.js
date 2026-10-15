// RCL-Karts: o Circuito 101 em 3D, a corrida da IA do RCL-Trânsito (traffic-kart.js, cópia congelada), calibrada com os
// dados reais do TrackNight, e o kart do jogador.
import * as T from 'three';
import { KartView } from '../vendor/rcl-transito/traffic-kart-view.js';
import { montaPista } from './pista.js';
import { tracadoDaCorrida } from './pista-dados.js';
import { montaCorrida } from './grid.js';
import { Camera } from './camera.js';
import { Hud } from './hud.js';
import { Controle } from './controle.js';

const PILOTOS = 20;

async function inicia() {
  const bruto = await fetch('./assets/pista/tracado101.json').then((r) => {
    if (!r.ok) throw new Error(`tracado101.json: HTTP ${r.status}`);
    return r.json();
  });
  const json = tracadoDaCorrida(bruto);
  let seed = 74;
  // largada parada em duas colunas, o jogador na última fila (ver grid.js)
  const novaCorrida = () => montaCorrida(json, { seed, pilotos: PILOTOS });
  let { race, jogador } = novaCorrida();
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
  const controle = new Controle();

  let seguido = jogador.k, pausado = false, ultimoHud = 0, antes = performance.now();
  const outroKart = (passo) => {
    const i = race.karts.indexOf(seguido);
    seguido = race.karts[(i + passo + race.karts.length) % race.karts.length];
  };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'c') cam.proximo();
    else if (k === ']') outroKart(1);
    else if (k === '[') outroKart(-1);
    else if (k === 't') jogador.devolve();
    else if (k === 'p' || e.key === 'Escape') pausado = !pausado;
    else if (k === 'h') hud.alterna();
    else if (k === 'r') { seed++; ({ race, jogador } = novaCorrida()); seguido = jogador.k; }
    else return;
    e.preventDefault();
  });

  const quadro = (agora) => {
    const dt = Math.min(0.1, (agora - antes) / 1000);
    antes = agora;
    const cmd = controle.le(dt);
    if (cmd.botoes.has('camera')) cam.proximo();
    if (cmd.botoes.has('pausa')) pausado = !pausado;
    if (!pausado) {
      if (cmd.botoes.has('volta')) jogador.devolve();
      jogador.aplica(cmd);
      race.update(dt);
    }
    view.sync(race.karts, origem);
    cam.update(dt, seguido, origem);
    hud.velocidade(jogador.k);
    if (agora - ultimoHud > 250) {
      hud.update(race, seguido, jogador.k, cam.modo, pausado, controle.controle);
      ultimoHud = agora;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);

  globalThis.__rclKarts = { get race() { return race; }, get jogador() { return jogador; }, snapshot: () => race.snapshot() };
  document.body.classList.add('pronto');
}

inicia().catch((e) => {
  console.error(e);
  const aviso = document.getElementById('aviso');
  aviso.textContent = `Falha ao carregar a pista. ${e.message}`;
  aviso.hidden = false;
});
