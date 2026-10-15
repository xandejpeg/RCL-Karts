// RCL-Karts · ferramentas de geometria para modelar o kart em código (three.js): varrer um perfil ao longo de um
// caminho (tubos, para-choque, banco), caixa arredondada, torneado (rodas), posicionar e juntar peças numa malha só por
// material (cada material vira uma InstancedMesh no desenho, e o kart inteiro sai em poucas chamadas de desenho).
// Só posição e normal nas peças juntadas; quem precisa de UV (placas de número) fica separado.
import * as T from 'three';

const _v = new T.Vector3();

// só posição e normal, sempre com índice
function limpa(g) {
  const out = new T.BufferGeometry();
  out.setAttribute('position', g.getAttribute('position'));
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  out.setAttribute('normal', g.getAttribute('normal'));
  if (g.index) out.setIndex(g.index);
  else out.setIndex([...Array(g.getAttribute('position').count).keys()]);
  return out;
}

// junta várias geometrias numa só (posição, normal, índice)
export function junta(lista) {
  const gs = lista.filter(Boolean).map(limpa);
  let nv = 0, ni = 0;
  for (const g of gs) { nv += g.getAttribute('position').count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of gs) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal'), I = g.index;
    for (let i = 0; i < p.count; i++) {
      pos[(ov + i) * 3] = p.getX(i); pos[(ov + i) * 3 + 1] = p.getY(i); pos[(ov + i) * 3 + 2] = p.getZ(i);
      nor[(ov + i) * 3] = n.getX(i); nor[(ov + i) * 3 + 1] = n.getY(i); nor[(ov + i) * 3 + 2] = n.getZ(i);
    }
    for (let i = 0; i < I.count; i++) idx[oi + i] = I.getX(i) + ov;
    ov += p.count; oi += I.count;
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(pos, 3));
  out.setAttribute('normal', new T.BufferAttribute(nor, 3));
  out.setIndex(new T.BufferAttribute(nv > 65535 ? idx : Uint16Array.from(idx), 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

// posiciona: escala, gira (Euler XYZ, rad) e move
export function poe(g, { pos = [0, 0, 0], rot = [0, 0, 0], esc = [1, 1, 1], ordem = 'XYZ' } = {}) {
  const M = new T.Matrix4().compose(new T.Vector3(...pos), new T.Quaternion().setFromEuler(new T.Euler(...rot, ordem)), new T.Vector3(...esc));
  g.applyMatrix4(M);
  return g;
}

// gira a geometria para o eixo +Y dela apontar para dir (vetor) e põe em pos
export function aponta(g, dir, pos = [0, 0, 0]) {
  const d = new T.Vector3(...dir).normalize();
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d);
  g.applyQuaternion(q);
  g.translate(...pos);
  return g;
}

// cilindro de a até b (raio r; raio2 no fim, se der)
export function barra(a, b, r, { seg = 10, r2 = r, tampa = true } = {}) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b), L = A.distanceTo(B);
  const g = new T.CylinderGeometry(r2, r, L, seg, 1, !tampa);
  g.translate(0, L / 2, 0);
  return aponta(g, B.clone().sub(A).toArray(), a);
}

// caixa com cantos arredondados (raio r): caixa subdividida com cada vértice puxado para a casca arredondada
export function caixaArredondada(w, h, d, r, seg = 2) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const n = seg * 2 + 1, g = new T.BoxGeometry(w, h, d, n, n, n), p = g.getAttribute('position');
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, c = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, _v.x)), Math.max(-hy, Math.min(hy, _v.y)), Math.max(-hz, Math.min(hz, _v.z)));
    const e = _v.clone().sub(c);
    if (e.lengthSq() > 1e-12) e.setLength(r);
    p.setXYZ(i, c.x + e.x, c.y + e.y, c.z + e.z);
  }
  g.deleteAttribute('uv');
  return soldaNormais(g);
}

