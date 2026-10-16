// Pista em 3D, parte sem three (testada no Node): sorteio com semente, faixas com colunas e uv, zebras com relevo e
// listras, borracha da linha de corrida, marcas do grid, árvores e alambrado em volta. Coordenadas LOCAIS (global −
// origem), x leste, z sul, y para cima; d > 0 = à direita de quem anda, como no traffic-kart.js.

// Sorteio com semente (mulberry32): o mesmo cenário em toda máquina.
export function sorteio(semente = 74) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Faixa da volta inteira entre d0 e d1, com `colunas` divisões na largura (para a cor por vértice variar de lado a lado).
// uv em metros divididos pela escala: u ao longo da volta, v de lado a lado. `cor(s, d)` devolve [r, g, b] (opcional).
// `alt(i)` (opcional) soma a altura do chão no ponto i do eixo (relevo): a faixa fica nivelada de lado a lado.
export function faixaColunas(track, d0, d1, origem, { y = 0, colunas = 1, escalaU = 1, escalaV = 1, cor = null, alt = null } = {}) {
  if (d0 > d1) [d0, d1] = [d1, d0];
  const n = track.n, c = colunas + 1, nv = (n + 1) * c;
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), cores = cor ? new Float32Array(nv * 3) : null;
  const idx = new Uint32Array(n * colunas * 6), p = {};
  for (let i = 0; i <= n; i++) {
    const s = track.s[i];
    for (let j = 0; j < c; j++) {
      const d = d0 + ((d1 - d0) * j) / colunas, k = i * c + j;
      track.point(s, d, p);
      pos.set([p.x - origem.x, y + (alt ? alt(i % n) : 0), p.z - origem.z], k * 3);
      uv.set([s / escalaU, d / escalaV], k * 2);
      if (cores) cores.set(cor(s, d, i % n), k * 3);
    }
  }
  let o = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < colunas; j++) {
      const a = i * c + j, b = (i + 1) * c + j;
      idx.set([a, a + 1, b, a + 1, b + 1, b], o);
      o += 6;
    }
  }
  return { pos, uv, idx, cores };
}

// Borracha: o asfalto escurece na linha de corrida (onde todo mundo passa) e clareia um pouco nas bordas (poeira).
// `linhaD[i]` = afastamento da linha no ponto i do eixo. Devolve o fator de brilho (1 = asfalto limpo).
export function brilhoDoAsfalto(d, dLinha, hw) {
  const borracha = 0.3 * Math.exp(-((d - dLinha) ** 2) / (2 * 0.95 ** 2));
  const poeira = 0.1 * Math.max(0, (Math.abs(d) - (hw - 1.1)) / 1.1);
  return 1 - borracha + poeira;
}

// Zebras pelas bordas do traçado (track.borda.L/R: largura z, tipo t e faixa azul a por ponto do eixo): tipo 1 = zebra
// fina com relevo (sobe 3 cm logo depois da borda do asfalto e cai na beira de fora), listras de 1 m; tipo 2 = zebra larga
// pintada no chão (quase sem relevo), listras de 2 m. Vermelho e branco, com aresta seca entre as cores (vértices próprios
// por listra). `alt(s)` (opcional) soma o relevo. Sem track.borda, usa o jeito antigo (track.zebra, zL, zR).
export const ZEBRA = {
  perfil: [[0, 0], [0.18, 0.028], [0.82, 0.032], [1, 0.004]], perfilLarga: [[0, 0], [0.5, 0.006], [1, 0.004]],
  vermelho: [0.74, 0.06, 0.07], branco: [0.92, 0.92, 0.9], listra: 1, listraLarga: 2
};
export function bordasDoTrack(track) {
  if (track.borda) return track.borda;
  const z = track.zebra || 0, mk = (zz) => ({ z: Float64Array.from(zz, (v) => (v ? z : 0)), t: Float64Array.from(zz, (v) => (v ? 1 : 0)), a: new Float64Array(track.n) });
  return { L: mk(track.zL || []), R: mk(track.zR || []) };
}
export function zebras3d(track, origem, { y = 0.02, passosPorListra = 2, alt = null } = {}) {
  const hw = track.hw, pos = [], cores = [], idx = [], p = {}, B = bordasDoTrack(track), n = track.n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, s0 = track.s[i], s1 = track.s[i + 1];
    for (const [lado, b] of [[-1, B.L], [1, B.R]]) {
      const tipo = b.t[i];
      if (!tipo || b.t[j] !== tipo || !b.z[i] || !b.z[j]) continue;
      const larga = tipo === 2, perfil = larga ? ZEBRA.perfilLarga : ZEBRA.perfil, listra = larga ? ZEBRA.listraLarga : ZEBRA.listra;
      // listras pela posição absoluta s (a cor não muda de trecho para trecho no meio da listra)
      let a = s0;
      while (a < s1 - 1e-6) {
        const c = Math.min(s1, (Math.floor(a / listra + 1e-6) + 1) * listra), cor = Math.floor(a / listra + 1e-6) % 2 ? ZEBRA.branco : ZEBRA.vermelho;
        const base = pos.length / 3;
        for (let k = 0; k <= passosPorListra; k++) {
          const s = a + ((c - a) * k) / passosPorListra, f = (s - s0) / ((s1 - s0) || 1), z = b.z[i] + (b.z[j] - b.z[i]) * f;
          const y0 = y + (alt ? alt(s) : 0);
          for (const [t, h] of perfil) {
            track.point(s, lado * (hw + t * z), p);
            pos.push(p.x - origem.x, y0 + h, p.z - origem.z);
            cores.push(...cor);
          }
        }
        const m = perfil.length;
        for (let k = 0; k < passosPorListra; k++) {
          for (let q0 = 0; q0 < m - 1; q0++) {
            const q = base + k * m + q0, r = q + m;
            // face para cima nos dois lados da pista (a ordem troca com o lado)
            if (lado > 0) idx.push(q, q + 1, r, q + 1, r + 1, r); else idx.push(q, r, q + 1, q + 1, r, r + 1);
          }
        }
        a = c;
      }
    }
  }
  return { pos: Float32Array.from(pos), cores: Float32Array.from(cores), idx: Uint32Array.from(idx) };
}

