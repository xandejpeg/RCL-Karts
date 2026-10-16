// RCL-Karts · testes da pista em 3D (src/pista3d): faixas viradas para cima, zebras pelas bordas da física (fina com
// relevo, larga pintada), faixa azul e ombro, terreno no relevo, pneus onde a física tem muro, marcas do grid no lugar dos
// karts, alambrado em volta de tudo e árvores longe da pista e dos boxes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import { KartTrack } from '../src/fisica/kart-fisica.js';
import { tracadoDaCorrida } from '../src/pista-dados.js';
import { sorteio, faixaColunas, brilhoDoAsfalto, zebras3d, ZEBRA, marcasDoGrid, contorno, dentro, arvores, medidorDeDistancia, faixaTrecho, faixaBorda, pneusDosMuros } from '../src/pista3d/dados3d.js';
import { terreno } from '../src/pista3d/terreno.js';

register('./support/three-hook.mjs', import.meta.url);
const json = tracadoDaCorrida(JSON.parse(fs.readFileSync(new URL('../assets/pista/tracado101.json', import.meta.url))));
const T = new KartTrack(json);
const origem = { x: Math.round(T.center.x), z: Math.round(T.center.z) };
const linha = T.wrap(json.cronometro.s);

// normal (y) de cada triângulo: positiva = virado para cima
function normaisY(pos, idx) {
  const ys = [];
  for (let k = 0; k < idx.length; k += 3) {
    const [a, b, c] = [idx[k], idx[k + 1], idx[k + 2]].map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    ys.push(u[2] * v[0] - u[0] * v[2]);
  }
  return ys;
}

test('sorteio: mesma semente, mesma sequência, entre 0 e 1', () => {
  const a = sorteio(7), b = sorteio(7), c = sorteio(8);
  const xa = Array.from({ length: 50 }, a), xb = Array.from({ length: 50 }, b), xc = Array.from({ length: 50 }, c);
  assert.deepEqual(xa, xb);
  assert.notDeepEqual(xa, xc);
  assert.ok(xa.every((x) => x >= 0 && x < 1));
});

test('asfalto: faixa com colunas cobre a largura, vira para cima e a borracha escurece a linha de corrida', () => {
  const f = faixaColunas(T, -T.hw, T.hw, origem, { colunas: 16, escalaU: 5, escalaV: 5, cor: () => [1, 1, 1] });
  assert.equal(f.pos.length / 3, (T.n + 1) * 17);
  assert.equal(f.idx.length, T.n * 16 * 6);
  assert.ok(normaisY(f.pos, f.idx).every((y) => y > 0), 'algum triângulo virado para baixo');
  assert.ok(brilhoDoAsfalto(1.2, 1.2, T.hw) < 0.75 && brilhoDoAsfalto(-3, 1.2, T.hw) > 0.95);
});

test('zebras: onde as bordas da física têm zebra, listras alternando, relevo de 3 cm na fina e face para cima', () => {
  const z = zebras3d(T, origem, { y: 0.02 });
  assert.ok(z.idx.length > 0);
  assert.ok(normaisY(z.pos, z.idx).every((y) => y > 0), 'zebra com face para baixo');
  const ys = [];
  for (let i = 1; i < z.pos.length; i += 3) ys.push(z.pos[i]);
  assert.ok(Math.max(...ys) <= 0.02 + 0.033 && Math.max(...ys) >= 0.02 + 0.03);
  const cores = new Set();
  const chave = (c) => Array.from(c, (x) => x.toFixed(2)).join(',');
  for (let i = 0; i < z.cores.length; i += 3) cores.add(chave(z.cores.slice(i, i + 3)));
  assert.deepEqual([...cores].sort(), [chave(ZEBRA.branco), chave(ZEBRA.vermelho)].sort());
  // cada trecho de 2 m com zebra do mesmo tipo nas duas pontas vira pelo menos uma listra
  let trechos = 0;
  for (const b of [T.borda.L, T.borda.R]) for (let i = 0; i < T.n; i++) { const j = (i + 1) % T.n; if (b.t[i] && b.t[i] === b.t[j]) trechos++; }
  assert.ok(z.pos.length / 3 >= trechos * 3 * ZEBRA.perfilLarga.length, `${z.pos.length / 3} vértices para ${trechos} trechos`);
  // com o relevo, a zebra sobe junto com a pista
  const zr = zebras3d(T, origem, { y: 0.02, alt: (s) => T.altura(s) });
  assert.ok(Math.max(...Array.from(zr.pos).filter((_, i) => i % 3 === 1)) > 8);
});

test('faixa azul e ombro: viradas para cima, nas larguras da física e só onde tem azul', () => {
  const B = T.borda, a = (lado, i) => (lado < 0 ? B.L : B.R).a[i], zb = (lado, i) => (lado < 0 ? B.L : B.R).z[i];
  const f = faixaBorda(T, origem, { dIn: (l, i) => T.hw + zb(l, i), dOut: (l, i) => T.hw + zb(l, i) + a(l, i), tem: (l, i) => a(l, i) > 0, altIn: () => 0, altOut: () => 0 });
  assert.ok(f.idx.length > 0);
  assert.ok(normaisY(f.pos, f.idx).every((y) => y > 0), 'azul com face para baixo');
  let comAzul = 0;
  for (const b of [B.L, B.R]) for (let i = 0; i < T.n; i++) if (b.a[i] > 0 && b.a[(i + 1) % T.n] > 0) comAzul++;
  assert.equal(f.idx.length / 6, comAzul);
});