// junta vértices na mesma posição (a BoxGeometry repete os das quinas) para as normais saírem lisas
export function soldaNormais(g, tol = 1e-5) {
  const p = g.getAttribute('position'), mapa = new Map(), novo = [], remap = new Uint32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) / tol)},${Math.round(p.getY(i) / tol)},${Math.round(p.getZ(i) / tol)}`;
    let j = mapa.get(k);
    if (j == null) { j = novo.length / 3; mapa.set(k, j); novo.push(p.getX(i), p.getY(i), p.getZ(i)); }
    remap[i] = j;
  }
  const I = g.index ? Array.from(g.index.array, (i) => remap[i]) : Array.from(remap);
  const idx = [];
  for (let t = 0; t < I.length; t += 3) if (I[t] !== I[t + 1] && I[t + 1] !== I[t + 2] && I[t] !== I[t + 2]) idx.push(I[t], I[t + 1], I[t + 2]);
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(novo, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

// varre o perfil 2D [[u, v], ...] ao longo do caminho [[x, y, z], ...]. Quadro em cada ponto: tangente t; com
// `binormal` fixo (caminho num plano), n = b × t; senão n = a direção de `cima` tirada a parte da tangente. O perfil vai
// em u ao longo de b e v ao longo de n. escala(i, total) pode engrossar ou afinar o perfil ao longo do caminho.
export function varre(caminho, perfil, { fechado = false, perfilFechado = true, cima = [0, 1, 0], binormal = null, tampas = true, escala = null } = {}) {
  const P = caminho.map((p) => new T.Vector3(...p)), np = P.length, nf = perfil.length;
  const up = new T.Vector3(...cima), bFix = binormal ? new T.Vector3(...binormal).normalize() : null;
  const pos = [];
  for (let i = 0; i < np; i++) {
    const a = P[fechado ? (i - 1 + np) % np : Math.max(0, i - 1)], b = P[fechado ? (i + 1) % np : Math.min(np - 1, i + 1)];
    const t = b.clone().sub(a).normalize();
    let n, bb;
    if (bFix) { bb = bFix.clone(); n = new T.Vector3().crossVectors(bb, t).normalize(); }
    else { n = up.clone().sub(t.clone().multiplyScalar(up.dot(t))).normalize(); bb = new T.Vector3().crossVectors(t, n).normalize(); }
    const s = escala ? escala(i, np) : 1, su = Array.isArray(s) ? s[0] : s, sv = Array.isArray(s) ? s[1] : s;
    for (const [u, v] of perfil) pos.push(P[i].x + bb.x * u * su + n.x * v * sv, P[i].y + bb.y * u * su + n.y * v * sv, P[i].z + bb.z * u * su + n.z * v * sv);
  }
  const idx = [], segs = fechado ? np : np - 1, fs = perfilFechado ? nf : nf - 1;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % np;
    for (let j = 0; j < fs; j++) {
      const j2 = (j + 1) % nf, a = i * nf + j, b = i2 * nf + j, c = i2 * nf + j2, d = i * nf + j2;
      idx.push(a, d, b, b, d, c);
    }
  }
  if (tampas && !fechado && perfilFechado) {
    for (const [i, sg] of [[0, -1], [np - 1, 1]]) {
      const c = pos.length / 3;
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < nf; j++) { cx += pos[(i * nf + j) * 3]; cy += pos[(i * nf + j) * 3 + 1]; cz += pos[(i * nf + j) * 3 + 2]; }
      pos.push(cx / nf, cy / nf, cz / nf);
      for (let j = 0; j < nf; j++) { const a = i * nf + j, b = i * nf + (j + 1) % nf; if (sg > 0) idx.push(c, a, b); else idx.push(c, b, a); }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// perfis 2D
export function circulo(r, n = 10) { return Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)]); }
export function retArredondado(w, h, r, nc = 3) {
  const out = [], hw = w / 2 - r, hh = h / 2 - r;
  for (const [cx, cy, a0] of [[hw, hh, 0], [-hw, hh, Math.PI / 2], [-hw, -hh, Math.PI], [hw, -hh, 1.5 * Math.PI]])
    for (let k = 0; k <= nc; k++) { const a = a0 + (k / nc) * (Math.PI / 2); out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}

// retângulo de cantos arredondados no plano xz (caminho fechado, sentido anti-horário visto de cima)
export function caminhoRet(x0, x1, z0, z1, rFrente, rTras, y, n = 8) {
  const out = [], arco = (cx, cz, r, a0) => { for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (Math.PI / 2); out.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]); } };
  arco(x1 - rFrente, z1 - rFrente, rFrente, 0);
  arco(x0 + rFrente, z1 - rFrente, rFrente, Math.PI / 2);
  arco(x0 + rTras, z0 + rTras, rTras, Math.PI);
  arco(x1 - rTras, z0 + rTras, rTras, 1.5 * Math.PI);
  return out;
}

// torneado em volta do eixo X (rodas): perfil [[raio, x], ...]
export function torneadoX(perfil, seg = 24) {
  const g = new T.LatheGeometry(perfil.map(([r, x]) => new T.Vector2(r, x)), seg);
  g.rotateZ(-Math.PI / 2);
  g.deleteAttribute('uv');
  return g;
}

export function triangulos(g) { return (g.index ? g.index.count : g.getAttribute('position').count) / 3; }
