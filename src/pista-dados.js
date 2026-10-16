// Geometria do Circuito 101 a partir do KartTrack, sem three: asfalto, zebras, faixas brancas, linha de chegada, área de
// escape e muros. Tudo em coordenadas LOCAIS (global − origem), x leste, z sul, y para cima.
// Lado: d > 0 = à direita de quem anda, como no traffic-kart.js.
// (Desde a mensagem 013 este arquivo é do chat RCL-Karts: tracadoDaCorrida põe o relevo, as bordas e os muros novos.)
import { KartTrack, racingLine, KART_CONFIG } from './fisica/kart-fisica.js';
import { alturasDoEixo, inclinacoesDoEixo, bordasDaLinha, murosDaPista, areaDeEscape, murosDaArea, abreMurosNaArea } from './fisica/bordas.js';
import { CFG_101 } from './calibragem.js';

// O traçado vem do mundo do RCL com 9 karts parados no cenário (obstáculos); aqui a pista é só da corrida. Com o relevo
// no traçado (campo relevo), cada ponto do eixo ganha a altura; as bordas (zebra fina na tangência, zebra larga e faixa
// azul na saída, grama até o muro) saem da linha de corrida; os muros de pneus do gerador dão lugar aos muros em volta de
// toda a pista (o Jersey fica).
// alisamento das curvas mais fechadas que o real (ver suavizaEixo)
export const AJUSTE_EIXO = { raioMin: 10, passadas: 20 };
export function tracadoDaCorrida(bruto) {
  if (!bruto.relevo) return { ...bruto, parados: [] };
  const desloc = bruto.ajusteEixo?.desloc ? deslocDoAjuste(bruto.ajusteEixo.desloc, bruto.eixo.length - 1) : null;
  const { eixo: redesenhado, fixos } = aplicaRedesenho(bruto.eixo, bruto.redesenho);
  const comprimento = comprimentoDoEixo(bruto.eixo);   // o oficial (1.015 m), mesmo com trecho redesenhado
  const base = { ...bruto, parados: [], muros: [], eixo: suavizaEixo(redesenhado, 2, { ...AJUSTE_EIXO, desloc, fixos, comprimento }) };
  const linha = bruto.cronometro?.s ?? 0, T0 = new KartTrack(base);
  const relevo = {
    ...bruto.relevo, h: alisaVolta(alturasDoEixo(T0, bruto.relevo, linha), 5),
    inc: alisaVolta(inclinacoesDoEixo(T0, bruto.relevo.inclinacao, linha, bruto.relevo.comprimento), 2)
  };
  const jersey = (bruto.muros || []).filter((m) => m.tipo === 'jersey').map((m) => jerseyForaDoAsfalto(T0, m));
  const areas = (bruto.escape || []).map((e) => areaDeEscape(T0, linha, e));
  const semPneus = { ...base, relevo, areas, muros: jersey };
  const T1 = new KartTrack(semPneus), cfgLinha = { ...KART_CONFIG.linha, ...(CFG_101.linha || {}) };
  const line = racingLine(T1, cfgLinha), lim = T1.hw - cfgLinha.margem;
  const bordas = bordasDaLinha(T1, line, lim);
  const J = jersey.flatMap((m) => m.pontos.slice(1).map((b, i) => ({ ax: m.pontos[i][0], az: m.pontos[i][1], bx: b[0], bz: b[1] })));
  const { muros, pilhas } = murosDaPista(T1, line, bordas, J);
  const daArea = areas.flatMap((a) => murosDaArea(T1, a));
  return { ...semPneus, bordas, muros: [...jersey, ...abreMurosNaArea([...muros, ...pilhas], areas), ...daArea] };
}

// Jersey da reta dos boxes: o traçado bruto traz uma linha reta de 105 m que, na saída da última curva, entrava 1,6 m no
// asfalto (o muro de concreto ficava dentro da pista). Vira uma polilinha a cada 2 m que nunca chega a menos de `folga` m
// da borda do asfalto; onde já estava longe, fica onde estava.
export function jerseyForaDoAsfalto(track, m, folga = 0.6) {
  const out = [], p = {};
  for (let i = 0; i + 1 < m.pontos.length; i++) {
    const [ax, az] = m.pontos[i], [bx, bz] = m.pontos[i + 1], k = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let t = i ? 1 : 0; t <= k; t++) {
      const x = ax + ((bx - ax) * t) / k, z = az + ((bz - az) * t) / k, q = track.project(x, z);
      if (Math.abs(q.d) < track.hw + folga) { track.point(q.s, (Math.sign(q.d) || -1) * (track.hw + folga), p); out.push([+p.x.toFixed(3), +p.z.toFixed(3)]); }
      else out.push([+x.toFixed(3), +z.toFixed(3)]);
    }
  }
  return { ...m, pontos: out };
}

