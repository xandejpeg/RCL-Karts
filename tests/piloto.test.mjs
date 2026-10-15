// Mensagem 009: piloto sentado no kart. IK de dois ossos e as contas do assento (mãos no aro, pés nos pedais, corpo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./apoio/three-gancho.mjs', import.meta.url);
const T = await import('three');
const { ikDoisOssos } = await import('../src/ik.js');
const { alvosMaos, alvosPes, bacia, corpoDoKart, tinta, ASSENTO, RAIO_ARO, PONTOS_PROVISORIO } = await import('../src/piloto-assento.js');
const { PONTOS_PADRAO } = await import('../src/kart-contrato.js');

// cadeia de três ossos em pé (0 → 0,45 → 0,9 m), presa num pai girado, como um braço/perna no esqueleto
function cadeia() {
  const raiz = new T.Object3D();
  raiz.rotation.set(0.3, -0.7, 0.2);
  raiz.position.set(1, 2, 3);
  const a = new T.Bone(), b = new T.Bone(), c = new T.Bone();
  b.position.set(0, 0.45, 0);
  c.position.set(0, 0.45, 0);
  raiz.add(a); a.add(b); b.add(c);
  raiz.updateMatrixWorld(true);
  return { raiz, a, b, c };
}
const mundo = (o) => o.getWorldPosition(new T.Vector3());

test('IK de dois ossos: a ponta chega ao alvo, os ossos não esticam e a dobra vai para o polo', () => {
  const { raiz, a, b, c } = cadeia();
  const alvo = raiz.localToWorld(new T.Vector3(0.3, 0.5, 0.2)), polo = raiz.localToWorld(new T.Vector3(0, 0.3, 1));
  ikDoisOssos(a, b, c, alvo, polo);
  assert.ok(mundo(c).distanceTo(alvo) < 1e-4, `erro ${mundo(c).distanceTo(alvo)}`);
  assert.ok(Math.abs(mundo(a).distanceTo(mundo(b)) - 0.45) < 1e-9 && Math.abs(mundo(b).distanceTo(mundo(c)) - 0.45) < 1e-9);
  const joelho = raiz.worldToLocal(mundo(b));
  assert.ok(joelho.z > 0.1, `dobra para o polo (z ${joelho.z.toFixed(3)})`);
});

test('IK de dois ossos: alvo longe demais estica a cadeia na direção dele', () => {
  const { raiz, a, b, c } = cadeia();
  const alvo = raiz.localToWorld(new T.Vector3(2, 0, 0)), polo = raiz.localToWorld(new T.Vector3(0, 1, 1));
  ikDoisOssos(a, b, c, alvo, polo);
  const ponta = raiz.worldToLocal(mundo(c));
  assert.ok(Math.abs(ponta.length() - 0.9) < 1e-3 && ponta.x > 0.89, `ponta ${ponta.toArray().map((v) => v.toFixed(3))}`);
});

test('mãos no aro: a 9 e 3 horas, no plano do volante; virar à esquerda sobe a mão direita', () => {
  for (const p of [PONTOS_PADRAO, PONTOS_PROVISORIO]) {
    const c = p.volante.centro, d = p.volante.direcao.map((x) => x / Math.hypot(...p.volante.direcao));
    const m = alvosMaos(p, 0);
    for (const h of [m.esquerda, m.direita]) {
      const r = h.map((x, i) => x - c[i]);
      assert.ok(Math.abs(Math.hypot(...r) - RAIO_ARO) < 1e-12, 'no aro');
      assert.ok(Math.abs(r[0] * d[0] + r[1] * d[1] + r[2] * d[2]) < 1e-12, 'no plano do aro');
    }
    assert.ok(m.direita[2] > c[2] && m.esquerda[2] < c[2], 'direita em +Z');
    const virando = alvosMaos(p, 0.2);
    assert.ok(virando.direita[1] > m.direita[1] && virando.esquerda[1] < m.esquerda[1]);
  }
});

test('assento: bacia no banco + 0,025 + 0,09; pés: freio no esquerdo, acelerador no direito', () => {
  const b = bacia(PONTOS_PADRAO);
  assert.ok(Math.abs(b[1] - (PONTOS_PADRAO.banco[1] + 0.115)) < 1e-12);
  assert.ok(Math.abs(ASSENTO.inclinacao - (25 * Math.PI) / 180) < 1e-12);
  const pes = alvosPes(PONTOS_PADRAO);
  assert.equal(pes.esquerdo, PONTOS_PADRAO.pedais.freio);
  assert.equal(pes.direito, PONTOS_PADRAO.pedais.acelerador);
});

test('corpos: o jogador é o Cláudio; a IA roda pelos outros', () => {
  const ids = ['eu', 'u0', 'u20', 'u10'];
  assert.equal(corpoDoKart(5, true, ids), 'eu');
  assert.deepEqual([0, 1, 2, 3].map((i) => corpoDoKart(i, false, ids)), ['u0', 'u20', 'u10', 'u0']);
  assert.equal(corpoDoKart(0, true, ['u0']), 'u0', 'sem o Cláudio, qualquer um');
  assert.equal(tinta(0xffffff), 0xffffff);
  assert.equal(tinta(0x000000, 1), 0x000000);
});