test('terreno: segue a altura da pista (e a inclinação da curva) na borda do asfalto e fica entre o mais baixo e o mais alto', () => {
  const ter = terreno(T, origem), p = {};
  let erro = 0;
  for (let i = 0; i < T.n; i++) for (const sg of [-1, 1]) { T.point(T.s[i], sg * T.hw, p); erro = Math.max(erro, Math.abs(ter.alt(p.x - origem.x, p.z - origem.z) - (T.h[i] + sg * T.hw * T.inc[i]))); }   // (com a curva inclinada)
  assert.ok(erro < 0.1, `erro na borda: ${erro.toFixed(3)} m`);
  assert.ok(ter.min >= Math.min(...T.h) - 1e-6 && ter.max <= Math.max(...T.h) + 1e-6);
  assert.equal(terreno(T, origem), ter, 'calculado uma vez só');
});

test('pneus: uma pilha a cada 0,6 m dos muros da física, no chão do terreno, fora do asfalto', () => {
  const ter = terreno(T, origem), pn = pneusDosMuros(T, origem, { alt: ter.alt });
  let comp = 0;
  for (const m of json.muros) if (m.tipo === 'pneus') for (let i = 0; i + 1 < m.pontos.length; i++) { const L = Math.hypot(m.pontos[i + 1][0] - m.pontos[i][0], m.pontos[i + 1][1] - m.pontos[i][1]); if (L <= 6) comp += L; }
  assert.ok(Math.abs(pn.length - comp / 0.6) < 40, `${pn.length} pilhas para ${comp.toFixed(0)} m de muro`);
  assert.ok(pn.some((p) => p.pilha) && pn.some((p) => p.vermelho) && pn.some((p) => !p.vermelho));
  for (const p of pn.filter((_, i) => i % 7 === 0)) {
    assert.ok(Math.abs(p.y - ter.alt(p.x, p.z)) < 1e-9);
    const q = T.project(p.x + origem.x, p.z + origem.z);
    assert.ok(Math.abs(q.d) > T.hw + 0.3, 'pneu no asfalto');
  }
});

test('grid: 20 marcas na frente dos lugares do grid.js, em duas colunas', async () => {
  const { GRID } = await import('../src/grid.js');
  const m = marcasDoGrid(T, linha, { ...GRID, lugares: 20 });
  assert.equal(m.length, 20);
  assert.equal(m[0].d, -GRID.coluna);
  assert.equal(m[1].d, GRID.coluna);
  assert.ok(Math.abs(T.wrap(linha - m[0].s) - (GRID.primeira - 1.1)) < 1e-6);
  assert.ok(Math.abs(T.wrap(m[0].s - m[2].s) - GRID.fila) < 1e-6);
});

test('alambrado: contorno fechado em volta de toda a pista, a pelo menos 40 m do eixo', () => {
  const c = contorno(T, origem, { folga: 42, passo: 3 });
  assert.ok(c.length > 100);
  for (let i = 0; i < T.n; i++) assert.ok(dentro(c, T.x[i] - origem.x, T.z[i] - origem.z), `ponto ${i} fora do alambrado`);
  const dist = medidorDeDistancia(T, origem);
  assert.ok(c.every(([x, z]) => dist(x, z, 80) >= 40), 'alambrado perto demais da pista');
});

test('árvores: fora do alambrado ou no miolo longe da pista, nunca na reserva dos boxes', () => {
  const cerca = contorno(T, origem), reserva = [-20, -80, 40, -60];
  const a = arvores(T, origem, { cerca, reservas: [reserva], livre: 14 });
  const dist = medidorDeDistancia(T, origem);
  assert.ok(a.length > 150);
  for (const t of a) {
    const r = t.x >= reserva[0] && t.x <= reserva[2] && t.z >= reserva[1] && t.z <= reserva[3];
    assert.ok(!r, 'árvore na reserva');
    if (dentro(cerca, t.x, t.z)) assert.ok(dist(t.x, t.z, 40) >= 14, 'árvore do miolo perto da pista');
  }
  // a mesma semente dá o mesmo cenário
  assert.deepEqual(arvores(T, origem, { cerca, reservas: [reserva] }).slice(0, 5), a.slice(0, 5));
});

test('pátio: pedaço de faixa no trecho pedido, virado para cima', () => {
  const p = faixaTrecho(T, linha - 20, linha + 20, -8, -30, origem, { passo: 2 });
  assert.equal(p.pos.length / 3, 21 * 2);
  assert.ok(normaisY(p.pos, p.idx).every((y) => y > 0));
});

test('peças: pilha de pneus de 0,66 m e Jersey de 0,81 m', async () => {
  const { geometriaPilha, geometriaJersey, PILHA } = await import('../src/pista3d/malhas.js');
  const g = geometriaPilha();
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.y - PILHA.altura) < 1e-6 && Math.abs(g.boundingBox.max.z - PILHA.raio) < 1e-6);
  const j = geometriaJersey(10);
  j.computeBoundingBox();
  assert.ok(Math.abs(j.boundingBox.max.y - 0.81) < 1e-6 && Math.abs(j.boundingBox.max.z - 5) < 1e-6);
});
