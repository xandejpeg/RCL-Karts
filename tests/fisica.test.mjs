// RCL-Karts · testes da física própria (src/fisica): relevo do 101 no kart, grama sem aderência (roda), zebras nas
// curvas, muros de pneus e pilhas que não deixam cortar, e a linha de curvatura mínima convergida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KartRace, KartTrack, KART_CONFIG, racingLine, speedProfile } from '../src/fisica/kart-fisica.js';
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

// perto de uma área de escape (dentro dela ou a 2 m da borda)
const naArea = (x, z) => (json.areas || []).some((a) => a.centro.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < a.largura / 2 + 2));

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

test('relevo: alturas do perfil ajustado no eixo (0 a ~16 m), comprimento oficial e o kart sobe e desce com a pista', () => {
  assert.ok(Math.abs(T.L - 1014.97) < 1, `L = ${T.L}`);
  const h = json.relevo.h;
  assert.equal(h.length, T.n);
  assert.ok(Math.min(...h) >= 0 && Math.min(...h) < 0.6 && Math.max(...h) > 14.5 && Math.max(...h) < 17, `h ${Math.min(...h)}–${Math.max(...h)}`);
  // nenhuma rampa passa de 13% (o S depois da reta desce ~8%, as subidas chegam a ~11%)
  assert.ok(Math.max(...Array.from(T.dh, Math.abs)) < 0.13, 'rampa forte demais');
  for (let i = 0; i < T.n; i++) assert.ok(Math.abs(h[(i + 1) % T.n] - h[i]) < 0.5, `degrau no ponto ${i}`);
  const race = new KartRace(json, { seed: 74, pilotos: 1, start: 'espalhado', cfg });
  const k = race.karts[0];
  let ymin = Infinity, ymax = -Infinity, arf = 0;
  for (let t = 0; t < 70; t += 1 / 60) {
    race.update(1 / 60);
    if (Math.abs(k.d) <= T.hw) assert.ok(Math.abs(k.y - (k.ergue || 0) - T.altura(k.s, k.d)) < 1e-6);   // (no asfalto: relevo + inclinação no afastamento dele; mais o chassi torcendo na curva)
    ymin = Math.min(ymin, k.y); ymax = Math.max(ymax, k.y); arf = Math.max(arf, Math.abs(k.arfagem));
  }
  assert.ok(ymax - ymin > 14, `subiu ${(ymax - ymin).toFixed(1)} m na volta`);
  assert.ok(arf > 0.02 && arf < 0.15, `arfagem máxima ${arf.toFixed(3)} rad`);
});

test('subida custa: a mesma reta morro acima é mais lenta que morro abaixo (perfil de velocidade)', () => {
  const plano = { ...json, relevo: { ...json.relevo, h: json.relevo.h.map(() => 0) } };
  const r0 = new KartRace(plano, { seed: 74, pilotos: 1, cfg }), r1 = new KartRace(json, { seed: 74, pilotos: 1, cfg });
  assert.notEqual(r0.refLap.toFixed(3), r1.refLap.toFixed(3));
  // a volta tem ~16 m de subida e de descida: no total muda pouco (menos de 3%)
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
      if (naArea(P.x, P.z)) continue;   // (a boca da área de escape e a volta dela na pista são abertas de propósito)
      assert.ok(distMuro(P.x, P.z) < BORDAS.escapeMax + 1.5, `sem muro em s ${T.s[i].toFixed(0)} lado ${sg}`);
    }
  }
});

