// RCL-Karts · terreno do Circuito 101 (sem three, testado no Node). O chão em volta acompanha o relevo da pista: a altura
// num ponto qualquer é a média das alturas do eixo com peso 1/d⁶ (perto de um trecho, manda a altura dele; entre dois
// trechos, o chão faz a rampa no meio do caminho, onde fica o muro; longe, vira a média da região). Calculada uma vez numa
// grade e lida por interpolação. Coordenadas LOCAIS (global − origem), como em dados3d.js.

const cache = new WeakMap();

// Grade de alturas em volta da pista (track.box + margem, passo em m). Devolve { alt(x, z), min, max }.
export function terreno(track, origem, { passo = 3, margem = 280 } = {}) {
  const chave = `${origem.x},${origem.z},${passo},${margem}`;
  const ja = cache.get(track);
  if (ja && ja.chave === chave) return ja.t;
  const h = track.h || new Float64Array(track.n);
  const [bx0, bz0, bx1, bz1] = track.box;
  const x0 = bx0 - origem.x - margem, z0 = bz0 - origem.z - margem;
  const nx = Math.ceil((bx1 - bx0 + 2 * margem) / passo) + 1, nz = Math.ceil((bz1 - bz0 + 2 * margem) / passo) + 1;
  const g = new Float32Array(nx * nz);
  // pontos do eixo a cada 2 (4 m) bastam para a média
  const px = [], pz = [], ph = [];
  for (let i = 0; i < track.n; i += 2) { px.push(track.x[i] - origem.x); pz.push(track.z[i] - origem.z); ph.push(h[i]); }
  const m = px.length;
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
      const v = sh / sw;
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
  cache.set(track, { chave, t });
  return t;
}
