// Etapa 1: a pista e a corrida da IA no traçado do jogo (sem os karts parados do mundo do RCL).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KartRace } from '../src/fisica/kart-fisica.js';
import { tracadoDaCorrida, faixa, zebras, linhaChegada, muros } from '../src/pista-dados.js';

const bruto = JSON.parse(fs.readFileSync(new URL('../assets/pista/tracado101.json', import.meta.url), 'utf8'));
const json = tracadoDaCorrida(bruto);

function corre(race, seg, dt = 1 / 30) {
  for (let t = 0; t < seg; t += dt) race.update(dt);
  return race;
}

test('o traçado tem 1.015 m e a pista da corrida não tem karts parados', () => {
  assert.ok(bruto.parados.length > 0);
  assert.equal(json.parados.length, 0);
  const race = new KartRace(json, { seed: 74, pilotos: 10, start: 'grid' });
  assert.ok(Math.abs(race.track.L - 1014.97) < 1, `L = ${race.track.L}`);
  assert.equal(race.obstacles.length, 0);
});

test('geometria da pista: asfalto fechado, zebras, linha de chegada e muros', () => {
  const race = new KartRace(json, { seed: 74, pilotos: 1, start: 'grid' });
  const T = race.track, o = { x: Math.round(T.center.x), z: Math.round(T.center.z) };
  const a = faixa(T, -T.hw, T.hw, o);
  assert.equal(a.pos.length, T.n * 6);
  assert.equal(a.idx.length, T.n * 6);
  assert.ok(a.pos.every(Number.isFinite));
  assert.ok(Math.max(...a.pos.filter((_, i) => i % 3 !== 1).map(Math.abs)) < 200, 'coordenadas locais perto da origem');
  const zb = zebras(T, o);
  assert.ok(zb.pos.length > 0 && zb.pos.length === zb.cor.length);
  const lc = linhaChegada(T, o);
  assert.equal(lc.pos.length / 18, 2 * Math.round(2 * T.hw / 0.5));
  const m = muros(T, o);
  assert.ok(m.pilhas.length > 300, `pilhas = ${m.pilhas.length}`);
  assert.equal(m.jersey.length, 1);
});

test('largada parada em fila: 10 karts dão voltas completas, sem NaN, com tempos de kart rental', () => {
  const race = corre(new KartRace(json, { seed: 74, pilotos: 10, start: 'grid' }), 200);
  for (const k of race.karts) {
    assert.ok(Number.isFinite(k.x) && Number.isFinite(k.z) && Number.isFinite(k.yaw), `kart ${k.dr.numero} sem posição`);
    assert.ok(k.laps.length >= 2, `kart ${k.dr.numero}: ${k.laps.length} voltas`);
    assert.ok(k.best > 50 && k.best < 90, `kart ${k.dr.numero}: melhor ${k.best}`);
  }
  const ordem = race.standings();
  assert.equal(ordem.length, 10);
  assert.ok(ordem[0].dist >= ordem[9].dist);
});
