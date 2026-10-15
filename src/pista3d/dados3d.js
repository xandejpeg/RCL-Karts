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
export function faixaColunas(track, d0, d1, origem, { y = 0, colunas = 1, escalaU = 1, escalaV = 1, cor = null } = {}) {
  if (d0 > d1) [d0, d1] = [d1, d0];
  const n = track.n, c = colunas + 1, nv = (n + 1) * c;
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), cores = cor ? new Float32Array(nv * 3) : null;
  const idx = new Uint32Array(n * colunas * 6), p = {};
  for (let i = 0; i <= n; i++) {
    const s = track.s[i];
    for (let j = 0; j < c; j++) {
      const d = d0 + ((d1 - d0) * j) / colunas, k = i * c + j;
      track.point(s, d, p);
      pos.set([p.x - origem.x, y, p.z - origem.z], k * 3);
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

// Zebras com relevo (perfil de lado a lado: sobe 3 cm logo depois da borda do asfalto e cai na beira de fora) e
// listras de 1 m alternando vermelho e branco, com aresta seca entre as cores (vértices próprios por listra).
export const ZEBRA = { perfil: [[0, 0], [0.18, 0.028], [0.82, 0.032], [1, 0.004]], vermelho: [0.74, 0.06, 0.07], branco: [0.92, 0.92, 0.9], listra: 1 };
export function zebras3d(track, origem, { y = 0.02, passosPorListra = 2 } = {}) {
  const hw = track.hw, z = track.zebra || 0, pos = [], cores = [], idx = [], p = {}, { perfil, listra } = ZEBRA;
  if (!z) return { pos: new Float32Array(), cores: new Float32Array(), idx: new Uint32Array() };
  for (let i = 0; i < track.n; i++) {
    const s0 = track.s[i], s1 = track.s[i + 1];
    for (const [lado, tem] of [[-1, track.zL[i]], [1, track.zR[i]]]) {
      if (!tem) continue;
      // listras de 1 m pela posição absoluta s (a cor não muda de trecho para trecho no meio da listra)
      let a = s0;
      while (a < s1 - 1e-6) {
        const b = Math.min(s1, (Math.floor(a / listra + 1e-6) + 1) * listra), cor = Math.floor(a / listra + 1e-6) % 2 ? ZEBRA.branco : ZEBRA.vermelho;
        const base = pos.length / 3, linhas = passosPorListra + 1;
        for (let k = 0; k < linhas; k++) {
          const s = a + ((b - a) * k) / passosPorListra;
          for (const [t, h] of perfil) {
            track.point(s, lado * (hw + t * z), p);
            pos.push(p.x - origem.x, y + h, p.z - origem.z);
            cores.push(...cor);
          }
        }
        const m = perfil.length;
        for (let k = 0; k < passosPorListra; k++) {
          for (let j = 0; j < m - 1; j++) {
            const q = base + k * m + j, r = q + m;
            // face para cima nos dois lados da pista (a ordem troca com o lado)
            if (lado > 0) idx.push(q, q + 1, r, q + 1, r + 1, r); else idx.push(q, r, q + 1, q + 1, r, r + 1);
          }
        }
        a = b;
      }
    }
  }
  return { pos: Float32Array.from(pos), cores: Float32Array.from(cores), idx: Uint32Array.from(idx) };
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
export function faixaTrecho(track, s0, s1, d0, d1, origem, { y = 0, passo = 2, colunas = 1, escala = 4 } = {}) {
  if (d0 > d1) [d0, d1] = [d1, d0];
  const filas = Math.max(1, Math.ceil((s1 - s0) / passo)), c = colunas + 1, p = {};
  const pos = new Float32Array((filas + 1) * c * 3), uv = new Float32Array((filas + 1) * c * 2), idx = new Uint32Array(filas * colunas * 6);
  for (let i = 0; i <= filas; i++) {
    const s = s0 + ((s1 - s0) * i) / filas;
    for (let j = 0; j < c; j++) {
      const d = d0 + ((d1 - d0) * j) / colunas, k = i * c + j;
      track.point(s, d, p);
      pos.set([p.x - origem.x, y, p.z - origem.z], k * 3);
      uv.set([s / escala, d / escala], k * 2);
    }
  }
  let o = 0;
  for (let i = 0; i < filas; i++) for (let j = 0; j < colunas; j++) { const a = i * c + j, b = (i + 1) * c + j; idx.set([a, a + 1, b, a + 1, b + 1, b], o); o += 6; }
  return { pos, uv, idx };
}