// Faixas de lado a lado com largura variando por ponto: de dIn(i) a dOut(i) (m a partir do eixo, sempre positivos), dos
// dois lados, só nos trechos onde `tem(lado, i)` vale nas duas pontas. `altIn(i)`/`altOut(x, z, i)` dão a altura das duas
// beiradas (a de fora pode seguir o terreno). uv em metros / escala. Usada para a faixa azul e para o ombro de grama.
export function faixaBorda(track, origem, { dIn, dOut, tem = () => true, altIn, altOut, escala = 4 }) {
  const pos = [], uv = [], idx = [], p = {}, n = track.n;
  for (const lado of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (!tem(lado, i) || !tem(lado, j)) continue;
      const base = pos.length / 3, si = [track.s[i], track.s[i + 1]];
      for (const [k, q] of [[i, 0], [j, 1]]) {
        const s = si[q], a = dIn(lado, k), b = dOut(lado, k);
        track.point(s, lado * a, p);
        pos.push(p.x - origem.x, altIn(k), p.z - origem.z); uv.push(s / escala, a / escala);
        track.point(s, lado * b, p);
        pos.push(p.x - origem.x, altOut(p.x - origem.x, p.z - origem.z, k), p.z - origem.z); uv.push(s / escala, b / escala);
      }
      // (0 dentro, 1 fora) em i; (2 dentro, 3 fora) em j: face para cima
      if (lado > 0) idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      else idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  return { pos: Float32Array.from(pos), uv: Float32Array.from(uv), idx: Uint32Array.from(idx) };
}

// Pilhas de pneus dos muros do traçado (json.muros do tipo 'pneus': os muros em volta e as pilhas soltas dos ápices), a
// cada `passo` m, de cor alternada; y no terreno (`alt(x, z)` local). Trechos com mais de 6 m entre pontos são buracos.
export function pneusDosMuros(track, origem, { passo = 0.6, alt = () => 0 } = {}) {
  const out = [];
  for (const m of track.json?.muros || []) {
    if (m.tipo !== 'pneus') continue;
    let sobra = 0;
    for (let i = 0; i + 1 < m.pontos.length; i++) {
      const [ax, az] = m.pontos[i], [bx, bz] = m.pontos[i + 1], L = Math.hypot(bx - ax, bz - az);
      if (L > 6) { sobra = 0; continue; }
      let t = sobra;
      while (t < L) {
        const x = ax + ((bx - ax) * t) / L - origem.x, z = az + ((bz - az) * t) / L - origem.z;
        out.push({ x, z, y: alt(x, z), vermelho: Math.floor(out.length / 2) % 2 === 1, pilha: !!m.pilha });
        t += passo;
      }
      sobra = t - L;
    }
  }
  return out;
}

// Postos de fiscal: do lado de fora das `quantos` curvas mais fechadas da linha (`linhaK`: curvatura por ponto), atrás
// do muro (a `afasta` m do eixo), só onde nenhum outro trecho da pista passa a menos de `folga` m. Devolve
// { x, z, rumo } locais (rumo virado para a curva).
export function postosDeFiscal(track, origem, linhaK, { quantos = 6, afasta = 13, folga = 8.5 } = {}) {
  const n = track.n, dist = medidorDeDistancia(track, origem), apices = [], p = {};
  for (let i = 0; i < n; i++) {
    const k = Math.abs(linhaK[i]);
    let max = k > 1 / 40;
    for (let o = -8; o <= 8 && max; o++) if (o && Math.abs(linhaK[(i + o + n) % n]) > k) max = false;
    if (max) apices.push({ i, k });
  }
  apices.sort((a, b) => b.k - a.k);
  const out = [];
  for (const { i } of apices) {
    if (out.length >= quantos) break;
    const a = (i - 2 + n) % n, b = (i + 2) % n;
    const dentro = Math.sign((track.tx[b] - track.tx[a]) * -track.tz[i] + (track.tz[b] - track.tz[a]) * track.tx[i]) || 1;
    track.point(track.s[i], -dentro * afasta, p);
    const x = p.x - origem.x, z = p.z - origem.z;
    if (dist(x, z, 40) < folga || out.some((q) => Math.hypot(q.x - x, q.z - z) < 30)) continue;
    out.push({ x, z, rumo: Math.atan2(track.x[i] - origem.x - x, track.z[i] - origem.z - z) });
  }
  return out;
}

// Marcas do grid: um traço branco transversal na frente de cada lugar (s da frente do kart, d do lado), como o
// grid.js põe os karts: fila a fila atrás da linha, duas colunas.
export function marcasDoGrid(track, linha, { lugares = 20, fila = 4.2, coluna = 1.5, primeira = 6, frente = 1.1 } = {}) {
  const out = [];
  for (let i = 0; i < lugares; i++) {
    const f = Math.floor(i / 2), lado = i % 2 ? 1 : -1;
    out.push({ s: track.wrap(linha - (primeira + f * fila) + frente), d: lado * coluna, i });
  }
  return out;
}

// Distância (m) do ponto local (x, z) ao eixo, com a grade de busca pronta (rápido para centenas de pontos).
export function medidorDeDistancia(track, origem, celula = 20) {
  const grade = new Map(), chave = (a, b) => `${a},${b}`;
  for (let i = 0; i < track.n; i++) {
    const x = track.x[i] - origem.x, z = track.z[i] - origem.z, k = chave(Math.floor(x / celula), Math.floor(z / celula));
    if (!grade.has(k)) grade.set(k, []);
    grade.get(k).push([x, z]);
  }
  return (x, z, raio = 60) => {
    let m = Infinity;
    const cx = Math.floor(x / celula), cz = Math.floor(z / celula), r = Math.ceil(raio / celula);
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        for (const [px, pz] of grade.get(chave(cx + a, cz + b)) || []) m = Math.min(m, Math.hypot(px - x, pz - z));
      }
    }
    return m;
  };
}

