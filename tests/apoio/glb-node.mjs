// Lê um GLB no Node com o GLTFLoader, sem as imagens (o Node não decodifica JPEG): para testar geometria.
import fs from 'node:fs';

export function glbSemImagens(caminho) {
  const b = fs.readFileSync(caminho);
  const nj = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + nj).toString('utf8'));
  const resto = b.subarray(20 + nj);
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials || []) {
    const pbr = m.pbrMetallicRoughness || {};
    delete pbr.baseColorTexture; delete pbr.metallicRoughnessTexture;
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
  }
  let j = Buffer.from(JSON.stringify(json), 'utf8');
  j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const cab = Buffer.alloc(12), cj = Buffer.alloc(8);
  cab.writeUInt32LE(0x46546c67, 0); cab.writeUInt32LE(2, 4); cab.writeUInt32LE(12 + 8 + j.length + resto.length, 8);
  cj.writeUInt32LE(j.length, 0); cj.writeUInt32LE(0x4e4f534a, 4);
  const out = Buffer.concat([cab, cj, j, resto]);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
}

export async function carregaNoNode(caminho) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  return new Promise((ok, falha) => new GLTFLoader().parse(glbSemImagens(caminho), '', ok, falha));
}
