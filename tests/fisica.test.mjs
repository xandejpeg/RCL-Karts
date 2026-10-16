// RCL-Karts · testes da física própria (src/fisica): relevo do 101 no kart, grama sem aderência (roda), zebras nas
// curvas, muros de pneus e pilhas que não deixam cortar, e a linha de curvatura mínima convergida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KartRace, KartTrack, KART_CONFIG, racingLine } from '../src/fisica/kart-fisica.js';
import { tracadoDaCorrida } from '../src/pista-dados.js';
import { BORDAS } from '../src/fisica/bordas.js';
import { CFG_101 } from '../src/calibragem.js';

const bruto = JSON.parse(fs.readFileSync(new URL('../assets/pista/tracado101.json', import.meta.url), 'utf8'));
const json = tracadoDaCorrida(bruto);
const T = new KartTrack(json);
const cfg = { ...KART_CONFIG, ...CFG_101 };
const linha = racingLine(T, cfg.linha);

// distância do ponto (x, z) ao segmento de muro mais perto
function distMuro(x, z) {
  let m = Infinity;
  for (const w of T.walls) {
    const ux = w.bx - w.ax, uz = w.bz - w.az, L2 = ux * ux + uz * uz || 1, t = Math.max(0, Math.min(1, ((x - w.ax) * ux + (z - w.az) * uz) / L2));
    m = Math.min(m, Math.hypot(w.ax + ux * t - x, w.az + uz * t - z) - w.r);
  }
  return m;
}

// ápices da linha (máximo local da curvatura) com raio menor que `r`
function apices(r) {
  const out = [];
  for (let i = 0; i < T.n; i++) {
    const k = Math.abs(linha.k[i]);
    if (k < 1 / r) continue;
    let max = true;
    for (let o = -6; o <= 6; o++) if (o && Math.abs(linha.k[(i + o + T.n) % T.n]) > k) { max = false; break; }
    if (max) out.push(i);
  }
  return out;
}

test('relevo: alturas do perfil ajustado no eixo (0 a ~14 m), comprimento oficial e o kart sobe e desce com a pista', () => {
  assert.ok(Math.abs(T.L - 1014.97) < 1, `L = ${T.L}`);
  const h = json.relevo.h;
  assert.equal(h.length, T.n);
  assert.ok(Math.min(...h) >= 0 && Math.min(...h) < 0.6 && Math.max(...h) > 13 && Math.max(...h) < 15, `h ${Math.min(...h)}–${Math.max(...h)}`);
  // nenhuma rampa passa de 11% (o S depois da reta desce ~6%, as subidas chegam a ~10%)
  assert.ok(Math.max(...Array.from(T.dh, Math.abs)) < 0.11, 'rampa forte demais');
  for (let i = 0; i < T.n; i++) assert.ok(Math.abs(h[(i + 1) % T.n] - h[i]) < 0.5, `degrau no ponto ${i}`);
  const race = new KartRace(json, { seed: 74, pilotos: 1, start: 'espalhado', cfg });
  const k = race.karts[0];
  let ymin = Infinity, ymax = -Infinity, arf = 0;
  for (let t = 0; t < 70; t += 1 / 60) {
    race.update(1 / 60);
    assert.ok(Math.abs(k.y - T.altura(k.s)) < 1e-6);
    ymin = Math.min(ymin, k.y); ymax = Math.max(ymax, k.y); arf = Math.max(arf, Math.abs(k.arfagem));
  }
  assert.ok(ymax - ymin > 13, `subiu ${(ymax - ymin).toFixed(1)} m na volta`);
  assert.ok(arf > 0.02 && arf < 0.15, `arfagem máxima ${arf.toFixed(3)} rad`);
});

test('subida custa: a mesma reta morro acima é mais lenta que morro abaixo (perfil de velocidade)', () => {
  const plano = { ...json, relevo: { ...json.relevo, h: json.relevo.h.map(() => 0) } };
  const r0 = new KartRace(plano, { seed: 74, pilotos: 1, cfg }), r1 = new KartRace(json, { seed: 74, pilotos: 1, cfg });
  assert.notEqual(r0.refLap.toFixed(3), r1.refLap.toFixed(3));
  // a volta tem ~14 m de subida e de descida: no total muda pouco (menos de 3%)
  assert.ok(Math.abs(r1.refLap / r0.refLap - 1) < 0.03, `${r0.refLap.toFixed(2)} contra ${r1.refLap.toFixed(2)}`);
});

