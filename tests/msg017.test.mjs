// RCL-Karts · testes do pedido do Xande de 16/10 (msg 017): o jogador no ritmo médio (limitador por trecho e motor do
// piloto médio; na largada sai junto com o pelotão), o treino sozinho (só o kart do jogador, sem luzes, conta volta) e as
// peças de desempenho (a resolução desce com quadro lento e volta devagar; a sombra anda com a câmera em passos de texel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import { tracadoDaCorrida } from '../src/pista-dados.js';
import { montaCorrida, limiteDoTrecho, LIMITADOR } from '../src/grid.js';
import { Prova, MODOS } from '../src/prova.js';
import { acelPiloto } from '../src/calibragem.js';

register('./support/three-hook.mjs', import.meta.url);
const T3 = await import('three');
const { ResolucaoAdaptativa, SombraQueSegue, DESEMPENHO } = await import('../src/desempenho.js');

const json = tracadoDaCorrida(JSON.parse(fs.readFileSync(new URL('../assets/pista/tracado101.json', import.meta.url), 'utf8')));

// piloto de teste: mira 7 m à frente no centro e pé embaixo
const peEmbaixo = (j) => {
  const k = j.k, T = j.race.track, P = T.point(T.wrap(k.s + 7), k.d * 0.95), dx = P.x - k.x, dz = P.z - k.z, f = Math.sin(k.yaw), c = Math.cos(k.yaw);
  j.aplica({ volante: Math.max(-1, Math.min(1, Math.atan2(dx * c - dz * f, dx * f + dz * c) * 3)), acel: 1, freio: 0 });
};

test('limitador: um trecho a cada ~50 m, velocidades de kart rental, e o jogador não passa dele', () => {
  const { race, jogador } = montaCorrida(json, { seed: 3, pilotos: 4 });
  const L = jogador.limite;
  assert.equal(L.v.length, Math.round(race.track.L / LIMITADOR.trecho));
  assert.ok(Math.max(...L.v) * 3.6 > 65 && Math.max(...L.v) * 3.6 < 85, `máxima ${(Math.max(...L.v) * 3.6).toFixed(1)} km/h`);
  assert.ok(Math.min(...L.v) * 3.6 > 30, 'nenhum trecho abaixo de 30 km/h');
  assert.ok(Math.abs(jogador.fatorAcel - jogador.k.acelKart * acelPiloto(0)) < 1e-9, 'motor do piloto médio');
  // pé embaixo: na reta dos boxes a velocidade fica no limite do trecho (mais a faixa do corte); acima do limite (entrando
  // rápido num trecho mais lento) o motor não empurra
  let passou = 0, empurrou = 0;
  for (let t = 0; t < 9; t += 1 / 60) {
    peEmbaixo(jogador);
    const k = jogador.k, acima = k.vx - L.em(k.s);
    if (acima > L.faixa / 2 + 1e-6 && k.inp.acel > 0) empurrou++;
    race.update(1 / 60);
    if (t < 5) passou = Math.max(passou, jogador.k.vx - L.em(jogador.k.s));
  }
  assert.ok(passou < L.faixa + 0.3, `passou ${passou.toFixed(2)} m/s do limite na reta`);
  assert.equal(empurrou, 0, 'acima do limite, o motor corta');
});

test('largada: com o pé embaixo, o jogador sai no meio do pelotão (nem na frente de todos, nem atrás)', () => {
  const { race, jogador } = montaCorrida(json, { seed: 74, pilotos: 20 });
  const s0 = new Map(race.karts.map((k) => [k, k.dist]));
  for (let t = 0; t < 6; t += 1 / 60) { peEmbaixo(jogador); race.update(1 / 60); }
  const ganho = (k) => k.dist - s0.get(k), ia = race.karts.filter((k) => !k.player).map(ganho).sort((a, b) => a - b);
  const eu = ganho(jogador.k);
  assert.ok(eu < ia[ia.length - 1] + 0.5, `jogador ${eu.toFixed(1)} m, melhor IA ${ia[ia.length - 1].toFixed(1)} m`);
  assert.ok(eu > ia[Math.floor(ia.length * 0.25)] - 1, `jogador ${eu.toFixed(1)} m, IA (1º quartil) ${ia[Math.floor(ia.length * 0.25)].toFixed(1)} m`);
});