// Trechos redesenhados (campo redesenho do traçado): troca os pontos i0..i1 do eixo bruto pelos do desenho novo (mesma
// quantidade de pontos, com as pontas iguais às do eixo). Devolve o eixo e a máscara dos pontos desenhados (que o
// alisamento não mexe: já vêm lisos).
export function aplicaRedesenho(eixo, redesenho = []) {
  const n = eixo.length - 1, novo = eixo.slice(0, -1).map((p) => p.slice()), fixos = new Uint8Array(n);
  for (const r of redesenho || []) {
    if (r.pontos.length !== r.i1 - r.i0 + 1) throw new Error('redesenho: quantidade de pontos diferente do trecho');
    r.pontos.forEach((p, k) => { const i = (r.i0 + k) % n; novo[i] = p.slice(); if (k > 2 && k < r.pontos.length - 3) fixos[i] = 1; });
  }
  return { eixo: [...novo, novo[0]], fixos };
}

export function comprimentoDoEixo(eixo) {
  let L = 0;
  for (let i = 0; i + 1 < eixo.length; i++) L += Math.hypot(eixo[i + 1][0] - eixo[i][0], eixo[i + 1][1] - eixo[i][1]);
  return L;
}

// Deslocamento do eixo (m, para a direita de quem anda) por ponto, a partir da lista [[ponto, m], …] do traçado.
export function deslocDoAjuste(lista, n) {
  const d = new Float64Array(n);
  for (const [i, v] of lista) d[i % n] = v;
  return d;
}

// Média gaussiana numa volta fechada (σ em pontos): o perfil do SRTM tem 48 pontos ligados em reta, com quinas a cada
// ~21 m; alisado (σ = 5 pontos, 10 m), a rampa muda aos poucos (sem tranco no kart e sem quina no chão desenhado).
export function alisaVolta(v, sigma) {
  const n = v.length, R = Math.ceil(sigma * 3), w = [];
  for (let o = -R; o <= R; o++) w.push(Math.exp(-(o * o) / (2 * sigma * sigma)));
  const W = w.reduce((a, b) => a + b, 0);
  return v.map((_, i) => { let a = 0; for (let o = -R; o <= R; o++) a += v[(i + o + n) % n] * w[o + R]; return +(a / W).toFixed(3); });
}