test('grama: sem aderência, a traseira solta e o kart roda; no asfalto, a mesma manobra fica na mão', () => {
  // reta sem zebra do lado direito e muro a mais de 2 m: kart a 50 km/h na grama, acelerando e virando um pouco para a pista
  let i0 = -1;
  for (let i = 0; i < T.n && i0 < 0; i++) {
    let ok = true;
    for (let o = -10; o <= 10 && ok; o++) {
      const j = (i + o + T.n) % T.n;
      if (Math.abs(linha.k[j]) > 1 / 80 || json.bordas.direita[j][0] > 0 || T.limR[j] < T.hw + 0.8) ok = false;
    }
    if (ok) i0 = i;
  }
  assert.ok(i0 >= 0, 'achou reta sem zebra');
  const manobra = (d) => {
    const race = new KartRace(json, { seed: 74, pilotos: 1, cfg }), k = race.karts[0];
    k.player = true;
    const P = T.point(T.s[i0], d, {});
    Object.assign(k, { x: P.x, z: P.z, yaw: Math.atan2(P.tx, P.tz), vx: 14, vy: 0, r: 0, v: 14, s: T.s[i0], d, hint: i0 });
    let beta = 0;
    for (let t = 0; t < 1.2; t += 1 / 60) {
      k.inp = { volante: 0.035, acel: 1, freio: 0 };   // (2°: no asfalto, ~0,7 g de curva)
      race.update(1 / 60);
      beta = Math.max(beta, Math.abs(Math.atan2(k.vy, Math.max(0.5, k.vx))));
    }
    return { beta, piso: race.track.surface(T.s[i0], d) };
  };
  const asf = manobra(0), gra = manobra(T.hw + 1.2);
  assert.equal(asf.piso, 'asfalto');
  assert.equal(gra.piso, 'grama');
  assert.ok(asf.beta < 0.15, `asfalto: deriva ${asf.beta.toFixed(2)} rad`);
  assert.ok(gra.beta > 0.5, `grama: deriva ${gra.beta.toFixed(2)} rad (rodou?)`);
});

test('zebras: toda curva de verdade tem zebra fina por dentro no ápice e zebra larga por fora na saída', () => {
  const lado = (i) => {
    const n = T.n, a = (i - 2 + n) % n, b = (i + 2) % n;
    return Math.sign((T.tx[b] - T.tx[a]) * -T.tz[i] + (T.tz[b] - T.tz[a]) * T.tx[i]) || 1;
  };
  const curvas = apices(BORDAS.raioSaida);
  assert.ok(curvas.length >= 8, `${curvas.length} curvas`);
  for (const i of curvas) {
    const dentro = lado(i) > 0 ? 'direita' : 'esquerda', fora = dentro === 'direita' ? 'esquerda' : 'direita';
    assert.equal(json.bordas[dentro][i][1], 1, `curva em s = ${T.s[i].toFixed(0)}: sem zebra fina por dentro`);
    const saida = [6, 8, 10].map((o) => json.bordas[fora][(i + o) % T.n][1]);
    assert.ok(saida.some((t) => t > 0), `curva em s = ${T.s[i].toFixed(0)}: sem zebra na saída`);
  }
});

test('cortar não compensa: a corda por dentro de cada curva fechada passa por grama ou bate em pneu', () => {
  for (const i of apices(20)) {
    // corda reta entre a linha 14 m antes e 14 m depois do ápice
    const s0 = T.s[i], A = T.point(s0 - 14, linha.d[T.idx(T.wrap(s0 - 14))], {}), B = T.point(s0 + 14, linha.d[T.idx(T.wrap(s0 + 14))], {});
    let grama = 0, muro = false;
    for (let t = 0; t <= 1; t += 1 / 56) {
      const x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t, q = T.project(x, z);
      if (T.surface(q.s, q.d) === 'grama') grama += 0.5;
      if (distMuro(x, z) < 0.7) muro = true;
    }
    assert.ok(muro || grama >= 2, `curva em s = ${s0.toFixed(0)}: corda com ${grama} m de grama e sem pneu`);
  }
});

test('muros de pneus: perto da pista em volta de tudo, nunca em cima do asfalto, e pilha no ápice das curvas fechadas', () => {
  const pneus = json.muros.filter((m) => m.tipo === 'pneus' && !m.pilha), pilhas = json.muros.filter((m) => m.pilha);
  assert.ok(pneus.length >= 2 && pilhas.length >= 3, `${pneus.length} muros, ${pilhas.length} pilhas`);
  for (const m of json.muros.filter((x) => x.tipo === 'pneus')) {
    for (const [x, z] of m.pontos) {
      const q = T.project(x, z);
      assert.ok(Math.abs(q.d) - m.raio > T.hw + 0.3, `pneu em cima da pista (s ${q.s.toFixed(0)}, d ${q.d.toFixed(2)})`);
    }
  }
  // de cada lado, a cada 10 m, o muro mais perto está a no máximo escapeMax + 1 m do asfalto (não tem como escapar muito)
  for (let i = 0; i < T.n; i += 5) {
    for (const sg of [-1, 1]) {
      const P = T.point(T.s[i], sg * (T.hw + 0.1), {});
      assert.ok(distMuro(P.x, P.z) < BORDAS.escapeMax + 1.5, `sem muro em s ${T.s[i].toFixed(0)} lado ${sg}`);
    }
  }
});

