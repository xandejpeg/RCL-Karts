// Desenho do Circuito 101 (three.js): chão, área de escape, asfalto, faixas brancas, zebras, linha de chegada e muros.
import * as T from 'three';
import { faixa, zebras, linhaChegada, muros } from './pista-dados.js';

const CHAO = 0x2c4022, ESCAPE = 0x8a7b62, ASFALTO = 0x2a2b2e, FAIXA = 0xe9e9e9, JERSEY = 0xb8b8b4;

function malha(pos, idx, cor, y = 0, opts = {}) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  if (idx) g.setIndex(new T.BufferAttribute(idx, 1));
  if (opts.cores) g.setAttribute('color', new T.BufferAttribute(opts.cores, 3));
  const normais = new Float32Array(pos.length);
  for (let i = 1; i < normais.length; i += 3) normais[i] = 1;
  g.setAttribute('normal', new T.BufferAttribute(normais, 3));
  const m = new T.MeshStandardMaterial({
    color: opts.cores ? 0xffffff : cor, vertexColors: !!opts.cores, roughness: opts.rough ?? 0.92, metalness: 0,
    side: T.FrontSide, polygonOffset: true, polygonOffsetFactor: -y * 40, polygonOffsetUnits: -y * 40
  });
  const mesh = new T.Mesh(g, m);
  mesh.receiveShadow = true;
  return mesh;
}

export function montaPista(scene, track, origem) {
  const grupo = new T.Group();
  grupo.name = 'RCL-Karts:pista';
  const hw = track.hw, z = track.zebra || 0;

  const [x0, z0, x1, z1] = track.box;
  const chao = new T.Mesh(
    new T.PlaneGeometry(x1 - x0 + 400, z1 - z0 + 300),
    new T.MeshStandardMaterial({ color: CHAO, roughness: 1, metalness: 0 })
  );
  chao.rotation.x = -Math.PI / 2;
  chao.position.set(track.center.x - origem.x, -0.02, track.center.z - origem.z);
  chao.receiveShadow = true;
  grupo.add(chao);

  // escape (areia, como o piso de fora no traffic-kart.js), depois asfalto e faixas por cima
  for (const lado of [-1, 1]) {
    const e = faixa(track, lado * (hw + z), lado * (hw + z + 3), origem, 0.005);
    grupo.add(malha(e.pos, e.idx, ESCAPE, 0.005));
  }
  const a = faixa(track, -hw, hw, origem, 0.02);
  grupo.add(malha(a.pos, a.idx, ASFALTO, 0.02, { rough: 0.85 }));
  for (const lado of [-1, 1]) {
    const f = faixa(track, lado * (hw - 0.12), lado * hw, origem, 0.03);
    grupo.add(malha(f.pos, f.idx, FAIXA, 0.03, { rough: 0.6 }));
  }
  const zb = zebras(track, origem, 0.03);
  if (zb.pos.length) grupo.add(malha(zb.pos, null, 0xffffff, 0.03, { cores: zb.cor, rough: 0.7 }));
  const lc = linhaChegada(track, origem, 0.035);
  grupo.add(malha(lc.pos, null, 0xffffff, 0.035, { cores: lc.cor, rough: 0.6 }));

  // muros: pilhas de três pneus (um cilindro por pilha) e o Jersey de concreto
  const { pilhas, jersey } = muros(track, origem);
  if (pilhas.length) {
    const g = new T.CylinderGeometry(0.29, 0.29, 0.66, 12);
    const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    const inst = new T.InstancedMesh(g, m, pilhas.length);
    const M = new T.Matrix4(), c = new T.Color();
    pilhas.forEach((p, i) => {
      M.makeTranslation(p.x, 0.33, p.z);
      inst.setMatrixAt(i, M);
      inst.setColorAt(i, c.setHex(p.vermelho ? 0xc8202a : 0xe8e8e8));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.name = 'RCL-Karts:pneus';
    grupo.add(inst);
  }
  for (const j of jersey) {
    const L = Math.hypot(j.bx - j.ax, j.bz - j.az);
    const b = new T.Mesh(new T.BoxGeometry(j.r * 2, 0.8, L), new T.MeshStandardMaterial({ color: JERSEY, roughness: 0.95 }));
    b.position.set((j.ax + j.bx) / 2, 0.4, (j.az + j.bz) / 2);
    b.rotation.y = Math.atan2(j.bx - j.ax, j.bz - j.az);
    b.castShadow = b.receiveShadow = true;
    grupo.add(b);
  }

  scene.add(grupo);
  return grupo;
}