// Eixo suavizado: o eixo bruto (a cada 2 m) tem serrilhado de ponto a ponto (viradas de até 28° entre trechos de 2 m e
// raios de 4 m onde a curva tem 9). Uma média gaussiana (σ = 2 pontos, 4 m) na volta fechada tira o serrilhado e mexe a
// pista menos de 0,5 m; onde o raio do eixo ainda fica menor que raioMin, alisa mais, só ali. O último ponto continua
// igual ao primeiro (o traçado fecha).
// `desloc` (opcional, m por ponto, + direita): o redesenho dos S (ajusteEixo do traçado), aplicado antes da escala.
// `fixos` (máscara por ponto): pontos redesenhados, que nem a média nem o alívio mexem. `comprimento`: o comprimento final
// (sem ele, o do eixo de entrada).
export function suavizaEixo(eixo, sigma = 2, { raioMin = 0, passadas = 0, desloc = null, fixos = null, comprimento = null } = {}) {
  const P = eixo.slice(0, -1), n = P.length, R = Math.ceil(sigma * 3), w = [];
  for (let o = -R; o <= R; o++) w.push(Math.exp(-(o * o) / (2 * sigma * sigma)));
  const W = w.reduce((a, b) => a + b, 0);
  let out = P.map((_, i) => {
    if (fixos?.[i]) return P[i].slice();
    let x = 0, z = 0;
    for (let o = -R; o <= R; o++) { const q = P[(i + o + n) % n], k = w[o + R]; x += q[0] * k; z += q[1] * k; }
    return [x / W, z / W];
  });
  // curvas fechadas demais (raio do eixo menor que raioMin, medido com pontos a ±6 m): alisa só ali, aos poucos
  const raio = (Q, i, k = 3) => {
    const a = Q[(i - k + n) % n], b = Q[i], c = Q[(i + k) % n];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const cr = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    return cr > 1e-9 ? (ab * bc * ca) / (2 * cr) : 1e4;
  };
  for (let it = 0; it < passadas; it++) {
    const novo = out.map((q, i) => {
      if (fixos?.[i] || raio(out, i) >= raioMin) return q;
      const a = out[(i - 1 + n) % n], c = out[(i + 1) % n];
      return [(a[0] + 2 * q[0] + c[0]) / 4, (a[1] + 2 * q[1] + c[1]) / 4];
    });
    out = novo;
  }
  if (desloc) {
    // normal (direita de quem anda) pela tangente entre os vizinhos
    out = out.map((q, i) => {
      const a = out[(i - 1 + n) % n], c = out[(i + 1) % n], tx = c[0] - a[0], tz = c[1] - a[1], L = Math.hypot(tx, tz) || 1;
      return [q[0] - (tz / L) * desloc[i], q[1] + (tx / L) * desloc[i]];
    });
  }
  // tirar o serrilhado encurta a polilinha (~13 m); o comprimento oficial é o do eixo bruto (1.015 m): escala em volta do
  // centro até voltar a ele (mexe no máximo ~1,5 m) e põe o primeiro ponto onde estava (a linha e o grid não mudam)
  const comp = (Q) => Q.reduce((a, q, i) => { const r = Q[(i + 1) % n]; return a + Math.hypot(r[0] - q[0], r[1] - q[1]); }, 0);
  const k = (comprimento ?? comp(P)) / comp(out), cx = out.reduce((a, q) => a + q[0], 0) / n, cz = out.reduce((a, q) => a + q[1], 0) / n;
  out = out.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
  const dx = P[0][0] - out[0][0], dz = P[0][1] - out[0][1];
  out = out.map(([x, z]) => [+(x + dx).toFixed(3), +(z + dz).toFixed(3)]);
  return [...out, out[0]];
}

const ZEBRA_VERMELHO = [0.78, 0.07, 0.09];
const ZEBRA_BRANCO = [0.93, 0.93, 0.93];

// Faixa contínua entre os afastamentos d0 e d1 (m), na volta inteira, um par de vértices por ponto do eixo.
// Sempre do menor para o maior afastamento, para a face ficar virada para cima (senão a luz vem pelo avesso).
export function faixa(track, d0, d1, origem, y = 0) {
  if (d0 > d1) [d0, d1] = [d1, d0];
  const n = track.n, pos = new Float32Array(n * 2 * 3), idx = new Uint32Array(n * 6), p = {};
  for (let i = 0; i < n; i++) {
    track.point(track.s[i], d0, p);
    pos.set([p.x - origem.x, y, p.z - origem.z], i * 6);
    track.point(track.s[i], d1, p);
    pos.set([p.x - origem.x, y, p.z - origem.z], i * 6 + 3);
    const a = i * 2, b = ((i + 1) % n) * 2;
    idx.set([a, a + 1, b, a + 1, b + 1, b], i * 6);
  }
  return { pos, idx };
}

// Quadrilátero entre s0 e s1 (m ao longo da volta) e os afastamentos d0 e d1, como dois triângulos.
function quad(track, s0, s1, d0, d1, origem, y, out, cor, cores) {
  if (d0 > d1) [d0, d1] = [d1, d0];
  const p = {}, v = [];
  for (const [s, d] of [[s0, d0], [s0, d1], [s1, d1], [s1, d0]]) {
    track.point(s, d, p);
    v.push([p.x - origem.x, y + (track.altura ? track.altura(s, d) : 0), p.z - origem.z]);   // (com o relevo e a inclinação, se tiver)
  }
  for (const k of [0, 1, 2, 0, 2, 3]) { out.push(...v[k]); cores.push(...cor); }
}

