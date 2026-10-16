// RCL-Karts: o Circuito 101 em 3D, a corrida da IA do RCL-Trânsito (traffic-kart.js, cópia congelada), calibrada com os
// dados reais do TrackNight, o kart do jogador e a prova completa (luzes, bandeirada, folha KGV e ranking local).
import * as T from 'three';
import { KartView } from '../vendor/rcl-transito/traffic-kart-view.js';
import { montaPista } from './pista.js';
import { montaCenario } from './cenario.js';
import { tracadoDaCorrida } from './pista-dados.js';
import { montaCorrida } from './grid.js';
import { Prova, linhaDe, MODOS } from './prova.js';
import { carregaKart, KartGlbView } from './kart-glb.js';
import { olhoCockpit } from './kart-contrato.js';
import { carregaPilotos, PilotosView } from './pilotos.js';
import { PONTOS_PROVISORIO } from './piloto-assento.js';
import { sorteiaNomes } from './nomes.js';
import { Ranking, registroDaFolha } from './ranking.js';
import { Camera } from './camera.js';
import { Hud } from './hud.js';
import { Telas } from './telas.js';
import { Controle } from './controle.js';
import { DESEMPENHO, SombraQueSegue, ResolucaoAdaptativa } from './desempenho.js';   // (Claude, msg 017: mais leve)

const PILOTOS = 20;
// depois da bandeirada do jogador, a folha aparece quando todos chegam ou depois deste tempo
const FOLHA_APOS_CHEGADA = 30;

