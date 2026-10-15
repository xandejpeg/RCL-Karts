// Gera tests/fixtures/kart-contrato.glb: um kart de caixas e cilindros que segue o contrato da arte (mensagem 007), para
// testar o encaixe sem a arte final. Eixos do RCL: metros, +X frente, +Y cima, +Z direita, origem no chão no meio dos eixos.
// Uso: node ferramentas/gera-kart-teste.mjs
import fs from 'node:fs';

const ENTRE_EIXOS = 1.07, BITOLA_F = 1.2, BITOLA_T = 1.24, R_F = 0.13, R_T = 0.14;
export const PONTOS = {
  banco: [-0.25, 0.16, 0],
  volante: { centro: [0.2, 0.52, 0], direcao: [-0.55, 0.835, 0] },
  pedais: { acelerador: [0.72, 0.1, 0.1], freio: [0.72, 0.1, -0.1] },
  raioRodas: { frente: R_F, tras: R_T }
};

// ---- geometria (posições, normais, uvs, índices)
function caixa([sx, sy, sz], [cx, cy, cz] = [0, 0, 0]) {
  const g = { p: [], n: [], uv: [], i: [] };
  const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  const h = [sx / 2, sy / 2, sz / 2];
  for (const [n, u, v] of faces) {
    const b = g.p.length / 3;
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let k = 0; k < 3; k++) g.p.push([cx, cy, cz][k] + (n[k] + u[k] * a + v[k] * c) * h[k]);
      g.n.push(...n);
      g.uv.push((a + 1) / 2, (1 - c) / 2);
    }
    g.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return g;
}
// cilindro com o eixo em Z (eixo da roda), centrado na origem
function cilindro(r, largura, lados = 16) {
  const g = { p: [], n: [], uv: [], i: [] }, w = largura / 2;
  for (let s = 0; s <= lados; s++) {
    const a = (s / lados) * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
    g.p.push(x * r, y * r, -w, x * r, y * r, w); g.n.push(x, y, 0, x, y, 0); g.uv.push(s / lados, 0, s / lados, 1);
  }
  for (let s = 0; s < lados; s++) { const b = s * 2; g.i.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  for (const z of [-w, w]) {
    const c = g.p.length / 3; g.p.push(0, 0, z); g.n.push(0, 0, Math.sign(z)); g.uv.push(0.5, 0.5);
    for (let s = 0; s <= lados; s++) { const a = (s / lados) * Math.PI * 2; g.p.push(Math.cos(a) * r, Math.sin(a) * r, z); g.n.push(0, 0, Math.sign(z)); g.uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2); }
    for (let s = 0; s < lados; s++) z > 0 ? g.i.push(c, c + 1 + s, c + 2 + s) : g.i.push(c, c + 2 + s, c + 1 + s);
  }
  return g;
}
// plano no XY do nó, virado para +Z, uv 0–1 (para o número)
function plano(lx, ly) {
  return { p: [-lx / 2, -ly / 2, 0, lx / 2, -ly / 2, 0, lx / 2, ly / 2, 0, -lx / 2, ly / 2, 0], n: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], uv: [0, 1, 1, 1, 1, 0, 0, 0], i: [0, 1, 2, 0, 2, 3] };
}
function junta(...gs) {
  const g = { p: [], n: [], uv: [], i: [] };
  for (const a of gs) { const b = g.p.length / 3; g.p.push(...a.p); g.n.push(...a.n); g.uv.push(...a.uv); g.i.push(...a.i.map((x) => x + b)); }
  return g;
}
const quatEixo = ([x, y, z], ang) => { const s = Math.sin(ang / 2), l = Math.hypot(x, y, z); return [x / l * s, y / l * s, z / l * s, Math.cos(ang / 2)]; };
// quatérnio que leva +Y para a direção d
function quatDeY(d) {
  const l = Math.hypot(...d), [x, y, z] = d.map((v) => v / l), eixo = [z, 0, -x], ang = Math.acos(Math.max(-1, Math.min(1, y)));
  return Math.hypot(...eixo) < 1e-6 ? [0, 0, 0, 1] : quatEixo(eixo, ang);
}

