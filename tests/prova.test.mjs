// Etapa 4: a prova completa (luzes, setores, bandeirada, folha KGV), o ranking local e os nomes fictícios.
import test from 'node:test';
import assert from 'node:assert/strict';
import { json } from '../ferramentas/calibra.mjs';
import { montaCorrida } from '../src/grid.js';
import { Prova, MODOS, limitesSetores, linhaKgv, COLUNAS_KGV, FRACAO_SETORES } from '../src/prova.js';
import { Ranking, registroDaFolha, CHAVE } from '../src/ranking.js';
import { sorteiaNomes, PRENOMES, SOBRENOMES } from '../src/nomes.js';

const TEMPO = /^(\d+:\d{2}|\d{1,2})\.\d{3}$/;

function roda(prova, ate, max = 900, dt = 1 / 30) {
  for (let t = 0; t < max && !ate(prova); t += dt) prova.update(dt);
  return prova;
}

test('setores: fins de S1 e S2 em ordem, nas frações de tempo das folhas reais', () => {
  const { race } = montaCorrida(json, { seed: 74, pilotos: 1, jogador: false });
  const [a, b] = limitesSetores(race);
  assert.ok(a > 0 && a < b && b < race.track.L, `${a} ${b}`);
  assert.deepEqual(FRACAO_SETORES, [0.232, 0.637]);
});

test('luzes: cinco, uma por segundo; a corrida só anda quando apagam', () => {
  const { race } = montaCorrida(json, { seed: 74, pilotos: 4, jogador: false });
  const prova = new Prova(race, { modo: 'curta', rnd: () => 0.5 });
  assert.equal(prova.fase, 'luzes');
  for (let t = 0; t < 3.05; t += 0.05) prova.update(0.05);
  assert.equal(prova.luzesAcesas, 3);
  assert.equal(race.time, 0);
  assert.ok(race.karts.every((k) => k.v === 0));
  roda(prova, (p) => p.fase !== 'luzes', 10, 0.05);
  assert.equal(prova.fase, 'correndo');
  assert.ok(prova.tLuzes >= 5.4 && prova.tLuzes <= 7.3);
  assert.equal(new Prova(race, { modo: 'treino' }).fase, 'correndo', 'treino sem luzes');
});

test('corrida curta: bandeirada na última volta do líder, todos chegam, folha no formato KGV', () => {
  const { race } = montaCorrida(json, { seed: 76, pilotos: 12, jogador: false });
  const prova = new Prova(race, { modo: 'curta', rnd: () => 0 });
  prova.modo = { ...MODOS.curta, voltas: 3 };   // (3 voltas no teste, para rodar rápido)
  roda(prova, (p) => p.fase === 'fim');
  assert.equal(prova.fase, 'fim');
  const nomes = new Map(race.karts.map((k, i) => [k, sorteiaNomes(12, 76)[i]]));
  const folha = prova.folha(nomes);
  assert.equal(folha.length, 12);
  assert.equal(folha[0].voltas, 3);
  assert.equal(folha[0].diff, '');
  assert.equal(folha[0].espaco, '');
  for (const [i, l] of folha.entries()) {
    assert.equal(l.pos, i + 1);
    assert.match(l.numero, /^\d{3}$/);
    assert.equal(l.classe, 'RENTAL');
    assert.ok(l.nome.length > 3);
    assert.ok(l.voltas >= 2 && l.voltas <= 3, `P${l.pos}: ${l.voltas} voltas`);
    if (i) assert.ok(TEMPO.test(l.diff) || /^\d+ Voltas?$/.test(l.diff), `diff "${l.diff}"`);
    assert.ok(l.s1 > 8 && l.s2 > 15 && l.s3 > 12, `setores ${l.s1} ${l.s2} ${l.s3}`);
    assert.ok(l.s1 + l.s2 + l.s3 <= l.melhor + 0.05, 'a soma dos melhores setores não passa da melhor volta');
    assert.ok(l.sfspd > 50 && l.sfspd < 95, `SFSpd ${l.sfspd}`);
    if (i) assert.ok(l.voltas < folha[i - 1].voltas || l.total >= folha[i - 1].total, 'ordem de chegada');
  }
  const kgv = linhaKgv(folha[1]);
  assert.equal(kgv.length, COLUNAS_KGV.length);
  assert.match(kgv[5], TEMPO);
  assert.match(kgv[6], TEMPO);
  assert.match(kgv[12], /^\d{2,3},\d$/, 'velocidade com vírgula');
});

test('bateria por tempo: o líder recebe a bandeirada na primeira passagem depois do tempo, os outros na seguinte', () => {
  const { race } = montaCorrida(json, { seed: 77, pilotos: 10, jogador: false });
  const prova = new Prova(race, { modo: 'bateria', rnd: () => 0 });
  prova.modo = { ...MODOS.bateria, duracao: 150 };
  roda(prova, (p) => p.fase === 'fim', 600);
  const vencedor = prova.chegada[0], d = prova.dados.get(vencedor);
  assert.ok(prova.bandeira >= 150 && prova.bandeira < 150 + 75, `bandeirada em ${prova.bandeira}`);
  assert.equal(d.chegou.t, prova.bandeira);
  assert.ok(prova.chegada.every((k) => prova.dados.get(k).chegou.t >= prova.bandeira));
  assert.equal(prova.restante.texto, 'Bandeirada');
});

test('torre: gap em tempo na mesma volta e em voltas para quem levou volta', () => {
  const { race } = montaCorrida(json, { seed: 74, pilotos: 6, jogador: false });
  const prova = roda(new Prova(race, { modo: 'treino' }), (p) => race.time > 150, 300);
  const ordem = prova.classificacao(), lider = ordem[0];
  assert.equal(prova.gap(lider, lider), '—');
  for (const k of ordem.slice(1)) assert.match(prova.gap(k, lider), /^\+(\d+ V|(\d+:\d{2}|\d{1,2})\.\d{3})$|^—$/);
});

test('ranking local: guarda, ordena pela melhor volta e sobrevive a dado quebrado', () => {
  const mem = new Map(), arm = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const r = new Ranking(arm);
  assert.deepEqual(r.lista(), []);
  r.guarda({ data: '2026-10-15T20:00:00Z', modo: 'curta', melhor: 63.2, pos: 4, de: 20 });
  r.guarda({ data: '2026-10-15T20:10:00Z', modo: 'bateria', melhor: 61.9, pos: 2, de: 20 });
  r.guarda({ data: '2026-10-15T20:20:00Z', modo: 'treino', melhor: null });
  assert.equal(r.recorde(), 61.9);
  assert.deepEqual(r.melhores().map((p) => p.melhor), [61.9, 63.2]);
  assert.equal(r.ultimas()[0].modo, 'treino');
  mem.set(CHAVE, '{quebrado');
  assert.deepEqual(r.lista(), []);
  const reg = registroDaFolha({ numero: '044', pos: 3, voltas: 16, melhor: 61.2, total: 1088.4, s1: 14, s2: 25, s3: 22, sfspd: 80.1 }, { modo: 'bateria', de: 20, nome: 'VOCÊ' });
  assert.equal(reg.kart, '044');
  assert.equal(reg.de, 20);
});

test('nomes fictícios: diferentes, em maiúsculas, sempre os mesmos para a mesma seed', () => {
  const a = sorteiaNomes(20, 5), b = sorteiaNomes(20, 5);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 20);
  for (const n of a) {
    const [p, s] = n.split(' ');
    assert.ok(PRENOMES.includes(p) && SOBRENOMES.includes(s));
    assert.equal(n, n.toUpperCase());
  }
});
