// Mensagem 017, item 7: níveis de detalhe do kart do Meshy e peças fixas juntas por material.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
register('./apoio/three-gancho.mjs', import.meta.url);
const T = await import('three');
const { carregaNoNode } = await import('./apoio/glb-node.mjs');
const { preparaLod, NIVEIS, triangulos } = await import('../src/kart-lod.js');
const { KartGlbView, nivelPorDistancia, LOD_DETALHE } = await import('../src/kart-glb.js');
const { confere } = await import('../src/kart-contrato.js');

const KART = new URL('../assets/kart/kart.glb', import.meta.url);
const temKart = fs.existsSync(KART);
// o Node não tem canvas: o número do kart vira uma textura de mentira
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => {} }) }) };

let cache = null;
async function kart() {
  if (!cache) {
    const g = await carregaNoNode(KART);
    const a = performance.now(), lod = await preparaLod(g.scene);
    cache = { cena: g.scene, lod, ms: performance.now() - a };
  }
  return cache;
}
const caixa = (geo) => { geo.computeBoundingBox(); return geo.boundingBox; };

test('níveis do kart do Meshy: perto inteiro, meio e longe dentro do orçamento, mesma forma', { skip: !temKart }, async () => {
  const { lod, ms } = await kart();
  assert.ok(lod.triangulos.perto > 40000, `perto ${lod.triangulos.perto}`);
  assert.ok(lod.triangulos.meio < lod.triangulos.perto * 0.6, `meio ${lod.triangulos.meio}`);
  assert.ok(lod.triangulos.longe <= NIVEIS.longe.triangulos * 1.1, `longe ${lod.triangulos.longe}`);
  assert.ok(lod.triangulos.longe < lod.triangulos.perto / 15);
  assert.equal(lod.estaticos.length, 2, 'peças fixas juntas por material: kart e kart_pintura');
  for (const e of lod.estaticos) {
    const a = caixa(e.perto), b = caixa(e.longe);
    for (const k of ['x', 'y', 'z']) {
      assert.ok(Math.abs(a.min[k] - b.min[k]) < 0.05 && Math.abs(a.max[k] - b.max[k]) < 0.05, `${e.nome} ${k}: ${a.min[k]}..${a.max[k]} contra ${b.min[k]}..${b.max[k]}`);
    }
  }
  assert.equal(triangulos(lod.numeros), 6, 'os três números numa malha');
  assert.ok(ms < 3000, `preparo ${ms.toFixed(0)} ms`);
});

// maior aresta, em UV, dos triângulos de uma geometria (triângulo que atravessa ilhas da textura tem aresta enorme)
function maiorArestaUv(geo) {
  const uv = geo.attributes.uv, idx = geo.index;
  let m = 0;
  for (let t = 0; t < idx.count; t += 3) for (let k = 0; k < 3; k++) {
    const a = idx.getX(t + k), b = idx.getX(t + ((k + 1) % 3));
    m = Math.max(m, Math.hypot(uv.getX(a) - uv.getX(b), uv.getY(a) - uv.getY(b)));
  }
  return m;
}

test('meio: a textura continua certa (nenhum triângulo atravessa ilhas de UV); longe: cor por vértice, sem mapas', { skip: !temKart }, async () => {
  const { lod } = await kart();
  for (const e of lod.estaticos) {
    const perto = maiorArestaUv(e.perto), meio = maiorArestaUv(e.meio);
    // respeitando as costuras a maior aresta só cresce um pouco (0,03 → 0,06); atravessando ilhas passa de 1
    assert.ok(meio < 0.15 && meio < perto * 3, `${e.nome}: maior aresta em UV ${meio.toFixed(3)} contra ${perto.toFixed(3)}`);
    assert.ok(e.longe.attributes.color, `${e.nome}: longe com cor por vértice`);
    assert.equal(e.materialLonge.vertexColors, true);
    assert.equal(e.materialLonge.map, null);
    assert.equal(e.materialLonge.name, e.material.name, 'mesmo nome: a pintura do longe também leva a cor do piloto');
  }
});

test('nível pela distância, com folga na divisa', () => {
  const { meio, longe, folga } = NIVEIS;
  assert.equal(nivelPorDistancia(5), 0);
  assert.equal(nivelPorDistancia(meio.distancia + folga + 0.1), 1);
  assert.equal(nivelPorDistancia(longe.distancia + folga + 0.1), 2);
  assert.equal(nivelPorDistancia(longe.distancia + 0.5, 1), 1, 'na divisa fica onde estava');
  assert.equal(nivelPorDistancia(longe.distancia - 0.5, 2), 2);
  assert.equal(nivelPorDistancia(meio.distancia - folga - 0.1, 2), 0, 'vindo de longe, desce os dois');
});

test('KartGlbView com níveis: perto e meio 8 malhas, longe 2, peças originais escondidas, rodas paradas de longe', { skip: !temKart }, async () => {
  const { cena, lod } = await kart();
  const scene = new T.Scene(), view = new KartGlbView(scene, cena, confere(cena), { capacity: 3, lod });
  view.mostraPilotoProvisorio(false);
  const dr = (n) => ({ cor: 0x2266cc, numero: n });
  const karts = [5, 20, 60].map((x, i) => ({ x, z: 0, yaw: 0, odo: 3, delta: 0.1, dr: dr(i + 2) }));
  const cam = new T.Vector3(0, 0, 0);
  view.sync(karts, { x: 0, z: 0 }, cam);
  const visiveis = (it) => { const l = []; it.raiz.traverseVisible((o) => { if (o.isMesh) l.push(o); }); return l; };
  const [perto, meio, longe] = view.itens;
  assert.deepEqual([perto.nivel, meio.nivel, longe.nivel], [0, 1, 2]);
  assert.equal(visiveis(perto).length, 8, 'fixo + carenagem + 4 rodas + volante + números');
  assert.equal(visiveis(meio).length, 8);
  assert.equal(visiveis(longe).length, 2, 'kart inteiro + carenagem; números além de 45 m');
  assert.ok(60 > LOD_DETALHE);
  for (const nome of ['chassi', 'banco', 'motor', 'carenagem']) assert.ok(visiveis(perto).every((m) => m.parent !== perto.nos[nome]), `${nome} original escondido`);
  const tri = (it) => visiveis(it).reduce((a, m) => a + triangulos(m.geometry), 0);
  assert.ok(tri(perto) > 40000 && tri(meio) < tri(perto) * 0.6 && tri(longe) < 2700, `${tri(perto)} ${tri(meio)} ${tri(longe)}`);
  // o longe faz a própria sombra, barata (conta na câmera de cima, onde a caixa da sombra cresce)
  assert.ok(visiveis(longe).every((m) => m.castShadow));
  const q = longe.frente[0].no.quaternion.clone();
  karts[2].odo = 50;
  view.sync(karts, { x: 0, z: 0 }, cam);
  assert.ok(longe.frente[0].no.quaternion.equals(q), 'de longe as rodas não giram (nem aparecem)');
  // a pintura do kart vale também nas malhas novas (perto e longe)
  const pintadas = visiveis(perto).filter((m) => m.material.name === 'kart_pintura');
  assert.equal(pintadas.length, 1);
  assert.equal(pintadas[0].material.color.getHex(), 0x2266cc);
  const pintadaLonge = visiveis(longe).find((m) => m.material.name === 'kart_pintura');
  assert.equal(pintadaLonge.material.color.getHex(), 0x2266cc);
  assert.notEqual(pintadaLonge.material, pintadas[0].material);
  assert.equal(view.drawCalls(), 18);
  view.dispose();
});
