// Níveis de detalhe do kart do Meshy (mensagem 017), feitos no carregamento a partir do próprio GLB, sem mexer na arte:
// - junta as peças fixas (chassi, banco, motor, carenagem) por material: uma malha por material no lugar de quatro;
// - "meio": as mesmas peças simplificadas sem atravessar as costuras de UV (a textura continua certa). A textura do Meshy
//   tem muitas ilhas pequenas, então o meio para em ~45% dos triângulos;
// - "longe": o kart inteiro parado (peças fixas + as quatro rodas) num punhado de triângulos, sem sombra. Aqui o
//   simplificador atravessa as costuras, então a textura sai: cada vértice leva a cor da textura no seu UV (cor por
//   vértice, material sem mapas). Não embaralha; só suaviza, o que a 35 m não aparece;
// - os três planos dos números viram uma malha só.
// Simplificação: meshoptimizer (o mesmo do gltfpack), em wasm, no quadro do nó `kart`.
import * as T from 'three';
import { MeshoptSimplifier } from '../vendor/meshoptimizer/meshopt_simplifier.js';
import { achaNos, NOS } from './kart-contrato.js';

export const ESTATICOS = [...NOS.fixos, NOS.carenagem];
// distâncias (m) da câmera em que o kart passa para o meio e para o longe; folga para não piscar na divisa.
// triangulos: alvo das peças fixas (o meio para antes, se as costuras de UV não deixarem)
export const NIVEIS = { meio: { distancia: 14, triangulos: 7000 }, longe: { distancia: 35, triangulos: 2400 }, folga: 1.5 };

// malhas de um nó (ele e os filhos)
function malhasDe(no) {
  const out = [];
  no?.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
}

// uma malha em arrays float (posição, normal, uv, índices), levada para o quadro de `referencia`
export function lePeca(malha, referencia) {
  const g = malha.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, n = P.count;
  const M = new T.Matrix4().copy(referencia.matrixWorld).invert().multiply(malha.matrixWorld), Mn = new T.Matrix3().getNormalMatrix(M);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), v = new T.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(P, i).applyMatrix4(M);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    if (N) v.fromBufferAttribute(N, i).applyMatrix3(Mn).normalize(); else v.set(0, 1, 0);
    nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z;
    if (U) { uv[i * 2] = U.getX(i); uv[i * 2 + 1] = U.getY(i); }
  }
  const idx = g.index ? Uint32Array.from({ length: g.index.count }, (_, i) => g.index.getX(i)) : Uint32Array.from({ length: n }, (_, i) => i);
  return { pos, nor, uv, idx };
}

export function junta(pecas) {
  const nv = pecas.reduce((a, p) => a + p.pos.length / 3, 0), ni = pecas.reduce((a, p) => a + p.idx.length, 0);
  const out = { pos: new Float32Array(nv * 3), nor: new Float32Array(nv * 3), uv: new Float32Array(nv * 2), idx: new Uint32Array(ni) };
  let v = 0, i = 0;
  for (const p of pecas) {
    out.pos.set(p.pos, v * 3); out.nor.set(p.nor, v * 3); out.uv.set(p.uv, v * 2);
    for (let k = 0; k < p.idx.length; k++) out.idx[i + k] = p.idx[k] + v;
    v += p.pos.length / 3; i += p.idx.length;
  }
  return out;
}

// tira os vértices que nenhum triângulo usa
function compacta(p, idx) {
  const mapa = new Int32Array(p.pos.length / 3).fill(-1);
  let n = 0;
  const novo = new Uint32Array(idx.length);
  for (let k = 0; k < idx.length; k++) { const a = idx[k]; if (mapa[a] < 0) mapa[a] = n++; novo[k] = mapa[a]; }
  const out = { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), uv: new Float32Array(n * 2), idx: novo };
  for (let a = 0; a < mapa.length; a++) {
    const b = mapa[a];
    if (b < 0) continue;
    out.pos.set(p.pos.subarray(a * 3, a * 3 + 3), b * 3); out.nor.set(p.nor.subarray(a * 3, a * 3 + 3), b * 3); out.uv.set(p.uv.subarray(a * 2, a * 2 + 2), b * 2);
  }
  return out;
}

// Simplifica até `triangulos`. Com `costuras` (o padrão), não atravessa as costuras de UV: a textura continua certa, mas
// pode parar antes do alvo. Sem costuras (longe), atravessa e, se ainda não chegar, completa com a versão "sloppy".
// Precisa de `await MeshoptSimplifier.ready` antes (ver preparaLod).
export function simplifica(p, triangulos, { costuras = true } = {}) {
  const alvo = Math.max(3, Math.floor(triangulos) * 3);
  if (p.idx.length <= alvo) return compacta(p, p.idx);
  let [idx] = MeshoptSimplifier.simplify(p.idx, p.pos, 3, alvo, 1, costuras ? [] : ['Permissive']);
  if (!costuras && idx.length > alvo * 1.2) [idx] = MeshoptSimplifier.simplifySloppy(idx, p.pos, 3, null, alvo, 1);
  return compacta(p, idx);
}