// ---- glTF
export function geraGlb() {
  const materiais = [['chassi', [0.12, 0.12, 0.13]], ['kart_pintura', [0.95, 0.95, 0.95]], ['pneu', [0.04, 0.04, 0.04]],
    ['banco', [0.07, 0.07, 0.08]], ['motor', [0.45, 0.45, 0.47]], ['numero', [1, 1, 1]], ['volante', [0.1, 0.1, 0.1]]];
  const mat = Object.fromEntries(materiais.map(([n], i) => [n, i]));
  const gltf = {
    asset: { version: '2.0', generator: 'RCL-Karts gera-kart-teste' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [], meshes: [],
    materials: materiais.map(([name, c]) => ({ name, pbrMetallicRoughness: { baseColorFactor: [...c, 1], metallicFactor: 0.1, roughnessFactor: 0.7 } })),
    accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }]
  };
  const bin = [];
  let tamanho = 0;
  const acessor = (arr, tipo, comp, alvo, extra = {}) => {
    const dados = comp === 5125 ? new Uint32Array(arr) : new Float32Array(arr), bytes = Buffer.from(dados.buffer);
    gltf.bufferViews.push({ buffer: 0, byteOffset: tamanho, byteLength: bytes.length, target: alvo });
    bin.push(bytes); tamanho += bytes.length;
    const pad = (4 - (tamanho % 4)) % 4; if (pad) { bin.push(Buffer.alloc(pad)); tamanho += pad; }
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[tipo];
    gltf.accessors.push({ bufferView: gltf.bufferViews.length - 1, componentType: comp, count: arr.length / n, type: tipo, ...extra });
    return gltf.accessors.length - 1;
  };
  const malha = (nome, g, material) => {
    const min = [0, 1, 2].map((k) => Math.min(...g.p.filter((_, i) => i % 3 === k))), max = [0, 1, 2].map((k) => Math.max(...g.p.filter((_, i) => i % 3 === k)));
    gltf.meshes.push({ name: nome, primitives: [{ attributes: { POSITION: acessor(g.p, 'VEC3', 5126, 34962, { min, max }), NORMAL: acessor(g.n, 'VEC3', 5126, 34962), TEXCOORD_0: acessor(g.uv, 'VEC2', 5126, 34962) }, indices: acessor(g.i, 'SCALAR', 5125, 34963), material: mat[material] }] });
    return gltf.meshes.length - 1;
  };
  const no = (def) => { gltf.nodes.push(def); return gltf.nodes.length - 1; };

  const filhos = [];
  filhos.push(no({ name: 'chassi', mesh: malha('chassi', junta(caixa([1.7, 0.04, 0.9], [0, 0.05, 0]), caixa([0.06, 0.04, 1.1], [-0.535, 0.1, 0])), 'chassi') }));
  filhos.push(no({ name: 'carenagem', mesh: malha('carenagem', junta(
    caixa([0.95, 0.2, 0.3], [-0.05, 0.17, -0.58]), caixa([0.95, 0.2, 0.3], [-0.05, 0.17, 0.58]),
    caixa([0.4, 0.16, 0.95], [0.85, 0.16, 0]), caixa([0.14, 0.3, 0.5], [0.42, 0.28, 0]), caixa([0.14, 0.12, 1.35], [-0.95, 0.18, 0])), 'kart_pintura') }));
  filhos.push(no({ name: 'banco', mesh: malha('banco', junta(caixa([0.42, 0.06, 0.4], [-0.25, 0.14, 0]), caixa([0.08, 0.42, 0.4], [-0.47, 0.34, 0])), 'banco') }));
  filhos.push(no({ name: 'motor', mesh: malha('motor', caixa([0.36, 0.38, 0.32], [-0.6, 0.3, 0.42]), 'motor') }));
  for (const [lado, sz] of [['E', -1], ['D', 1]]) {
    const roda = no({ name: `roda_dianteira_${lado}`, mesh: malha(`roda_dianteira_${lado}`, cilindro(R_F, 0.13), 'pneu') });
    filhos.push(no({ name: `esterco_${lado}`, translation: [ENTRE_EIXOS / 2, R_F, sz * BITOLA_F / 2], children: [roda] }));
    filhos.push(no({ name: `roda_traseira_${lado}`, translation: [-ENTRE_EIXOS / 2, R_T, sz * BITOLA_T / 2], mesh: malha(`roda_traseira_${lado}`, cilindro(R_T, 0.2), 'pneu') }));
  }
  const vg = junta(cilindro(0.16, 0.03), caixa([0.04, 0.04, 0.3], [0, 0, -0.15]));
  // o volante tem o eixo da coluna em +Y do nó (o cilindro vem em Z: gira para Y)
  const vgY = { ...vg, p: [], n: [] };
  for (let i = 0; i < vg.p.length; i += 3) { vgY.p.push(vg.p[i], -vg.p[i + 2], vg.p[i + 1]); vgY.n.push(vg.n[i], -vg.n[i + 2], vg.n[i + 1]); }
  filhos.push(no({ name: 'volante', translation: PONTOS.volante.centro, rotation: quatDeY(PONTOS.volante.direcao), mesh: malha('volante', vgY, 'volante') }));
  for (const [nome, t, ang] of [['numero_frente', [1.051, 0.16, 0], Math.PI / 2], ['numero_E', [-0.05, 0.2, -0.731], Math.PI], ['numero_D', [-0.05, 0.2, 0.731], 0]]) {
    filhos.push(no({ name: nome, translation: t, rotation: quatEixo([0, 1, 0], ang), mesh: malha(nome, plano(0.24, 0.14), 'numero') }));
  }
  gltf.nodes.unshift({ name: 'kart', children: [], extras: { kartPontos: PONTOS } });
  // (o unshift desloca os índices: refaz os filhos com +1)
  for (const n of gltf.nodes.slice(1)) if (n.children) n.children = n.children.map((c) => c + 1);
  gltf.nodes[0].children = filhos.map((c) => c + 1);

  const corpo = Buffer.concat(bin);
  gltf.buffers[0].byteLength = corpo.length;
  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const cab = Buffer.alloc(12), cj = Buffer.alloc(8), cb = Buffer.alloc(8);
  cab.writeUInt32LE(0x46546c67, 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(12 + 8 + json.length + 8 + corpo.length, 8);
  cj.writeUInt32LE(json.length, 0); cj.writeUInt32LE(0x4e4f534a, 4);
  cb.writeUInt32LE(corpo.length, 0); cb.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([cab, cj, json, cb, corpo]);
}

// lê o JSON de um GLB (para os testes)
export function leGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('não é GLB');
  const n = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + n).toString('utf8'));
}

// árvore { name, children, userData, material } a partir do JSON do glTF, como o GLTFLoader monta
export function arvore(gltf) {
  const monta = (i) => {
    const d = gltf.nodes[i], m = d.mesh != null ? gltf.meshes[d.mesh].primitives.map((p) => ({ name: gltf.materials[p.material]?.name })) : null;
    return { name: d.name, userData: d.extras || {}, material: m, children: (d.children || []).map(monta) };
  };
  return { name: 'Scene', children: gltf.scenes[gltf.scene ?? 0].nodes.map(monta) };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('ferramentas/gera-kart-teste.mjs')) {
  const destino = new URL('../tests/fixtures/kart-contrato.glb', import.meta.url);
  fs.mkdirSync(new URL('.', destino), { recursive: true });
  const glb = geraGlb();
  fs.writeFileSync(destino, glb);
  console.log(`kart-contrato.glb: ${(glb.length / 1024).toFixed(1)} KB`);
}
