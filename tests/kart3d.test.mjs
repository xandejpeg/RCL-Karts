// RCL-Karts · kart 3D: as medidas do kart de aluguel (Birel N35 + GX390), o modelo em código e o desenho instanciado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./support/three-hook.mjs', import.meta.url);
const { KART_ALUGUEL: K, RODAS, PONTOS, zFrente, zTras, numeroKart } = await import('../src/kart3d/medidas.js');
const { montaKart } = await import('../src/kart3d/kart-modelo.js');
const { KartView3D, celulaDoNumero } = await import('../src/kart3d/kart-view.js');
const T = await import('three');

const quase = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} × ${b}`);

test('medidas: entre-eixos, bitolas e comprimento do Birel N35; pneus 10" e 11"', () => {
  const [de, dd, te, td] = RODAS;
  quase(de.z - te.z, 1.07, 1e-9, 'entre-eixos');
  quase(de.x - dd.x + K.pneuFrente.largura, 1.208, 1e-9, 'bitola da frente (de fora a fora)');
  quase(te.x - td.x + K.pneuTras.largura, 1.41, 1e-9, 'bitola de trás');
  quase(zFrente - zTras, 2.036, 1e-9, 'comprimento');
  quase(de.y, 0.127, 1e-3, 'raio da frente'); quase(te.y, 0.1397, 1e-3, 'raio de trás');
  assert.equal(numeroKart(7), '007'); assert.equal(numeroKart(44), '044');
  assert.ok(PONTOS.olho.y > 0.7 && PONTOS.olho.y < 1.0, 'olho do piloto na altura de quem está sentado no kart');
});

test('modelo: peças dentro do contorno do kart, rodas no tamanho, sem NaN e leve', () => {
  const m = montaKart(), caixa = new T.Box3();
  for (const g of Object.values(m.corpo)) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.array.length; i++) assert.ok(Number.isFinite(p.array[i]), 'posição sem NaN');
    g.computeBoundingBox(); caixa.union(g.boundingBox);
  }
  assert.ok(caixa.min.z >= zTras - 0.01 && caixa.max.z <= zFrente + 0.02, `comprimento: ${caixa.min.z} a ${caixa.max.z}`);
  assert.ok(caixa.max.x - caixa.min.x <= 1.65, `largura ${caixa.max.x - caixa.min.x}`);
  assert.ok(caixa.min.y >= 0.02, 'nada abaixo do chão');
  const r = (g) => { g.computeBoundingBox(); return g.boundingBox.max.y; };
  quase(r(m.rodas.frente.pneu), 0.127, 0.002, 'pneu da frente');
  quase(r(m.rodas.tras.pneu), 0.1397, 0.002, 'pneu de trás');
  assert.ok(m.triangulos < 25000, `triângulos por kart: ${m.triangulos}`);
});

test('desenho: rodas no lugar, as da frente esterçam, número da placa pelo atlas, instâncias certas', () => {
  const cena = new T.Scene(), v = new KartView3D(cena, { capacity: 4 });
  const karts = [{ x: 100, z: 50, yaw: 0, delta: 0.2, odo: 0, dr: { cor: 0xe10600, numero: 44 } }, { x: 110, z: 50, yaw: Math.PI / 2, delta: 0, odo: 1, dr: { cor: 0x1f4fbf, numero: 2 } }];
  v.sync(karts, { x: 100, z: 50 });
  assert.equal(v.pintura.count, 2); assert.equal(v.rodas.frente.pneu.count, 4); assert.equal(v.placas.count, 2 * m4(v));
  const M = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  v.rodas.tras.pneu.getMatrixAt(0, M); M.decompose(p, q, s);
  quase(p.x, RODAS[2].x, 1e-6, 'roda traseira esquerda x'); quase(p.z, RODAS[2].z, 1e-6, 'roda traseira esquerda z');
  v.rodas.frente.pneu.getMatrixAt(0, M); M.decompose(p, q, s);
  const eixo = new T.Vector3(1, 0, 0).applyQuaternion(q);
  quase(Math.atan2(-eixo.z, eixo.x), 0.2, 1e-6, 'esterço da roda da frente');
  // kart 2 virado para +x (yaw π/2): a roda dianteira esquerda fica em +x e para −z
  v.rodas.frente.pneu.getMatrixAt(2, M); M.decompose(p, q, s);
  quase(p.x, 10 + RODAS[0].z, 1e-6, 'kart girado: x'); quase(p.z, -RODAS[0].x, 1e-6, 'kart girado: z');
  assert.equal(v.aNumero.getX(0), 42); assert.equal(v.aNumero.getX(m4(v)), 0);
  assert.equal(celulaDoNumero(72), 70);
  assert.ok(v.drawCalls() <= 20, `chamadas de desenho: ${v.drawCalls()}`);
  v.dispose();
});
function m4(v) { return v.placasDef.length; }