async function inicia() {
  const bruto = await fetch('./assets/pista/tracado101.json').then((r) => {
    if (!r.ok) throw new Error(`tracado101.json: HTTP ${r.status}`);
    return r.json();
  });
  const json = tracadoDaCorrida(bruto);
  let seed = Math.floor(Math.random() * 1e6);
  let { race, jogador } = montaCorrida(json, { seed, pilotos: PILOTOS });
  const track = race.track;
  const origem = { x: Math.round(track.center.x), z: Math.round(track.center.z) };

  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, DESEMPENHO.resolucao.max));   // (msg 017: era até 2; a ResolucaoAdaptativa ajusta)
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
  sol.shadow.mapSize.set(DESEMPENHO.sombra.mapa, DESEMPENHO.sombra.mapa);   // (msg 017: a caixa da sombra segue a câmera)
  Object.assign(sol.shadow.camera, { left: -140, right: 140, top: 90, bottom: -90, near: 10, far: 400 });
  sol.shadow.bias = -0.0005;
  scene.add(sol, sol.target);
  const sombra = new SombraQueSegue(sol), resolucao = new ResolucaoAdaptativa(renderer);

  montaPista(scene, track, origem);
  montaCenario(scene, track, origem, linhaDe(track));
  let view = new KartView(scene, { capacity: PILOTOS + 2 });

  const camera = new T.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
  const cam = new Camera(camera, renderer.domElement, track, origem);

  // arte do kart: o GLB do manifesto (assets/arte.json) ou o kart de teste do contrato (?kart=teste). Sem arte, ou com o
  // contrato quebrado, fica o desenho provisório.
  const trocaKart = async () => {
    const teste = new URLSearchParams(location.search).get('kart') === 'teste';
    const arte = teste ? { kart: 'tests/fixtures/kart-contrato.glb' } : await fetch('./assets/arte.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    if (!arte.kart) return;
    try {
      const { cena, contrato, lod } = await carregaKart(arte.kart);
      for (const a of contrato.avisos) console.warn('RCL-Karts: arte do kart:', a);
      if (!contrato.ok) { console.warn(`RCL-Karts: arte do kart sem os nós ${contrato.faltam.join(', ')}; fica o provisório`); return; }
      view.dispose();
      view = new KartGlbView(scene, cena, contrato, { capacity: PILOTOS + 2, lod });
      cam.olho = olhoCockpit(contrato.pontos);
      ajustaPilotos();
    } catch (e) {
      console.warn('RCL-Karts: não deu para carregar a arte do kart; fica o provisório', e);
    }
  };
  trocaKart();

  // pilotos de verdade (assets/personagens/, fora do git): sentados nos pontos do kart em uso; o provisório some
  let pilotos = null;
  const ajustaPilotos = () => {
    if (!pilotos) return;
    pilotos.pontos(view.pontos ?? PONTOS_PROVISORIO);
    if (view.mostraPilotoProvisorio) view.mostraPilotoProvisorio(false);
    else for (const P of view.parts || []) if (/Capsule|Sphere/.test(P.g.type)) P.mesh.visible = false;
  };
  carregaPilotos().then((modelos) => {
    if (!modelos.length) return;
    pilotos = new PilotosView(scene, modelos, { capacity: PILOTOS + 2 });
    ajustaPilotos();
  });
  const hud = new Hud(document.getElementById('hud'));
  const controle = new Controle();
  const ranking = new Ranking();
  const telas = new Telas(document.getElementById('telas'), ranking);

  // estado: 'menu' (pista vazia girando, tela inicial) ou 'prova'
  let estado = 'menu', prova = null, nomes = new Map(), seguido = jogador.k, pausado = false;
  let folhaMostrada = false, ultimaFolha = null, registrou = false, ultimoHud = 0, antes = performance.now();
  const outroKart = (passo) => {
    const i = race.karts.indexOf(seguido);
    seguido = race.karts[(i + passo + race.karts.length) % race.karts.length];
  };

  // treino não tem folha: a melhor volta entra no ranking quando sai dele
  const guardaTreino = () => {
    if (!prova || !prova.modo?.livre || registrou || prova.melhor(jogador.k) == null) return;
    const d = prova.dados.get(jogador.k);
    ranking.guarda({
      data: new Date().toISOString(), modo: prova.chave, nome: telas.nome, kart: String(jogador.k.dr.numero).padStart(3, '0'),
      pos: null, de: null, voltas: d.voltas.length, melhor: d.melhor, total: null,
      s1: d.melhorSetor[0], s2: d.melhorSetor[1], s3: d.melhorSetor[2], sfspd: d.sf.length ? Math.max(...d.sf) : null
    });
    registrou = true;
  };

  const largar = () => {
    guardaTreino();
    seed++;
    // (treino sozinho: só o kart do jogador — Claude, msg 017)
    ({ race, jogador } = montaCorrida(json, { seed, pilotos: MODOS[telas.modo]?.sozinho ? 1 : PILOTOS }));
    prova = new Prova(race, { modo: telas.modo, jogador: jogador.k });
    const ficticios = sorteiaNomes(race.karts.length, seed);
    nomes = new Map(race.karts.map((k, i) => [k, k === jogador.k ? telas.nome : ficticios[i]]));
    seguido = jogador.k;
    estado = 'prova';
    pausado = false;
    folhaMostrada = false;
    registrou = false;
    cam.auto = false;
    cam.modo = 'segue';
    cam.iniciou = false;
    telas.fecha();
    hud.mostra(true);
  };

  const menu = () => {
    guardaTreino();
    estado = 'menu';
    prova = null;
    pausado = false;
    cam.modo = 'topo';
    cam.auto = true;
    hud.mostra(false);
    telas.inicio();
  };

  const mostraFolha = () => {
    const linhas = prova.folha(nomes);
    ultimaFolha = { prova, linhas, k: jogador.k };
    if (!registrou) {
      const eu = linhas.find((l) => l.k === jogador.k);
      if (eu) ranking.guarda(registroDaFolha(eu, { modo: prova.chave, de: linhas.length, nome: telas.nome }));
      registrou = true;
    }
    folhaMostrada = true;
    hud.mostra(false);
    telas.folha(prova, linhas, jogador.k);
  };

  const pausa = (sim) => {
    if (estado !== 'prova' || folhaMostrada) return;
    pausado = sim;
    if (sim) telas.pausa(); else telas.fecha();
  };

  Object.assign(telas.acoes, {
    largar,
    continuar: () => pausa(false),
    recomecar: largar,
    menu,
    ranking: () => telas.rankingTela(telas.atual === 'folha' ? 'voltaFolha' : 'inicio'),
    inicio: () => telas.inicio(),
    voltaFolha: () => ultimaFolha && telas.folha(ultimaFolha.prova, ultimaFolha.linhas, ultimaFolha.k)
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.target.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape' || k === 'p') pausa(!pausado);
    else if (estado !== 'prova' || telas.aberta()) return;
    else if (k === 'c') cam.proximo();
    else if (k === ']') outroKart(1);
    else if (k === '[') outroKart(-1);
    else if (k === 't') jogador.devolve();
    else if (k === 'h') hud.alterna();
    else if (k === 'r') largar();
    else return;
    e.preventDefault();
  });

  let msQuadro = 0;
  const quadro = (agora) => {
    const t0 = performance.now();
    // (msg 017: no máximo 1/20 s de jogo por quadro — num quadro lento o jogo anda um pouco mais devagar em vez de rodar 12
    // passos de física de uma vez e deixar o próximo quadro ainda mais lento)
    const dt = Math.min(0.05, (agora - antes) / 1000), antes0 = antes;
    antes = agora;
    const cmd = controle.le(dt);
    if (estado === 'prova') {
      if (cmd.botoes.has('pausa')) pausa(!pausado);
      if (!pausado) {
        if (cmd.botoes.has('camera')) cam.proximo();
        if (cmd.botoes.has('volta') && prova.fase !== 'luzes') jogador.devolve();
        if (prova.fase !== 'luzes') jogador.aplica(cmd);
        prova.update(dt);
        const chegou = prova.dados.get(jogador.k).chegou;
        if (!folhaMostrada && (prova.fase === 'fim' || (chegou && race.time - chegou.t > FOLHA_APOS_CHEGADA))) mostraFolha();
      }
      hud.quadro(prova, jogador.k);
      if (agora - ultimoHud > 250) {
        hud.update({ prova, seguido, jogador: jogador.k, modoCamera: cam.modo, controle: controle.controle });
        ultimoHud = agora;
      }
    }
    view.sync(race.karts, origem, camera.position);
    pilotos?.sync(race.karts, origem, camera.position, dt);
    cam.update(dt, seguido, origem);
    sombra.update(camera);
    resolucao.quadro((agora - antes0) / 1000);
    renderer.render(scene, camera);
    // medida: ms de trabalho do quadro (JS + envio do desenho), média móvel
    msQuadro = msQuadro * 0.95 + (performance.now() - t0) * 0.05;
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);

  globalThis.__rclKarts = {
    get race() { return race; }, get jogador() { return jogador; }, get prova() { return prova; }, get estado() { return estado; },
    get pilotos() { return pilotos; }, get view() { return view; }, cam,
    medidas: () => ({ msQuadro: +msQuadro.toFixed(2), chamadas: renderer.info.render.calls, triangulos: renderer.info.render.triangles, resolucao: renderer.getPixelRatio() }),
    largar, menu, snapshot: () => race.snapshot()
  };
  document.body.classList.add('pronto');
  menu();
}

inicia().catch((e) => {
  console.error(e);
  const aviso = document.getElementById('aviso');
  aviso.textContent = `Falha ao carregar a pista. ${e.message}`;
  aviso.hidden = false;
});