test('linha de corrida: a sobrerrelaxação chega na de curvatura mínima e encosta nas bordas', () => {
  // (sem sobrerrelaxação, nem 100 mil passadas chegam; com ela, 6 mil ficam a centímetros de 30 mil)
  const lenta = racingLine(T, { margem: cfg.linha.margem, iter: 30000, relax: 1.9 });
  let erro = 0;
  for (let i = 0; i < T.n; i++) erro = Math.max(erro, Math.abs(linha.d[i] - lenta.d[i]));
  assert.ok(erro < 0.3, `diferença máxima ${erro.toFixed(2)} m`);
  const lim = T.hw - cfg.linha.margem;
  const encosta = Array.from(linha.d).filter((d) => Math.abs(d) > lim - 0.05).length;
  assert.ok(encosta > T.n * 0.15, `encosta em ${encosta} de ${T.n} pontos`);
});

test('Jersey da reta dos boxes: nunca dentro do asfalto (antes entrava 1,6 m na saída da última curva)', () => {
  const J = json.muros.filter((m) => m.tipo === 'jersey');
  assert.equal(J.length, 1);
  for (const [x, z] of J[0].pontos) { const q = T.project(x, z); assert.ok(Math.abs(q.d) >= T.hw + 0.55, `Jersey em s ${q.s.toFixed(0)}, d ${q.d.toFixed(2)}`); }
  assert.ok(Math.max(...T.limL) <= -(T.hw - cfg.linha.margem) + 1e-6, 'muro apertando a linha de corrida pela esquerda');
});

test('ré: parado e segurando o freio, o piloto puxa o kart para trás devagar, vira e na subida pesa mais', async () => {
  const { Jogador } = await import('../src/jogador.js');
  // reta plana (rampa ~0) e um trecho de subida forte, para comparar
  let plano = -1, subida = -1, descida = -1;
  for (let i = 0; i < T.n; i++) {
    const r = T.dh[i], reto = Math.abs(linha.k[i]) < 1 / 60;
    if (reto && Math.abs(r) < 0.005 && plano < 0) plano = i;
    if (reto && r > 0.07 && subida < 0) subida = i;
    if (reto && r < -0.05 && descida < 0) descida = i;
  }
  assert.ok(plano >= 0 && subida >= 0 && descida >= 0, `achou os trechos ${plano} ${subida} ${descida}`);
  const re = (i, volante = 0, seg = 3) => {
    const race = new KartRace(json, { seed: 74, pilotos: 1, cfg }), j = new Jogador(race, 0), k = j.k, P = T.point(T.s[i], 0, {});
    Object.assign(k, { x: P.x, z: P.z, yaw: Math.atan2(P.tx, P.tz), vx: 0, vy: 0, r: 0, v: 0, s: T.s[i], d: 0, hint: i });
    const yaw0 = k.yaw;
    for (let t = 0; t < seg; t += 1 / 60) { j.aplica({ volante, acel: 0, freio: 1 }); race.update(1 / 60); }
    return { anda: T.wrap(k.s - T.s[i] + T.L / 2) - T.L / 2, vx: k.vx, gira: k.yaw - yaw0, re: k.re };
  };
  const p = re(plano), s = re(subida), v = re(plano, 1);
  console.log(`ré em 3 s: plano ${p.anda.toFixed(2)} m, morro abaixo ${s.anda.toFixed(2)} m`);
  assert.ok(p.re && p.vx < -1 && p.vx >= -1.5 - 1e-9, `de ré a ${p.vx.toFixed(2)} m/s`);
  assert.ok(p.anda < -2.5 && p.anda > -4.5, `andou ${p.anda.toFixed(2)} m para trás em 3 s`);
  // de frente para a subida, a ré é morro abaixo: anda mais; de costas (kart virado para o morro abaixo) seria pior
  assert.ok(s.anda < p.anda, `de frente para a subida a ré é morro abaixo: anda mais (${s.anda.toFixed(2)} contra ${p.anda.toFixed(2)})`);
  const d = re(descida);
  assert.ok(d.anda > p.anda && d.anda < -0.3, `de frente para a descida a ré é morro acima: pesa mais, mas anda (${d.anda.toFixed(2)} m)`);
  assert.ok(Math.abs(v.gira) > 0.05, 'com o volante, a ré vira');
  // soltar o freio: para
  const race = new KartRace(json, { seed: 74, pilotos: 1, cfg }), j = new Jogador(race, 0), k = j.k, P = T.point(T.s[plano], 0, {});
  Object.assign(k, { x: P.x, z: P.z, yaw: Math.atan2(P.tx, P.tz), vx: 0, vy: 0, r: 0, v: 0, s: T.s[plano], d: 0, hint: plano });
  for (let t = 0; t < 2; t += 1 / 60) { j.aplica({ volante: 0, acel: 0, freio: 1 }); race.update(1 / 60); }
  for (let t = 0; t < 1; t += 1 / 60) { j.aplica({ volante: 0, acel: 0, freio: 0 }); race.update(1 / 60); }
  assert.ok(Math.abs(k.vx) < 0.01 && !k.re, 'parou ao soltar');
});
