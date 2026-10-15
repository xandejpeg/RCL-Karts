// Mensagem 007: linha de cronometragem no `cronometro` do traçado, contrato da arte do kart (com o kart de teste),
// cenário fora da pista e a conta da primeira carga.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { json } from '../ferramentas/calibra.mjs';
import { geraGlb, leGlb, arvore, PONTOS } from '../ferramentas/gera-kart-teste.mjs';
import { cargaInicial, META_MB } from '../ferramentas/carga.mjs';
import { montaCorrida } from '../src/grid.js';
import { Prova, linhaDe } from '../src/prova.js';
import { linhaChegada, postes, distanciaAoEixo } from '../src/pista-dados.js';
import { confere, OBRIGATORIOS, rclParaJogo, olhoCockpit, giroRoda, GIRO_RAIZ_Y, lePontos, PONTOS_PADRAO } from '../src/kart-contrato.js';

test('linha de cronometragem: campo cronometro (s = 32), eixo intacto, grid atrás da linha', () => {
  assert.deepEqual(Object.keys(json.cronometro), ['s', 'nota']);
  assert.equal(json.cronometro.s, 32);
  assert.deepEqual(json.eixo[0], [9128.777, -5243.404], 'o eixo continua começando no mesmo ponto');
  const { race } = montaCorrida(json, { seed: 74, pilotos: 20 });
  assert.equal(linhaDe(race.track), 32);
  for (const k of race.karts) {
    const atras = race.track.wrap(32 - k.s);
    assert.ok(atras > 5 && atras < 50, `kart a ${atras.toFixed(1)} m da linha`);
  }
  const T = race.track, o = { x: 0, z: 0 }, lc = linhaChegada(T, o), P = T.point(32, 0, {});
  const xs = lc.pos.filter((_, i) => i % 3 === 0), zs = lc.pos.filter((_, i) => i % 3 === 2);
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cz = zs.reduce((a, b) => a + b, 0) / zs.length;
  assert.ok(Math.hypot(cx - P.x, cz - P.z) < 1, 'o quadriculado está na linha');
});

test('a prova cronometra no s = 32: passagem quando o kart cruza a linha, voltas de kart rental', () => {
  const { race } = montaCorrida(json, { seed: 75, pilotos: 6, jogador: false });
  const prova = new Prova(race, { modo: 'treino' });
  const k = race.karts[0];
  let cruzou = null;
  for (let t = 0; t < 200; t += 1 / 60) {
    const s0 = k.s, antes = prova.dados.get(k).passagens.length;
    prova.update(1 / 60);
    if (cruzou == null && prova.dados.get(k).passagens.length > antes) cruzou = { s0, s1: k.s };
  }
  assert.ok(cruzou.s0 <= 32 && cruzou.s1 >= 32, `cruzou entre ${cruzou.s0.toFixed(2)} e ${cruzou.s1.toFixed(2)}`);
  const d = prova.dados.get(k);
  assert.ok(d.voltas.length >= 2 && d.voltas.every((v) => v > 55 && v < 85), `voltas ${d.voltas.map((v) => v.toFixed(2))}`);
  assert.ok(Math.abs(d.voltas.reduce((a, b) => a + b, 0) - (d.passagens.at(-1) - d.passagens[0])) < 1e-9);
  assert.ok(d.sf.slice(1).every((v) => v > 60 && v < 92), `SFSpd ${d.sf.map((v) => v.toFixed(1))}`);
});

test('kart de teste: segue o contrato (nós, pintura, kartPontos) e pesa pouco', () => {
  const glb = geraGlb(), gltf = leGlb(glb), c = confere(arvore(gltf));
  assert.ok(c.ok, `faltam: ${c.faltam}`);
  assert.deepEqual(c.avisos, []);
  assert.ok(c.temPintura);
  assert.deepEqual(c.pontos.banco, PONTOS.banco);
  assert.ok(glb.length < 100 * 1024);
  assert.deepEqual(leGlb(fs.readFileSync(new URL('./fixtures/kart-contrato.glb', import.meta.url))), gltf, 'o arquivo do repositório está atualizado');
});

test('contrato: aponta o nó que falta, completa os pontos e avisa', () => {
  const sem = arvore(leGlb(geraGlb()));
  const tira = (n, nome) => { n.children = n.children.filter((c) => c.name !== nome).map((c) => tira(c, nome)); return n; };
  const c = confere(tira(sem, 'esterco_D'));
  assert.equal(c.ok, false);
  assert.ok(c.faltam.includes('esterco_D') && c.faltam.includes('roda_dianteira_D'));
  const { pontos, avisos } = lePontos({ userData: {} });
  assert.deepEqual(pontos, PONTOS_PADRAO);
  assert.ok(avisos.length >= 6);
  assert.ok(OBRIGATORIOS.includes('volante') && OBRIGATORIOS.includes('carenagem'));
});

test('eixos: +X frente do RCL vira +Z do jogo, +Z direita vira −X; roda para a frente gira negativo em Z', () => {
  assert.deepEqual(rclParaJogo([1, 0, 0]), [-0, 0, 1]);
  assert.deepEqual(rclParaJogo([0, 0, 1]), [-1, 0, 0]);
  // o giro da raiz (−90° em Y) faz a mesma conversão
  const c = Math.cos(GIRO_RAIZ_Y), s = Math.sin(GIRO_RAIZ_Y), roda = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  for (const v of [[1, 0, 0], [0, 0, 1], [0.3, 0.2, -0.7]]) roda(v).forEach((a, i) => assert.ok(Math.abs(a - rclParaJogo(v)[i]) < 1e-12));
  assert.ok(giroRoda(1, 0.13) < 0);
  assert.ok(Math.abs(giroRoda(2 * Math.PI * 0.14, 0.14) + 2 * Math.PI) < 1e-12, 'uma volta da roda por circunferência');
  const olho = olhoCockpit({ banco: [-0.25, 0.16, 0] });
  assert.ok(Math.abs(olho[1] - (0.16 + 0.715)) < 1e-9 && Math.abs(olho[2] - (-0.15)) < 1e-9 && Math.abs(olho[0]) < 1e-12);
});

test('cenário: postes de luz longe de qualquer trecho da pista', () => {
  const { race } = montaCorrida(json, { seed: 74, pilotos: 1, jogador: false });
  const T = race.track, lista = postes(T, { x: 0, z: 0 });
  assert.ok(lista.length >= 10, `${lista.length} postes`);
  for (const p of lista) assert.ok(distanciaAoEixo(T, p.x, p.z) >= 9);
});

test(`primeira carga: hoje e com a arte prevista, dentro da meta de ${META_MB} MB`, () => {
  const c = cargaInicial();
  assert.ok(c.mb < 5, `hoje ${c.mb.toFixed(2)} MB`);
  assert.ok(c.total < META_MB, `com a arte prevista ${c.total.toFixed(1)} MB`);
});