test('linha de corrida: a sobrerrelaxação chega na de curvatura mínima e encosta nas bordas', () => {
  // (sem sobrerrelaxação, nem 100 mil passadas chegam; com ela, 6 mil ficam a centímetros de 30 mil)
  const lenta = racingLine(T, { margem: cfg.linha.margem, iter: 30000, relax: cfg.linha.relax });
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

test('curva inclinada na última perna do 1º S: o lado de dentro mais baixo, a física e o perfil de velocidade sentem', () => {
  const i = Array.from(T.inc).reduce((m, v, k) => (Math.abs(v) > Math.abs(T.inc[m]) ? k : m), 0), s = T.s[i];
  assert.ok(Math.abs(T.inc[i]) > 0.2, `inclinação ${T.inc[i]}`);   // ~14°
  // curva para a direita (curvatura negativa): o lado direito (de dentro) é o mais baixo
  assert.ok(linha.k[i] < 0 && T.inc[i] < 0, 'inclinação para dentro da curva');
  assert.ok(T.altura(s, -T.hw) - T.altura(s, T.hw) > 1.5, 'de fora mais de 1,5 m acima de dentro');
  // o kart parado ali fica inclinado (rolagem) e o perfil de velocidade passa mais rápido do que sem a inclinação
  const race = new KartRace(json, { seed: 74, pilotos: 1, cfg }), k = race.karts[0], P = T.point(s, 0, {});
  Object.assign(k, { x: P.x, z: P.z, yaw: Math.atan2(P.tx, P.tz), s, d: 0, hint: i, vx: 8, v: 8 });
  race.update(1 / 60);
  assert.ok(Math.abs(k.rolagem) > 0.15, `rolagem ${k.rolagem}`);
  const plano = new KartTrack({ ...json, relevo: { ...json.relevo, inc: json.relevo.inc.map(() => 0) } });
  const L0 = racingLine(plano, cfg.linha), v0 = speedProfile(plano, L0, { cfg }).v[i], v1 = speedProfile(T, linha, { cfg }).v[i];
  assert.ok(v1 > v0 + 0.5, `com inclinação ${(v1 * 3.6).toFixed(1)} km/h, sem ${(v0 * 3.6).toFixed(1)} km/h`);
});

test('área de escape do 1º S: asfalto ao lado do S, muros dos dois lados e portão em zigue-zague', () => {
  assert.equal(json.areas.length, 1);
  const a = json.areas[0];
  // no meio da área, o piso é asfalto (mesmo longe do eixo); fora dela, grama
  const meio = a.centro[Math.floor(a.centro.length / 2)], q = T.project(meio[0], meio[1]);
  assert.ok(Math.abs(q.d) > T.hw + 8, 'a área fica longe do eixo do S');
  assert.equal(T.surface(q.s, q.d), 'asfalto');
  assert.equal(T.surface(q.s, q.d + Math.sign(q.d) * 9), 'grama');
  const portao = json.muros.filter((m) => m.portao), lados = json.muros.filter((m) => m.escape);
  assert.equal(portao.length, 3);
  assert.ok(lados.length >= 2);
  // nenhum muro de pneu da pista dentro da área (a boca na T1 e a volta na reta ficam abertas)
  const P = a.poligono, dentro = (x, z) => { let d = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d; } return d; };
  for (const m of json.muros.filter((m) => m.tipo === 'pneus' && !m.portao)) for (const [x, z] of m.pontos) assert.ok(!dentro(x, z), 'muro dentro da área de escape');
});

test('área de escape não é atalho: do T1 até a reta de baixo, pelo escape (passando no portão) leva mais tempo que pelo S', () => {
  const Lc = linha;   // linha de corrida
  const ds0 = (P) => Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
  function tempo(P, v0) {
    const n = P.length, ds = [], k = new Float64Array(n);
    for (let i = 0; i + 1 < n; i++) ds.push(Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]));
    const st = Math.max(1, Math.round(3 / (ds0(P) || 1)));
    for (let i = st; i + st < n; i++) { const a = P[i - st], b = P[i], c = P[i + st]; const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]); const cr = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); k[i] = cr > 1e-9 ? (2 * cr) / (ab * bc * ca) : 0; }
    const v = Array.from(k, (kk) => Math.min(40, Math.sqrt(mu * g / Math.max(kk, 1e-4))));
    v[0] = Math.min(v[0], v0);
    const acc = (vv) => (Math.min(cfg.tracaoMax, cfg.potencia / Math.max(vv, 1)) - 0.5 * 1.2 * cfg.cdA * vv * vv) / cfg.massa, dec = cfg.freioMax * 0.9 / cfg.massa;
    for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * dec * ds[i]));
    for (let i = 0; i + 1 < n; i++) v[i + 1] = Math.min(v[i + 1], Math.sqrt(v[i] ** 2 + 2 * acc(v[i]) * ds[i]));
    let t = 0; for (let i = 0; i + 1 < n; i++) t += ds[i] / Math.max(0.5, (v[i] + v[i + 1]) / 2);
    return { t, vmin: Math.min(...v) * 3.6, comp: ds.reduce((a, b) => a + b, 0) };
  }
  const lin = 32, p = {}, mu = cfg.mu * cfg.perfil.atrito, g = 9.81;
  // pelo S: a linha de corrida de d 90 até d 205
  const S = []; for (let d = 90; d <= 205; d += 1) { const s = lin + d; T.point(s, Lc.d[T.idx(s)], p); S.push([p.x, p.z]); }
  // pelo escape: da linha em d 90 até a boca, o centro da área, os vãos do portão, e a volta na linha em d 205
  const a = json.areas[0], C = a.centro, w = a.largura / 2;
  const E = [S[0]];
  T.point(lin + 96, Lc.d[T.idx(lin + 96)], p); E.push([p.x, p.z]);
  const portao = a.portao.em.map((f) => Math.round(f * (C.length - 1)));
  for (let i = 0; i < C.length; i++) {
    const j = portao.indexOf(i);
    if (j < 0) { if (!portao.some((q) => Math.abs(q - i) < 3)) E.push(C[i]); continue; }
    // no portão: passa pelo vão (do lado oposto à barreira), a 1,2 m da borda
    const q0 = C[Math.max(0, i - 1)], q1 = C[Math.min(C.length - 1, i + 1)], tx = q1[0] - q0[0], tz = q1[1] - q0[1], Lq = Math.hypot(tx, tz), rx = -tz / Lq, rz = tx / Lq;
    const sg = j % 2 ? -1 : 1, dd = sg * (w - 1.2);
    E.push([C[i][0] + rx * dd, C[i][1] + rz * dd]);
  }
  T.point(lin + 205, Lc.d[T.idx(lin + 205)], p); E.push([p.x, p.z]);
  // curva suave pelos pontos do escape (Catmull-Rom a cada 0,5 m)
  function suave(P) { const out = []; for (let i = 0; i + 1 < P.length; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)]; const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(1, Math.round(L / 0.5)); for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t; const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } } out.push(P[P.length - 1]); return out; }
  const v0 = 20;   // chega na T1 a ~72 km/h
  const rs = tempo(S, v0), re = tempo(suave(E), v0);
  assert.ok(re.t > rs.t + 2, `pelo S ${rs.t.toFixed(2)} s, pelo escape ${re.t.toFixed(2)} s`);
});
