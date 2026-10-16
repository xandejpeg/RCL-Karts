// RCL-Karts · testes da primeira pessoa (src/primeira-pessoa.js) e dos pés nos pedais (pilotos.js): a cabeça vai para
// fora na curva e para a frente na freada, treme mais na grama e escorregando, a câmera fica presa ao chassi (o kart de
// lado = a vista de lado) e o pé aperta o pedal conforme o acelerador e o freio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./support/three-hook.mjs', import.meta.url);
const { PrimeiraPessoa, cabecaPelaForca, tremorDoPiso, PP } = await import('../src/primeira-pessoa.js');

test('cabeça pela força G: curva para a esquerda joga para a direita e inclina; freada joga para a frente', () => {
  const c = cabecaPelaForca(1.5, 0);
  assert.ok(c.x < 0 && c.roll > 0);
  assert.ok(cabecaPelaForca(0, -1).z > 0);
  assert.ok(Math.abs(cabecaPelaForca(2, 0).x) < 0.08, 'mexe pouco (centímetros)');
});

test('tremor: maior na zebra, maior ainda na grama e quando a traseira escorrega', () => {
  const asfalto = tremorDoPiso({ v: 15 }), zebra = tremorDoPiso({ v: 15, grip: 0.92 }), grama = tremorDoPiso({ v: 15, grip: 0.32, gripTras: 0.7 });
  const drift = tremorDoPiso({ v: 15, slipR: 0.3 });
  assert.ok(asfalto < zebra && zebra < grama && asfalto < drift);
});

test('câmera presa ao chassi: olha para a frente do kart, abaixo do horizonte, e gira junto com o kart', async () => {
  const T = await import('three');
  const pp = new PrimeiraPessoa([0, 1.0, -0.1]), frente = new T.Vector3();
  for (const yaw of [0, 1.2]) {
    const k = { x: 100, z: 50, y: 3, yaw, vx: 0, r: 0, ax: 0, v: 0 };
    const r = pp.pose(k, { x: 0, z: 0 }, 1 / 60);
    frente.set(0, 0, -1).applyQuaternion(r.quat);
    // frente do kart no mundo: (sen yaw, cos yaw)
    const dot = frente.x * Math.sin(yaw) + frente.z * Math.cos(yaw);
    assert.ok(dot > 0.85, `olhando para a frente do kart (${dot.toFixed(2)})`);
    assert.ok(Math.abs(Math.asin(-frente.y) - PP.olhaBaixo) < 0.02, 'olhar abaixo do horizonte');
    assert.ok(r.pos.y > 3.9 && r.pos.y < 4.2, `no olho: ${r.pos.y.toFixed(2)}`);
  }
});

test('pés nos pedais: o direito vai para a frente e para baixo com o acelerador, o esquerdo com o freio', async () => {
  const { pisaNosPedais, CURSO_PEDAL } = await import('../src/pilotos.js');
  const pes = { esquerdo: [0.63, 0.19, -0.09], direito: [0.63, 0.19, 0.09] };
  const solto = pisaNosPedais(pes, { acel: 0, freio: 0 }), pe = pisaNosPedais(pes, { acel: 1, freio: 0 }), freia = pisaNosPedais(pes, { acel: 0, freio: 1 });
  assert.deepEqual(solto, pes);
  assert.ok(Math.abs(pe.direito[0] - pes.direito[0] - CURSO_PEDAL.frente) < 1e-9 && pe.direito[1] < pes.direito[1]);
  assert.deepEqual(pe.esquerdo, pes.esquerdo);
  assert.ok(freia.esquerdo[0] > pes.esquerdo[0] && freia.esquerdo[1] < pes.esquerdo[1]);
});
