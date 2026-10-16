// Etapa 3: kart calibrado com a hot lap do vídeo do 101 (física) e os dados reais do TrackNight (habilidade), números
// reais do KGV e grid de 20 karts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KART_CONFIG, rngK } from '../src/fisica/kart-fisica.js';
import { json, voltaLimpa, LIMPO } from '../ferramentas/calibra.mjs';
import { CFG_101, TABELA, QUANTIS, nivel, acelPiloto, tempoDoQuantil, habilidadeDoTempo } from '../src/calibragem.js';
import { segundosDoKart, acelDoKart, sorteiaNumeros, ORDEM_KGV } from '../src/karts.js';
import { montaCorrida, COR_JOGADOR } from '../src/grid.js';
import { Prova } from '../src/prova.js';

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.round((s.length - 1) * p)]; };

test('a tabela de habilidade ainda bate com a física (volta limpa)', () => {
  const cfg = { ...KART_CONFIG, ...LIMPO, ...CFG_101 };
  for (const p of [1, 0.5, 0]) {
    const r = voltaLimpa(cfg, nivel(p), { voltas: 2, acel: acelPiloto(p) });
    const tab = TABELA.find(([x]) => x === p)[1];
    assert.ok(Math.abs(r.best - tab) < 0.3, `p ${p}: ${r.best.toFixed(2)} contra ${tab}`);
  }
  const top = voltaLimpa(cfg, nivel(1), { voltas: 2 });
  assert.ok(top.vmax > 75 && top.vmax < 83, `máxima da reta: ${top.vmax.toFixed(1)} km/h (vídeo da hot lap: 80,5)`);
  // o limite: no ponto ótimo de aderência (88% do μ; acima disso o pneu passa do pico e escorrega), freada inteira e linha
  // exata, a volta é a do vídeo (0:58,61); usar mais aderência que isso deixa a volta mais lenta (a traseira solta)
  const piloto = (atrito) => voltaLimpa(cfg, { atrito, freio: 1 / cfg.perfil.freio, linha: 0, constancia: 0, nivel: 0.55 }, { voltas: 2 });
  const limite = piloto(1), demais = piloto(1.12);
  assert.ok(limite.best > 58.4 && limite.best < 59, `volta no limite: ${limite.best.toFixed(2)} (vídeo: 58,61)`);
  assert.ok(demais.best > limite.best, 'passar do pico do pneu não compensa');
});

test('distribuição real e habilidade: ida e volta', () => {
  assert.equal(tempoDoQuantil(0), 59.3);
  assert.equal(tempoDoQuantil(0.5), 64.6);
  assert.ok(Math.abs(tempoDoQuantil(0.9) - 70.9) < 1e-9);
  for (const [p, t] of TABELA) assert.ok(Math.abs(habilidadeDoTempo(t) - p) < 1e-9);
  assert.ok(habilidadeDoTempo(QUANTIS[0][1]) > 0.5 && habilidadeDoTempo(75) < -0.6);
});

test('karts: os números reais, o 044 é o melhor e o 012 o pior; os outros, ±0,2 s fixos', () => {
  assert.equal(segundosDoKart(ORDEM_KGV[0]), -0.5);
  assert.equal(segundosDoKart(12), 0.5);
  for (let n = 2; n <= 72; n++) {
    const s = segundosDoKart(n);
    if (!ORDEM_KGV.includes(n)) assert.ok(Math.abs(s) <= 0.2, `kart ${n}: ${s}`);
    assert.equal(s, segundosDoKart(n), 'sempre o mesmo para o mesmo número');
  }
  assert.ok(acelDoKart(44) > 1 && acelDoKart(12) < 1);
  const nums = sorteiaNumeros(20, rngK(1));
  assert.equal(new Set(nums).size, 20);
  assert.ok(nums.every((n) => n >= 2 && n <= 72));
});

test('grid: 20 karts em duas colunas atrás da linha, números únicos, vermelho só no jogador', () => {
  const { race, jogador } = montaCorrida(json, { seed: 74, pilotos: 20 });
  assert.equal(race.karts.length, 20);
  assert.equal(new Set(race.karts.map((k) => k.dr.numero)).size, 20);
  assert.equal(jogador.k.dr.cor, COR_JOGADOR);
  assert.ok(race.karts.every((k) => k === jogador.k || k.dr.cor !== COR_JOGADOR));
  for (const [i, k] of race.karts.entries()) {
    assert.ok(k.dist < 0, `kart ${i} atrás da linha`);
    assert.ok(Math.abs(k.d) < race.track.hw - 0.7, `kart ${i} no asfalto`);
    for (const o of race.karts.slice(i + 1)) assert.ok(Math.hypot(o.x - k.x, o.z - k.z) > 2, 'ninguém em cima de ninguém');
  }
  assert.deepEqual(race.standings().map((k) => k.id), race.karts.map((k) => k.id), 'a torre começa na ordem do grid');
});

test('corrida de 5 min: a IA anda no ritmo sorteado da distribuição real, sem NaN', () => {
  const { race } = montaCorrida(json, { seed: 75, pilotos: 20, jogador: false });
  const prova = new Prova(race, { modo: 'treino' });   // cronometragem na linha do `cronometro`
  for (let t = 0; t < 300; t += 1 / 30) prova.update(1 / 30);
  assert.ok(race.karts.every((k) => Number.isFinite(k.x) && Number.isFinite(k.z) && prova.voltas(k) >= 3));
  const bests = race.karts.map((k) => prova.melhor(k)), alvo = q(race.karts.map((k) => k.dr.alvo), 0.5);
  assert.ok(q(bests, 0) > 58.5 && q(bests, 0) < 64, `melhor da bateria: ${q(bests, 0).toFixed(2)}`);
  // em 5 min (4 voltas, saindo do grid) o pelotão ainda anda em trem atrás dos lentos e a volta boa de cada um não saiu;
  // a prova inteira bate (valida-corrida.mjs, seed 74: mediana 65,6 contra o alvo 65,2)
  const med = q(bests, 0.5);
  assert.ok(med > alvo - 1 && med < alvo + 6, `mediana: ${med.toFixed(2)} (alvo sorteado ${alvo.toFixed(2)})`);
  assert.ok(q(bests, 1) < 82, `mais lento: ${q(bests, 1).toFixed(2)}`);
});
