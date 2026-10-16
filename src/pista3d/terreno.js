// RCL-Karts · terreno do Circuito 101 (sem three, testado no Node). O chão em volta acompanha o relevo da pista: perto do
// asfalto (até a borda + 1,5 m) é a altura da pista no ponto mais perto do eixo (sem degrau na borda); mais longe, passa
// aos poucos (8 m) para a média das alturas do eixo com peso 1/d⁶ (entre dois trechos, o chão faz a rampa no meio do
// caminho, onde fica o muro; longe, vira a média da região). Calculado uma vez numa grade de 2 m e lido por interpolação.
// Coordenadas LOCAIS (global − origem), como em dados3d.js.

const cache = new WeakMap();

// Grade de alturas em volta da pista (track.box + margem, passo em m). Devolve { alt(x, z), min, max }.
export function terreno(track, origem, { passo = 2, margem = 280 } = {}) {
  // (um por traçado e origem: a física e o desenho pedem o mesmo terreno; KartTrack novo do mesmo json reaproveita)
  const chave = `${origem.x},${origem.z},${passo},${margem}`, dono = track.json || track;
  const lista = cache.get(dono) || [], ja = lista.find((c) => c.chave === chave);
  if (ja) return ja.t;
  const h = track.h || new Float64Array(track.n), inc = track.inc || new Float64Array(track.n);
  const [bx0, bz0, bx1, bz1] = track.box;
  const x0 = bx0 - origem.x - margem, z0 = bz0 - origem.z - margem;
  const nx = Math.ceil((bx1 - bx0 + 2 * margem) / passo) + 1, nz = Math.ceil((bz1 - bz0 + 2 * margem) / passo) + 1;
  const g = new Float32Array(nx * nz);
  // pontos do eixo a cada 2 (4 m) bastam para a média
  const px = [], pz = [], ph = [];
  for (let i = 0; i < track.n; i += 2) { px.push(track.x[i] - origem.x); pz.push(track.z[i] - origem.z); ph.push(h[i]); }
  const m = px.length, N = track.n, ex = Float64Array.from(track.x, (v) => v - origem.x), ez = Float64Array.from(track.z, (v) => v - origem.z);
  const perto = track.hw + 1.5, faixa = 8;
  // altura da pista no ponto do eixo mais perto (projetando no trecho entre os dois pontos mais perto, com a inclinação
  // lateral da curva inclinada: + afastamento à direita × inclinação) e a distância
  const naPista = (x, z) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < N; i++) { const dx = ex[i] - x, dz = ez[i] - z, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; bi = i; } }
    let melhor = { d: Infinity, h: h[bi] };
    for (const j of [(bi - 1 + N) % N, (bi + 1) % N]) {
      const ax = ex[bi], az = ez[bi], ux = ex[j] - ax, uz = ez[j] - az, L2 = ux * ux + uz * uz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / L2)), px = ax + ux * t, pz = az + uz * t, d = Math.hypot(px - x, pz - z);
      if (d < melhor.d) {
        // lado: + à direita de quem anda (no sentido de bi para bi+1)
        const sx = j === (bi + 1) % N ? ux : -ux, sz = j === (bi + 1) % N ? uz : -uz, L = Math.hypot(sx, sz) || 1;
        const lado = ((x - px) * -sz + (z - pz) * sx) / L, inc0 = inc[bi] + (inc[j] - inc[bi]) * t;
        melhor = { d, h: h[bi] + (h[j] - h[bi]) * t + lado * inc0 };
      }
    }
    return melhor;
  };
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < nz; j++) {
    const z = z0 + j * passo;
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * passo;
      let sw = 0, sh = 0;
      for (let k = 0; k < m; k++) {
        const dx = px[k] - x, dz = pz[k] - z, d2 = dx * dx + dz * dz + 1, w = 1 / (d2 * d2 * d2);
        sw += w; sh += w * ph[k];
      }
      const media = sh / sw, np = naPista(x, z), w = Math.max(0, Math.min(1, (np.d - perto) / faixa)), suave = w * w * (3 - 2 * w);
      const v = np.h + (media - np.h) * suave;
      g[j * nx + i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const alt = (x, z) => {
    const fx = Math.max(0, Math.min(nx - 1.001, (x - x0) / passo)), fz = Math.max(0, Math.min(nz - 1.001, (z - z0) / passo));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, a = j * nx + i;
    return (g[a] * (1 - tx) + g[a + 1] * tx) * (1 - tz) + (g[a + nx] * (1 - tx) + g[a + nx + 1] * tx) * tz;
  };
  const t = { alt, min, max, passo, nx, nz };
  lista.push({ chave, t });
  cache.set(dono, lista);
  return t;
}