// Pixels de uma textura (navegador: desenha a imagem num canvas). No Node, ou sem imagem, null.
export function lePixels(textura) {
  const img = textura?.image;
  if (!img?.width || !img?.height || (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined')) return null;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(img.width, img.height) : Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data, flipY: !!textura.flipY };
}

// cor de cada vértice = a textura no UV dele (sRGB → linear); sem pixels, branco
export function corPorVertice(p, pixels) {
  const n = p.pos.length / 3, cor = new Float32Array(n * 3).fill(1), c = new T.Color();
  if (!pixels) return cor;
  const { w, h, d, flipY } = pixels;
  for (let i = 0; i < n; i++) {
    const u = p.uv[i * 2] - Math.floor(p.uv[i * 2]), v = p.uv[i * 2 + 1] - Math.floor(p.uv[i * 2 + 1]);
    const x = Math.min(w - 1, Math.floor(u * w)), y = Math.min(h - 1, Math.floor((flipY ? 1 - v : v) * h)), k = (y * w + x) * 4;
    c.setRGB(d[k] / 255, d[k + 1] / 255, d[k + 2] / 255, T.SRGBColorSpace);
    cor[i * 3] = c.r; cor[i * 3 + 1] = c.g; cor[i * 3 + 2] = c.b;
  }
  return cor;
}

// material do longe: as mesmas cores e acabamento, sem mapas, com cor por vértice
export function materialLonge(m) {
  return new T.MeshStandardMaterial({
    name: m?.name ?? '', color: m?.color?.clone() ?? new T.Color(1, 1, 1), roughness: m?.roughness ?? 0.8,
    metalness: m?.metalness ?? 0, vertexColors: true
  });
}

export function geometria(p, cor = null) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(p.pos, 3));
  g.setAttribute('normal', new T.BufferAttribute(p.nor, 3));
  g.setAttribute('uv', new T.BufferAttribute(p.uv, 2));
  if (cor) g.setAttribute('color', new T.BufferAttribute(cor, 3));
  g.setIndex(new T.BufferAttribute(p.pos.length / 3 > 65535 ? p.idx : Uint16Array.from(p.idx), 1));
  g.computeBoundingSphere();
  return g;
}

export const triangulos = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;

// agrupa as malhas de uma lista de nós por material (nome)
function porMaterial(nos, kart) {
  const grupos = new Map();
  for (const no of nos) for (const m of malhasDe(no)) {
    const mat = Array.isArray(m.material) ? m.material[0] : m.material, chave = mat?.name ?? '';
    if (!grupos.has(chave)) grupos.set(chave, { material: mat, pecas: [] });
    grupos.get(chave).pecas.push(lePeca(m, kart));
  }
  return grupos;
}

// Prepara os níveis a partir da cena do GLB (quadro do nó kart). Devolve as geometrias prontas (divididas entre os karts):
// estaticos: [{ material, perto, meio, longe, materialLonge }] (longe inclui as rodas do mesmo material), longeRodas:
// [{ material, longe }] (rodas de material que nenhuma peça fixa usa; material já sem mapas) e numeros (os três planos).
export async function preparaLod(cena, niveis = NIVEIS) {
  await MeshoptSimplifier.ready;
  cena.updateMatrixWorld(true);
  const nos = achaNos(cena), kart = nos[NOS.raiz];
  const fixos = porMaterial(ESTATICOS.map((n) => nos[n]).filter(Boolean), kart);
  const rodas = porMaterial([...NOS.rodasFrente, ...NOS.rodasTras].map((n) => nos[n]).filter(Boolean), kart);
  const tri = (p) => p.idx.length / 3;
  const juntos = new Map([...fixos].map(([k, g]) => [k, { material: g.material, tudo: junta(g.pecas) }]));
  const totalFixo = [...juntos.values()].reduce((a, g) => a + tri(g.tudo), 0);
  const longes = new Map([...juntos].map(([k, g]) => [k, { material: g.material, pecas: [g.tudo] }]));
  for (const [k, g] of rodas) {
    if (!longes.has(k)) longes.set(k, { material: g.material, pecas: [] });
    longes.get(k).pecas.push(...g.pecas);
  }
  const longesJuntos = [...longes].map(([k, g]) => [k, { material: g.material, tudo: junta(g.pecas) }]);
  const totalLonge = longesJuntos.reduce((a, [, g]) => a + tri(g.tudo), 0);
  const parte = (p, total, orcamento) => Math.max(60, (orcamento * tri(p)) / total);
  const estaticos = [...juntos].map(([k, g]) => ({
    nome: k, material: g.material,
    perto: geometria(g.tudo),
    meio: geometria(simplifica(g.tudo, parte(g.tudo, totalFixo, niveis.meio.triangulos))),
    longe: null, materialLonge: null
  }));
  const longeRodas = [];
  for (const [k, g] of longesJuntos) {
    const p = simplifica(g.tudo, parte(g.tudo, totalLonge, niveis.longe.triangulos), { costuras: false });
    const geo = geometria(p, corPorVertice(p, lePixels(g.material?.map))), mat = materialLonge(g.material);
    const e = estaticos.find((x) => x.nome === k);
    if (e) { e.longe = geo; e.materialLonge = mat; } else longeRodas.push({ nome: k, material: mat, longe: geo });
  }
  const pn = NOS.numeros.flatMap((n) => malhasDe(nos[n])).map((m) => lePeca(m, kart));
  const numeros = pn.length ? geometria(junta(pn)) : null;
  const soma = (lista, nivel) => lista.reduce((a, e) => a + (e[nivel] ? triangulos(e[nivel]) : 0), 0);
  const rodasTri = [...rodas.values()].reduce((a, g) => a + g.pecas.reduce((b, p) => b + tri(p), 0), 0);
  const volanteTri = malhasDe(nos[NOS.volante]).reduce((a, m) => a + triangulos(m.geometry), 0);
  return {
    estaticos, longeRodas, numeros,
    triangulos: {
      perto: soma(estaticos, 'perto') + rodasTri + volanteTri,
      meio: soma(estaticos, 'meio') + rodasTri + volanteTri,
      longe: soma(estaticos, 'longe') + soma(longeRodas, 'longe')
    }
  };
}
