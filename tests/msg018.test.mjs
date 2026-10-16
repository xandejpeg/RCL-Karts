// RCL-Karts · testes do corpo do piloto na curva (pedido do Xande, 16/10, msg 018): o piloto joga o corpo para dentro aos
// poucos (k.peso), o chassi torce com a carga na hora (k.torce: o lado de dentro sobe, apoiado nas rodas de fora), com o
// corpo jogado para o lado da curva o pneu agarra um pouco mais (e no meio do S, com o corpo ainda do outro lado, não), e
// o desenho e a primeira pessoa vão junto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { KART_CONFIG, kartStep } from '../src/fisica/kart-fisica.js';
import { CFG_101 } from '../src/calibragem.js';

register('./support/three-hook.mjs', import.meta.url);
const T3 = await import('three');

const cfg = { ...KART_CONFIG, ...CFG_101 };
const novo = () => ({ x: 0, z: 0, yaw: 0, vx: 0, vy: 0, r: 0, delta: 0, ax: 0 });

// roda em velocidade fixa (vx reposto a cada passo) com o volante parado em `volante`; devolve o kart e a lateral média
function roda(c, volante, s = 3, v = 12, k = novo()) {
  k.vx = v;
  let soma = 0, n = 0;
  for (let t = 0; t < s; t += c.dt) {
    kartStep(k, { volante, acel: 0, freio: 0 }, c.dt, c);
    k.vx = v;
    if (t > s - 1) { soma += k.vx * k.r; n++; }
  }
  return { k, ay: soma / n };
}

test('curva para a esquerda: o corpo vai para dentro aos poucos, o chassi torce na hora (esquerda sobe)', () => {
  const k = novo();
  k.vx = 12;
  const P = cfg.peso;
  for (let t = 0; t < 0.1; t += cfg.dt) { kartStep(k, { volante: 0.08, acel: 0, freio: 0 }, cfg.dt, cfg); k.vx = 12; }
  assert.ok(k.carga > k.peso, 'o chassi responde antes do corpo');
  const { k: k2 } = roda(cfg, 0.08, 3, 12, k);
  assert.ok(k2.peso > 0.6, `corpo jogado: ${k2.peso.toFixed(2)}`);
  assert.ok(k2.torce > 0 && k2.torce <= P.chassi + 1e-9, 'lado de dentro (esquerda) mais alto');
  assert.ok(Math.abs(k2.ergue - Math.abs(k2.torce) * P.bitola) < 1e-12, 'apoiado nas rodas de fora');
  const dir = roda(cfg, -0.08).k;
  assert.ok(dir.peso < -0.6 && dir.torce < 0, 'para a direita: tudo do outro lado');
});

test('com o corpo jogado o kart faz a curva com um pouco mais de lateral (a 50 km/h, de volante parado)', () => {
  // a maior lateral firme (último 1 s de 4, deriva abaixo de 0,15 rad) varrendo o volante
  const maior = (c) => {
    let best = 0;
    for (let vol = 0.05; vol <= 0.16; vol += 0.005) {
      const k = novo();
      k.vx = 14;
      let s = 0, n = 0, beta = 0;
      for (let t = 0; t < 4; t += c.dt) {
        kartStep(k, { volante: vol, acel: 0, freio: 0 }, c.dt, c); k.vx = 14;
        if (t > 3) { s += k.vx * k.r; n++; beta = Math.max(beta, Math.abs(Math.atan2(k.vy, k.vx))); }
      }
      if (beta < 0.15) best = Math.max(best, s / n);
    }
    return best;
  };
  const sem = maior({ ...cfg, peso: null }), com = maior(cfg);
  assert.ok(com > sem * 1.015 && com < sem * 1.08, `lateral ${(sem / 9.81).toFixed(2)} g → ${(com / 9.81).toFixed(2)} g`);
});

test('no meio do S o corpo ainda está do lado de antes: sem ganho até ele passar para o outro lado', () => {
  const { k } = roda(cfg, 0.08, 2, 12);
  assert.ok(k.peso > 0.6, `peso ${k.peso}`);
  // vira para a direita: nos primeiros passos a lateral já é para a direita e o corpo ainda está à esquerda
  let semGanho = 0;
  for (let i = 0; i < 60; i++) {
    kartStep(k, { volante: -0.08, acel: 0, freio: 0 }, cfg.dt, cfg); k.vx = 12;
    if (k.vx * k.r < 0 && k.peso > 0) semGanho++;
  }
  assert.ok(semGanho > 0, 'tem passos com a lateral de um lado e o corpo do outro');
});

