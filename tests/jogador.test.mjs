// Etapa 2: o kart do jogador na corrida da IA, comandado só pela API do Jogador (como o teclado e o controle fazem).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KartRace } from '../vendor/rcl-transito/traffic-kart.js';
import { tracadoDaCorrida } from '../src/pista-dados.js';
import { Jogador, volanteAjudado } from '../src/jogador.js';

const json = tracadoDaCorrida(JSON.parse(fs.readFileSync(new URL('../assets/pista/tracado101.json', import.meta.url), 'utf8')));

// "piloto" de teste: mira 7 m à frente na linha de corrida, pede a curva da pure pursuit (fração da lateral máxima) e
// segue `fator` do perfil de velocidade da IA. Com `teclado`, o volante é só cheio ou zero, com a rampa do Controle.
function piloto({ fator = 0.95, teclado = false } = {}) {
  let vol = 0;
  return (race, k, dt) => {
    const T = race.track, cfg = race.cfg, s = T.wrap(k.s + 7), P = T.point(s, race.lineD(s));
    const dx = P.x - k.x, dz = P.z - k.z, f = Math.sin(k.yaw), c = Math.cos(k.yaw), dist = Math.hypot(dx, dz);
    const erro = Math.atan2(dx * c - dz * f, dx * f + dz * c), alvo = fator * race.profAt(k.prof.v, T.wrap(k.s + 12));
    let u = Math.max(-1, Math.min(1, (2 * Math.max(k.v, 3) ** 2 * Math.sin(erro)) / dist / (cfg.mu * cfg.g)));
    if (teclado) {
      const tecla = u > 0.35 ? 1 : u < -0.35 ? -1 : 0, taxa = tecla === 0 || Math.sign(tecla) !== Math.sign(vol) ? 7 : 4;
      vol += Math.max(-taxa * dt, Math.min(taxa * dt, tecla - vol));
      u = vol;
    }
    return { volante: u, acel: k.v < alvo ? 1 : 0, freio: k.v > alvo + 1.5 ? 1 : 0 };
  };
}

function corre(race, jogador, seg, comando = piloto(), dt = 1 / 60) {
  for (let t = 0; t < seg; t += dt) {
    jogador.aplica(comando(race, jogador.k, dt));
    race.update(dt);
  }
}

test('ajuda no volante: manobra direta devagar, guinada pedida e corrigida rápido', () => {
  const race = new KartRace(json, { seed: 74, pilotos: 1, start: 'grid' }), cfg = race.cfg;
  assert.equal(volanteAjudado(1, { vx: 1, r: 0 }, cfg), cfg.volanteMax);
  const reto = volanteAjudado(1, { vx: 20, r: 0 }, cfg);
  assert.ok(reto > 0 && reto < 0.2, `20 m/s, sem girar ainda: ${reto}`);
  assert.ok(volanteAjudado(1, { vx: 20, r: 0.6 }, cfg) < reto, 'já girando, pede menos volante');
  assert.ok(volanteAjudado(0, { vx: 20, r: 0.3 }, cfg) < 0, 'sem comando, corrige a guinada que sobrou');
  assert.equal(volanteAjudado(-1, { vx: 20, r: 0 }, cfg), -reto);
});

test('o jogador larga por último e a IA não dirige o kart dele', () => {
  const race = new KartRace(json, { seed: 74, pilotos: 10, start: 'grid' });
  const j = new Jogador(race, 9);
  assert.equal(j.k.player, true);
  corre(race, j, 5, () => ({ volante: 0, acel: 0, freio: 1 }));
  assert.ok(j.k.v < 0.1, 'freando parado, o kart não sai do lugar');
  assert.ok(race.karts.filter((k) => !k.player).every((k) => k.v > 3), 'a IA saiu');
});

test('o jogador completa voltas na corrida, sem NaN e no ritmo de kart rental', () => {
  const race = new KartRace(json, { seed: 74, pilotos: 10, start: 'grid' });
  const j = new Jogador(race, 9);
  corre(race, j, 170);
  const k = j.k;
  assert.ok(Number.isFinite(k.x) && Number.isFinite(k.z) && Number.isFinite(k.yaw));
  assert.ok(k.laps.length >= 2, `voltas: ${k.laps.length}`);
  assert.ok(k.best > 55 && k.best < 80, `melhor: ${k.best}`);
  assert.ok(k.offTrack < 1, `fora da pista: ${k.offTrack.toFixed(1)} s`);
});

test('no teclado (volante cheio ou zero) e no ritmo da IA, o kart fica na pista e briga com ela', () => {
  const race = new KartRace(json, { seed: 74, pilotos: 10, start: 'grid' });
  const j = new Jogador(race, 9);
  corre(race, j, 200, piloto({ fator: 1, teclado: true }));
  const melhorIA = Math.min(...race.karts.filter((k) => !k.player).map((k) => k.best));
  assert.ok(j.k.laps.length >= 2, `voltas: ${j.k.laps.length}`);
  assert.ok(j.k.offTrack < 3, `fora da pista: ${j.k.offTrack.toFixed(1)} s`);
  assert.ok(j.k.best < melhorIA + 3, `melhor ${j.k.best.toFixed(2)} contra a IA ${melhorIA.toFixed(2)}`);
});

test('volta à pista: parado na linha de corrida, no sentido da corrida, sem kart em cima', () => {
  const race = new KartRace(json, { seed: 74, pilotos: 10, start: 'grid' });
  const j = new Jogador(race, 9);
  corre(race, j, 20);
  // joga o kart 12 m para fora e de ré
  Object.assign(j.k, { x: j.k.x + 12, z: j.k.z - 5, yaw: j.k.yaw + Math.PI, vx: 6 });
  j.devolve();
  const T = race.track, q = T.project(j.k.x, j.k.z);
  assert.ok(Math.abs(q.d - race.lineD(q.s)) < 0.3, `afastamento da linha: ${q.d - race.lineD(q.s)}`);
  assert.equal(j.k.v, 0);
  const P = T.point(q.s, 0), dir = Math.atan2(P.tx, P.tz);
  assert.ok(Math.abs(Math.atan2(Math.sin(j.k.yaw - dir), Math.cos(j.k.yaw - dir))) < 0.35, 'virado no sentido da corrida');
  assert.ok(race.karts.every((o) => o === j.k || Math.hypot(o.x - j.k.x, o.z - j.k.z) >= 2.5));
  corre(race, j, 10);
  assert.ok(j.k.v > 5, 'sai andando depois de voltar');
});