// Zebras onde o gerador pôs (por trecho de 2 m, de cada lado), em listras de 1 m vermelhas e brancas.
export function zebras(track, origem, y = 0.03) {
  const pos = [], cor = [], hw = track.hw, z = track.zebra || 0;
  if (!z) return { pos: new Float32Array(), cor: new Float32Array() };
  for (let i = 0; i < track.n; i++) {
    const s0 = track.s[i], s1 = track.s[i + 1], meio = (s0 + s1) / 2;
    for (const [lado, tem] of [[-1, track.zL[i]], [1, track.zR[i]]]) {
      if (!tem) continue;
      const d0 = lado * hw, d1 = lado * (hw + z);
      quad(track, s0, meio, d0, d1, origem, y, pos, ZEBRA_VERMELHO, cor);
      quad(track, meio, s1, d0, d1, origem, y, pos, ZEBRA_BRANCO, cor);
    }
  }
  return { pos: Float32Array.from(pos), cor: Float32Array.from(cor) };
}

// Linha de chegada na linha de cronometragem (campo `cronometro` do traçado; sem ele, s = 0): quadriculado de 0,5 m,
// duas fileiras, de borda a borda.
export function linhaChegada(track, origem, y = 0.035, casa = 0.5, s = track.json?.cronometro?.s ?? 0) {
  const pos = [], cor = [], hw = track.hw, cols = Math.round((2 * hw) / casa);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const s0 = track.wrap(s + r * casa - casa), s1 = s0 + casa, d0 = -hw + c * casa;
      quad(track, s0, s1, d0, d0 + casa, origem, y, pos, (r + c) % 2 ? [0.05, 0.05, 0.05] : [0.95, 0.95, 0.95], cor);
    }
  }
  return { pos: Float32Array.from(pos), cor: Float32Array.from(cor) };
}

// Muros do traçado: pilhas de pneus a cada `passo` m (cor alternada) e o Jersey como segmentos.
// Trechos de pneus com mais de 6 m entre pontos são buracos (o KartTrack também pula).
export function muros(track, origem, passo = 0.6) {
  const pilhas = [], jersey = [];
  for (const m of track.json.muros || []) {
    for (let i = 0; i + 1 < m.pontos.length; i++) {
      const [ax, az] = m.pontos[i], [bx, bz] = m.pontos[i + 1], L = Math.hypot(bx - ax, bz - az);
      if (m.tipo === 'jersey') {
        jersey.push({ ax: ax - origem.x, az: az - origem.z, bx: bx - origem.x, bz: bz - origem.z, r: m.raio });
        continue;
      }
      if (L > 6) continue;
      const k = Math.max(1, Math.round(L / passo));
      for (let j = 0; j < k; j++) {
        const t = j / k;
        pilhas.push({ x: ax + (bx - ax) * t - origem.x, z: az + (bz - az) * t - origem.z, vermelho: pilhas.length % 2 === 1 });
      }
    }
  }
  return { pilhas, jersey };
}

// Menor distância (m) do ponto (x, z) global ao eixo do traçado.
export function distanciaAoEixo(track, x, z) {
  let m = Infinity;
  for (let i = 0; i < track.n; i++) m = Math.min(m, Math.hypot(track.x[i] - x, track.z[i] - z));
  return m;
}

// Postes de luz: a cada `passo` m, do lado de fora da volta (o mais longe do centro), a `afasta` m da borda; fica de
// fora o poste que cair a menos de `folga` m de qualquer trecho da pista (outra parte do traçado passando perto).
export function postes(track, origem, { passo = 40, afasta = 6, folga = 9 } = {}) {
  const out = [], p = {}, c = track.center, borda = track.hw + (track.zebra || 0);
  for (let s = 10; s < track.L; s += passo) {
    track.point(s, 0, p);
    const dir = Math.hypot(p.x - p.tz - c.x, p.z + p.tx - c.z) > Math.hypot(p.x + p.tz - c.x, p.z - p.tx - c.z) ? 1 : -1;
    track.point(s, dir * (borda + afasta), p);
    if (distanciaAoEixo(track, p.x, p.z) < folga) continue;
    out.push({ x: p.x - origem.x, z: p.z - origem.z, s });
  }
  return out;
}

// Reta principal (a da linha de cronometragem): pontos do lado esquerdo (no 101, o norte, onde ficam os boxes) para
// pôr prédio, torre e arquibancada. Devolve o ponto em (s, d) local e o rumo (rad, em torno de Y, como o yaw do kart).
export function naReta(track, origem, s, d) {
  const p = track.point(s, d, {});
  return { x: p.x - origem.x, z: p.z - origem.z, rumo: Math.atan2(p.tx, p.tz) };
}
