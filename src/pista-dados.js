// Geometria do Circuito 101 a partir do KartTrack do RCL-Trânsito, sem three: asfalto, zebras, faixas brancas, linha de
// chegada, área de escape e muros. Tudo em coordenadas LOCAIS (global − origem), x leste, z sul, y para cima.
// Lado: d > 0 = à direita de quem anda, como no traffic-kart.js.

// O traçado vem do mundo do RCL com 9 karts parados no cenário (obstáculos); aqui a pista é só da corrida.
export function tracadoDaCorrida(bruto) {
  return { ...bruto, parados: [] };
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
    v.push([p.x - origem.x, y, p.z - origem.z]);
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

// Linha de chegada no primeiro ponto do eixo (s = 0): quadriculado de 0,5 m, duas fileiras, de borda a borda.
export function linhaChegada(track, origem, y = 0.035, casa = 0.5) {
  const pos = [], cor = [], hw = track.hw, cols = Math.round((2 * hw) / casa);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const s0 = track.wrap(r * casa - casa), s1 = s0 + casa, d0 = -hw + c * casa;
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