// Casco convexo (monotone chain) de pontos [x, z].
export function casco(pontos) {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cruz(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cruz(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}

// Contorno do kartódromo: o casco do eixo afastado `folga` m para fora, com cantos arredondados e pontos a cada
// `passo` m. É por onde passa o alambrado, e de onde as árvores de fora começam.
export function contorno(track, origem, { folga = 42, passo = 3 } = {}) {
  const base = casco(Array.from({ length: track.n }, (_, i) => [track.x[i] - origem.x, track.z[i] - origem.z]));
  // afasta cada aresta e arredonda o canto com arcos
  const out = [], n = base.length;
  for (let i = 0; i < n; i++) {
    const a = base[(i - 1 + n) % n], b = base[i], c = base[(i + 1) % n];
    const n1 = normalFora(a, b), n2 = normalFora(b, c);
    let ang1 = Math.atan2(n1[1], n1[0]), ang2 = Math.atan2(n2[1], n2[0]);
    while (ang2 < ang1) ang2 += Math.PI * 2;
    const k = Math.max(1, Math.ceil(((ang2 - ang1) * folga) / passo));
    for (let j = 0; j <= k; j++) {
      const t = ang1 + ((ang2 - ang1) * j) / k;
      out.push([b[0] + Math.cos(t) * folga, b[1] + Math.sin(t) * folga]);
    }
    // aresta reta até o próximo canto
    const e = [b[0] + n2[0] * folga, b[1] + n2[1] * folga], f = [c[0] + n2[0] * folga, c[1] + n2[1] * folga], L = Math.hypot(f[0] - e[0], f[1] - e[1]);
    for (let j = 1; j < Math.floor(L / passo); j++) out.push([e[0] + ((f[0] - e[0]) * j * passo) / L, e[1] + ((f[1] - e[1]) * j * passo) / L]);
  }
  return out;
}
// normal para fora de uma aresta do casco (o casco sai em sentido anti-horário no plano x, z)
function normalFora(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  return [dz / l, -dx / l];
}

// Ponto dentro de polígono [x, z] (par-ímpar).
export function dentro(poli, x, z) {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, zi] = poli[i], [xj, zj] = poli[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d;
  }
  return d;
}

// Árvores: fora do alambrado, numa faixa de `faixa` m, e algumas no miolo, longe da pista (mais de `livre` m do eixo)
// e fora das `reservas` (retângulos locais [x0, z0, x1, z1] onde fica o prédio, a arquibancada…). Cada uma:
// { x, z, tipo (0 copa redonda, 1 pinheiro), escala, giro, tom }.
export function arvores(track, origem, { semente = 1974, fora = 220, miolo = 40, faixa = 70, livre = 14, reservas = [], cerca = null } = {}) {
  const r = sorteio(semente), dist = medidorDeDistancia(track, origem), linha = cerca || contorno(track, origem);
  const livreDeReserva = (x, z) => reservas.every(([x0, z0, x1, z1]) => x < x0 || x > x1 || z < z0 || z > z1);
  const out = [], [bx0, bz0, bx1, bz1] = track.box, cx = (bx0 + bx1) / 2 - origem.x, cz = (bz0 + bz1) / 2 - origem.z;
  const larg = bx1 - bx0 + 2 * (faixa + 60), alt = bz1 - bz0 + 2 * (faixa + 60);
  const poe = (x, z) => out.push({ x, z, tipo: r() < 0.35 ? 1 : 0, escala: 0.75 + r() * 0.6, giro: r() * Math.PI * 2, tom: r() });
  let tentativas = 0;
  for (let k = 0; k < fora && tentativas < fora * 40; tentativas++) {
    const x = cx + (r() - 0.5) * larg, z = cz + (r() - 0.5) * alt;
    if (dentro(linha, x, z) || !livreDeReserva(x, z)) continue;
    // fica na faixa: perto do alambrado (até `faixa` m dele)
    let perto = Infinity;
    for (const [px, pz] of linha) perto = Math.min(perto, Math.hypot(px - x, pz - z));
    if (perto < 4 || perto > faixa) continue;
    poe(x, z);
    k++;
  }
  tentativas = 0;
  for (let k = 0; k < miolo && tentativas < miolo * 60; tentativas++) {
    const x = cx + (r() - 0.5) * (bx1 - bx0), z = cz + (r() - 0.5) * (bz1 - bz0);
    if (!dentro(linha, x, z) || !livreDeReserva(x, z) || dist(x, z, livre + 20) < livre) continue;
    poe(x, z);
    k++;
  }
  return out;
}

// Pedaço de faixa entre s0 e s1 (m ao longo da volta) e os afastamentos d0 e d1, com `passo` m entre fileiras e uv em
// metros divididos pela escala (para o pátio dos boxes, por exemplo).
// `alt(x, z)` (opcional, local) soma a altura do terreno em cada vértice.
export function faixaTrecho(track, s0, s1, d0, d1, origem, { y = 0, passo = 2, colunas = 1, escala = 4, alt = null } = {}) {
  if (d0 > d1) [d0, d1] = [d1, d0];
  const filas = Math.max(1, Math.ceil((s1 - s0) / passo)), c = colunas + 1, p = {};
  const pos = new Float32Array((filas + 1) * c * 3), uv = new Float32Array((filas + 1) * c * 2), idx = new Uint32Array(filas * colunas * 6);
  for (let i = 0; i <= filas; i++) {
    const s = s0 + ((s1 - s0) * i) / filas;
    for (let j = 0; j < c; j++) {
      const d = d0 + ((d1 - d0) * j) / colunas, k = i * c + j;
      track.point(s, d, p);
      pos.set([p.x - origem.x, y + (alt ? alt(p.x - origem.x, p.z - origem.z) : 0), p.z - origem.z], k * 3);
      uv.set([s / escala, d / escala], k * 2);
    }
  }
  let o = 0;
  for (let i = 0; i < filas; i++) for (let j = 0; j < colunas; j++) { const a = i * c + j, b = (i + 1) * c + j; idx.set([a, a + 1, b, a + 1, b + 1, b], o); o += 6; }
  return { pos, uv, idx };
}