test('treino sozinho: só o kart do jogador, sem luzes, conta as voltas', () => {
  assert.ok(MODOS.sozinho?.sozinho && MODOS.sozinho.livre);
  const { race, jogador } = montaCorrida(json, { seed: 5, pilotos: 1 });
  assert.equal(race.karts.length, 1);
  const prova = new Prova(race, { modo: 'sozinho', jogador: jogador.k });
  assert.equal(prova.fase, 'correndo');
  assert.equal(prova.restante.texto, MODOS.sozinho.nome);
  const T = race.track;
  for (let t = 0; t < 170; t += 1 / 60) {
    const k = jogador.k, vAlvo = k.prof.v[T.idx(T.wrap(k.s + 12))] * 0.85, P = T.point(T.wrap(k.s + 7), 0), dx = P.x - k.x, dz = P.z - k.z, f = Math.sin(k.yaw), c = Math.cos(k.yaw);
    jogador.aplica({ volante: Math.max(-1, Math.min(1, Math.atan2(dx * c - dz * f, dx * f + dz * c) * 3)), acel: k.vx < vAlvo ? 1 : 0, freio: k.vx > vAlvo + 1 ? 0.4 : 0 });
    prova.update(1 / 60);
  }
  assert.ok(prova.voltas(jogador.k) >= 2 && prova.melhor(jogador.k) > 58, `voltas ${prova.voltas(jogador.k)}, melhor ${prova.melhor(jogador.k)}`);
  assert.equal(prova.bandeira, null, 'treino não tem bandeirada');
});

test('resolução adaptativa: quadro lento desce um passo; firme volta, e a espera dobra no nível que falhou', () => {
  const r = { pr: 0, setPixelRatio(v) { this.pr = v; } }, P = { ...DESEMPENHO.resolucao, max: 1.5 };
  globalThis.devicePixelRatio = 2;
  const ra = new ResolucaoAdaptativa(r, P);
  assert.equal(r.pr, 1.5);
  const roda = (ms, s) => { for (let t = 0; t < s; t += ms / 1000) ra.quadro(ms / 1000); };
  roda(40, 3);
  assert.ok(r.pr < 1.5 && r.pr >= P.min, `desceu para ${r.pr}`);
  const baixo = r.pr;
  roda(40, 30);
  assert.ok(Math.abs(r.pr - P.min) < 1e-9, 'continua lento: vai até o mínimo');
  roda(16.7, P.sobe + 1);
  assert.ok(r.pr > P.min, 'firme: sobe um passo');
  roda(16.7, 120);
  assert.ok(r.pr >= baixo - 1e-9, 'com o tempo volta');
});

test('sombra que segue: a caixa vai com a câmera, cresce com a altura e anda em passos de texel', () => {
  const sol = new T3.DirectionalLight();
  sol.position.set(80, 160, -60);
  sol.target.position.set(0, 0, 0);
  const s = new SombraQueSegue(sol), cam = new T3.PerspectiveCamera();
  cam.position.set(100, 2, 50);
  cam.lookAt(100, 2, 80);
  cam.updateMatrixWorld();
  s.update(cam);
  const P = DESEMPENHO.sombra, alvo = sol.target.position;
  assert.ok(Math.hypot(alvo.x - 100, alvo.z - (50 + P.meio * P.frente)) < 2, `alvo em ${alvo.x.toFixed(1)}, ${alvo.z.toFixed(1)}`);
  const d = sol.position.clone().sub(alvo);
  assert.ok(d.distanceTo(new T3.Vector3(80, 160, -60)) < 1e-6, 'a direção do sol não muda');
  assert.ok(sol.shadow.camera.right < 60, 'caixa pequena perto do chão');
  // andou menos de meio texel: o alvo não sai do lugar
  const a0 = alvo.clone();
  cam.position.x += ((2 * s.meioAtual) / P.mapa) * 0.2;
  cam.updateMatrixWorld();
  s.update(cam);
  assert.ok(alvo.distanceTo(a0) < 1e-6 || alvo.distanceTo(a0) > ((2 * s.meioAtual) / P.mapa) * 0.5, 'passo de texel');
  cam.position.set(0, 220, 0);
  cam.lookAt(0, 0, 1);
  cam.updateMatrixWorld();
  s.update(cam);
  assert.equal(sol.shadow.camera.right, P.max, 'câmera do alto: pista inteira');
});

test('primeira pessoa de ré: a vista vai para a cabeça do piloto debruçado e olha mais para baixo', async () => {
  const { PrimeiraPessoa, PP } = await import('../src/primeira-pessoa.js');
  const pp = new PrimeiraPessoa([0, 0.9, -0.3]), origem = { x: 0, z: 0 };
  const k = { x: 10, z: 20, y: 1, yaw: 0, v: 0, vx: -0.5, re: false, cabeca3d: new T3.Vector3(10, 1.55, 20.35) };
  const q0 = pp.pose(k, origem, 1 / 60).quat.clone();
  k.re = true;
  let p = null;
  for (let i = 0; i < 120; i++) p = pp.pose(k, origem, 1 / 60);
  const alvo = k.cabeca3d.clone().add(new T3.Vector3(...PP.re.olho));
  assert.ok(p.pos.distanceTo(alvo) < 0.01, `olho a ${p.pos.distanceTo(alvo).toFixed(3)} m da cabeça`);
  const frente = (q) => new T3.Vector3(0, 0, -1).applyQuaternion(q);
  assert.ok(frente(p.quat).y < frente(q0).y - 0.2, 'olha mais para baixo (as mãos nas rodas)');
});