test('de ré o corpo não vai para o lado', () => {
  const k = novo();
  k.peso = 0.8;
  k.re = true;
  for (let t = 0; t < 1.5; t += cfg.dt) kartStep(k, { volante: 0.3, acel: 0, freio: 0, re: 1 }, cfg.dt, cfg);
  assert.ok(Math.abs(k.peso) < 0.01, `peso ${k.peso}`);
});

test('desenho: o tronco do piloto vai para dentro da curva (esquerda = +x) e continua reclinado', async () => {
  const { PilotosView, INCLINA_CURVA } = await import('../src/pilotos.js');
  const it = { assento: new T3.Group() };
  PilotosView.prototype.inclinaTronco.call({}, it, { peso: 1 }, 1 / 60);
  const cima = new T3.Vector3(0, 1, 0).applyQuaternion(it.assento.quaternion);
  assert.ok(cima.x > Math.sin(INCLINA_CURVA) * 0.8, `tronco para a esquerda: ${cima.x.toFixed(2)}`);
  assert.ok(cima.z < 0, 'reclinado para trás (−z)');
  PilotosView.prototype.inclinaTronco.call({}, it, { peso: -1 }, 1 / 60);
  assert.ok(new T3.Vector3(0, 1, 0).applyQuaternion(it.assento.quaternion).x < 0, 'curva para a direita: tronco para a direita');
});

test('primeira pessoa: na curva para a esquerda a cabeça vai para dentro e inclina para a esquerda; a vista torce com o chassi', async () => {
  const { PrimeiraPessoa } = await import('../src/primeira-pessoa.js');
  // (o chassi torcendo chega pela pose do kart: k.y e k.rolagem, como o relevo)
  const pose = (peso, torce = 0) => {
    const pp = new PrimeiraPessoa([0, 0.9, -0.3]), k = { x: 0, z: 0, y: Math.abs(torce) * 0.6, yaw: 0, v: 12, vx: 12, r: 1.4, peso, rolagem: torce };
    let p = null;
    for (let i = 0; i < 180; i++) p = pp.pose(k, { x: 0, z: 0 }, 1 / 60);
    return { pos: p.pos.clone(), cima: new T3.Vector3(0, 1, 0).applyQuaternion(p.quat) };
  };
  const solto = pose(0), jogado = pose(1), torto = pose(1, 0.04);
  assert.ok(jogado.pos.x > solto.pos.x + 0.1, 'cabeça para dentro (esquerda)');
  assert.ok(jogado.pos.x > 0, 'contra a força da curva');
  assert.ok(jogado.cima.x > solto.cima.x + 0.1, 'inclina para a esquerda');
  assert.ok(torto.pos.y > jogado.pos.y, 'o chassi sobe do lado de dentro');
});

test('na corrida o chassi torcendo entra na pose do kart (k.y e k.rolagem), que o desenho e a câmera já usam', async () => {
  const fs = await import('node:fs');
  const { tracadoDaCorrida } = await import('../src/pista-dados.js');
  const { montaCorrida } = await import('../src/grid.js');
  const json = tracadoDaCorrida(JSON.parse(fs.readFileSync(new URL('../assets/pista/tracado101.json', import.meta.url), 'utf8')));
  const { race } = montaCorrida(json, { seed: 9, pilotos: 2, jogador: false });
  let viu = 0;
  for (let t = 0; t < 40; t += 1 / 60) {
    race.update(1 / 60);
    for (const k of race.karts) {
      if (Math.abs(k.torce || 0) < 0.03 || Math.abs(k.d) > race.track.hw) continue;
      // a pose sem o chassi: a do chão ali
      const T = race.track, inc = T.inclinacao(k.s), tq = T.point(k.s, 0), dh = T.rampa(k.s), gx = dh * tq.tx - inc * tq.tz, gz = dh * tq.tz + inc * tq.tx;
      const chao = Math.atan(gx * Math.cos(k.yaw) - gz * Math.sin(k.yaw));
      assert.ok(Math.abs(k.rolagem - chao - k.torce) < 1e-9, 'rolagem = chão + chassi');
      assert.ok(Math.abs(k.y - T.altura(k.s, k.d) - k.ergue) < 1e-9, 'altura = chão + o que a roda de dentro levanta');
      viu++;
    }
  }
  assert.ok(viu > 50, `karts torcendo na curva: ${viu}`);
});
