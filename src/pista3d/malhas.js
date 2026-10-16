// Peças em 3D da pista (three.js): malha a partir de arrays, pilha de três pneus, Jersey, árvores e alambrado.
// Tudo pensado para instanciar (uma chamada de desenho por tipo de peça).
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Malha de chão (normal para cima) a partir de { pos, idx, uv?, cores? }.
export function malhaChao({ pos, idx, uv = null, cores = null }, material, { sombra = true } = {}) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  if (cores) g.setAttribute('color', new T.BufferAttribute(cores, 3));
  if (idx && idx.length) g.setIndex(new T.BufferAttribute(idx, 1));
  const n = new Float32Array(pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new T.BufferAttribute(n, 3));
  g.computeBoundingSphere();
  const m = new T.Mesh(g, material);
  m.receiveShadow = sombra;
  return m;
}

// Malha com relevo (zebra): normais calculadas pela forma.
export function malhaRelevo({ pos, idx, cores = null }, material) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  if (cores) g.setAttribute('color', new T.BufferAttribute(cores, 3));
  g.setIndex(new T.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const m = new T.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

// Pilha de três pneus deitados (0,58 m de diâmetro, 0,22 m cada), com o sulco entre um e outro e o furo em cima.
export const PILHA = { raio: 0.29, altura: 0.66 };
export function geometriaPilha(lados = 10) {
  const R = PILHA.raio, r = 0.17, pts = [[0.27, 0], [R, 0.02]];
  for (let k = 0; k < 3; k++) {
    const y = k * 0.22;
    pts.push([R, y + 0.2]);
    if (k < 2) pts.push([0.25, y + 0.22], [R, y + 0.24]);
  }
  pts.push([0.27, 0.66], [r, 0.66], [r, 0.58]);
  return new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), lados);
}

// Jersey (perfil New Jersey, 0,81 m de altura e 0,6 m de base) ao longo de L metros, centrado na origem, no eixo Z.
export function geometriaJersey(L) {
  const perfil = [[0.3, 0], [0.3, 0.075], [0.23, 0.33], [0.075, 0.81], [-0.075, 0.81], [-0.23, 0.33], [-0.3, 0.075], [-0.3, 0]];
  const forma = new T.Shape(perfil.map(([x, y]) => new T.Vector2(x, y)));
  const g = new T.ExtrudeGeometry(forma, { depth: L, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -L / 2);
  // uv em metros: u ao longo do muro, v na altura (a textura de concreto repete a cada 2 m)
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getZ(i) + p.getX(i)) / 2, p.getY(i) / 2);
  return g;
}

// Árvores: copa redonda (folhosa) ou pinheiro, com cor por vértice (tronco marrom, folhas variando).
function pinta(g, cor, variacao, r) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = 1 + (r() - 0.5) * variacao;
    c.set([cor[0] * v, cor[1] * v, cor[2] * v], i * 3);
  }
  g.setAttribute('color', new T.BufferAttribute(c, 3));
  return g;
}
export function geometriaArvore(tipo, r) {
  const tronco = pinta(new T.CylinderGeometry(0.14, 0.22, tipo ? 3 : 3.4, 6, 1).translate(0, tipo ? 1.5 : 1.7, 0), [0.32, 0.22, 0.14], 0.2, r);
  const partes = [tronco];
  if (tipo === 0) {
    for (const [x, y, z, s] of [[0, 4.6, 0, 2.5], [1.1, 4.0, 0.5, 1.7], [-0.9, 4.2, -0.6, 1.8], [0.2, 5.6, -0.3, 1.6]]) {
      partes.push(pinta(new T.IcosahedronGeometry(s, 1).scale(1, 0.85, 1).translate(x, y, z), [0.2, 0.36, 0.14], 0.35, r));
    }
  } else {
    for (const [y, raio, alt] of [[2.4, 2.1, 3.2], [4.0, 1.6, 2.8], [5.4, 1.05, 2.4]]) {
      partes.push(pinta(new T.ConeGeometry(raio, alt, 8, 1).translate(0, y + alt / 2, 0), [0.13, 0.28, 0.14], 0.3, r));
    }
  }
  const g = mergeGeometries(partes.map((p) => (p.index ? p.toNonIndexed() : p)));
  g.computeVertexNormals();
  return g;
}

// Alambrado ao longo de uma linha fechada [x, z]: tela (textura com transparência) e postes. Devolve { tela, postes }.
// `alt(x, z)` dá o chão (relevo); os postes saem como [x, z, y].
export function geometriaAlambrado(linha, { altura = 2.4, passoPoste = 3, alt = () => 0 } = {}) {
  const pos = [], uv = [], idx = [];
  let acum = 0;
  const n = linha.length;
  for (let i = 0; i <= n; i++) {
    const [x, z] = linha[i % n];
    if (i > 0) { const [px, pz] = linha[(i - 1) % n]; acum += Math.hypot(x - px, z - pz); }
    const y0 = alt(x, z);
    pos.push(x, y0 + 0.05, z, x, y0 + altura, z);
    uv.push(acum / 0.5, 0, acum / 0.5, altura / 0.5);
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const tela = new T.BufferGeometry();
  tela.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  tela.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  tela.setIndex(idx);
  tela.computeVertexNormals();
  // postes a cada `passoPoste` m de linha
  const postes = [];
  let falta = 0;
  for (let i = 0; i < n; i++) {
    const [ax, az] = linha[i], [bx, bz] = linha[(i + 1) % n], L = Math.hypot(bx - ax, bz - az);
    let t = falta;
    while (t < L) { const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L; postes.push([x, z, alt(x, z)]); t += passoPoste; }
    falta = t - L;
  }
  return { tela, postes };
}
