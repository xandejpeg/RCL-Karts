// Desenho do Circuito 101 (three.js), do chat RCL-Karts: grama com faixas de corte, área de escape de areia, asfalto
// com textura e borracha escurecendo a linha de corrida, faixas brancas, zebras com relevo, linha de chegada, marcas do
// grid, muros de pneus (pilhas de três, vermelhas e brancas), o Jersey, o alambrado em volta e as árvores.
// Só desenho: a física continua no traffic-kart.js. Assinatura de sempre: montaPista(scene, track, origem).
import * as T from 'three';
import { racingLine } from '../vendor/rcl-transito/traffic-kart.js';
import { faixa, linhaChegada, muros } from './pista-dados.js';
import { faixaColunas, brilhoDoAsfalto, zebras3d, marcasDoGrid, contorno, arvores, sorteio } from './pista3d/dados3d.js';
import { malhaChao, malhaRelevo, geometriaPilha, geometriaJersey, geometriaArvore, geometriaAlambrado } from './pista3d/malhas.js';
import * as TX from './pista3d/texturas.js';
import { GRID } from './grid.js';

const FAIXA = 0xe9e9e9, PNEU_VERMELHO = 0xc41e24, PNEU_BRANCO = 0xe6e6e2;

// material de chão com deslocamento de profundidade por camada (sem briga de z entre faixas sobrepostas)
function matChao(camada, opts) {
  return new T.MeshStandardMaterial({ roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -camada, polygonOffsetUnits: -camada * 4, ...opts });
}

// Reservas do cenário (onde ficam boxes, torre e arquibancada): retângulo local em volta da reta, do lado dos boxes.
export function reservaDosBoxes(track, origem) {
  const linha = track.wrap(track.json?.cronometro?.s ?? 0), pts = [];
  for (let ds = -110; ds <= 70; ds += 10) for (const d of [-6, -50]) { const p = track.point(linha + ds, d, {}); pts.push([p.x - origem.x, p.z - origem.z]); }
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
}

export function montaPista(scene, track, origem) {
  const grupo = new T.Group();
  grupo.name = 'RCL-Karts:pista';
  const hw = track.hw, z = track.zebra || 0, linha = track.wrap(track.json?.cronometro?.s ?? 0);
  const [x0, z0, x1, z1] = track.box, cx = (x0 + x1) / 2 - origem.x, cz = (z0 + z1) / 2 - origem.z;

  // grama: um chão grande com a textura repetindo a cada 7 m e faixas de corte de 6 m (cor por vértice)
  {
    const L = x1 - x0 + 900, A = z1 - z0 + 700, g = new T.PlaneGeometry(L, A, Math.round(L / 6), Math.round(A / 6));
    g.rotateX(-Math.PI / 2);
    g.translate(cx, -0.02, cz);
    const p = g.attributes.position, uv = g.attributes.uv, cores = new Float32Array(p.count * 3), r = sorteio(9);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), zz = p.getZ(i);
      uv.setXY(i, x / 7, zz / 7);
      const faixaCorte = Math.floor((x * 0.8 + zz * 0.6) / 6) % 2 ? 1.06 : 0.94, longe = Math.min(1, Math.hypot(x - cx, zz - cz) / 450);
      const v = faixaCorte * (1 - longe * 0.18) * (0.96 + r() * 0.08);
      cores.set([v, v, v * (1 - longe * 0.1)], i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(cores, 3));
    const chao = new T.Mesh(g, new T.MeshStandardMaterial({ map: TX.grama(), vertexColors: true, roughness: 1, metalness: 0 }));
    chao.receiveShadow = true;
    chao.name = 'RCL-Karts:grama';
    grupo.add(chao);
  }

  // área de escape (areia), dos dois lados
  const matAreia = matChao(1, { map: TX.areia(), roughness: 1 });
  for (const lado of [-1, 1]) {
    grupo.add(malhaChao(faixaColunas(track, lado * (hw + z), lado * (hw + z + 3), origem, { y: 0.005, escalaU: 4, escalaV: 4 }), matAreia));
  }

  // asfalto: textura de brita (repete a cada 5 m) e a borracha da linha de corrida na cor por vértice
  const lc = racingLine(track);
  const asf = faixaColunas(track, -hw, hw, origem, {
    y: 0.02, colunas: 16, escalaU: 5, escalaV: 5,
    cor: (s, d, i) => { const b = brilhoDoAsfalto(d, lc.d[i], hw); return [b, b, b]; }
  });
  const asfalto = malhaChao(asf, matChao(2, { map: TX.asfalto(), vertexColors: true, roughness: 0.88 }));
  asfalto.name = 'RCL-Karts:asfalto';
  grupo.add(asfalto);

  // faixas brancas nas bordas
  const matFaixa = matChao(3, { color: FAIXA, roughness: 0.6 });
  for (const lado of [-1, 1]) {
    const f = faixa(track, lado * (hw - 0.12), lado * hw, origem, 0.03);
    grupo.add(malhaChao(f, matFaixa));
  }

  // zebras com relevo e listras de 1 m
  const zb = zebras3d(track, origem, { y: 0.02 });
  if (zb.pos.length) {
    const m = malhaRelevo(zb, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12 }));
    m.name = 'RCL-Karts:zebras';
    grupo.add(m);
  }

  // linha de chegada (quadriculado) e marcas do grid
  const lcq = linhaChegada(track, origem, 0.035);
  grupo.add(malhaChao({ pos: lcq.pos, idx: null, cores: lcq.cor }, matChao(4, { color: 0xffffff, vertexColors: true, roughness: 0.6 })));
  {
    const pos = [], p = {};
    // marcas onde os karts param (GRID do grid.js: fila, coluna e primeira fila)
    for (const m of marcasDoGrid(track, linha, { ...GRID, lugares: 20 })) {
      // traço de 1,2 m de largura e 12 cm de espessura, mais as "orelhas" de 40 cm para trás nas pontas
      const peca = (s0, s1, d0, d1) => {
        for (const [s, d] of [[s0, d0], [s0, d1], [s1, d1], [s0, d0], [s1, d1], [s1, d0]]) { track.point(s, d, p); pos.push(p.x - origem.x, 0.036, p.z - origem.z); }
      };
      const a = m.d - 0.6, b = m.d + 0.6, ab = [Math.min(a, b), Math.max(a, b)];
      peca(m.s - 0.12, m.s, ab[0], ab[1]);
      peca(m.s - 0.5, m.s - 0.12, ab[0], ab[0] + 0.1);
      peca(m.s - 0.5, m.s - 0.12, ab[1] - 0.1, ab[1]);
    }
    const marcas = malhaChao({ pos: Float32Array.from(pos), idx: null }, matChao(4, { color: FAIXA, roughness: 0.6, side: T.DoubleSide }));
    marcas.name = 'RCL-Karts:grid';
    grupo.add(marcas);
  }

  // muros de pneus: pilhas de três, vermelhas e brancas alternando
  const { pilhas, jersey } = muros(track, origem);
  if (pilhas.length) {
    const inst = new T.InstancedMesh(geometriaPilha(), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 }), pilhas.length);
    const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(1, 1, 1), c = new T.Color(), r = sorteio(33);
    pilhas.forEach((p, i) => {
      Q.setFromAxisAngle(new T.Vector3(0, 1, 0), r() * Math.PI * 2);
      M.compose(new T.Vector3(p.x, 0, p.z), Q, S.set(1, 0.97 + r() * 0.06, 1));
      inst.setMatrixAt(i, M);
      inst.setColorAt(i, c.setHex(p.vermelho ? PNEU_VERMELHO : PNEU_BRANCO));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.name = 'RCL-Karts:pneus';
    grupo.add(inst);
  }
  // Jersey de concreto no perfil New Jersey
  const matJersey = new T.MeshStandardMaterial({ map: TX.concreto(), roughness: 0.95, metalness: 0 });
  for (const j of jersey) {
    const L = Math.hypot(j.bx - j.ax, j.bz - j.az), b = new T.Mesh(geometriaJersey(L), matJersey);
    b.position.set((j.ax + j.bx) / 2, 0, (j.az + j.bz) / 2);
    b.rotation.y = Math.atan2(j.bx - j.ax, j.bz - j.az);
    b.castShadow = b.receiveShadow = true;
    b.name = 'RCL-Karts:jersey';
    grupo.add(b);
  }

  // alambrado em volta do kartódromo (42 m para fora do eixo), com postes
  const cerca = contorno(track, origem, { folga: 42, passo: 3 });
  {
    const { tela, postes } = geometriaAlambrado(cerca, { altura: 2.4, passoPoste: 3 });
    const matTela = new T.MeshStandardMaterial({ map: TX.alambrado(), transparent: false, alphaTest: 0.4, alphaToCoverage: true, side: T.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0xb9bec4 });
    const m = new T.Mesh(tela, matTela);
    m.name = 'RCL-Karts:alambrado';
    grupo.add(m);
    const pg = new T.CylinderGeometry(0.04, 0.04, 2.5, 6).translate(0, 1.25, 0);
    const inst = new T.InstancedMesh(pg, new T.MeshStandardMaterial({ color: 0x8d9298, roughness: 0.5, metalness: 0.7 }), postes.length);
    const M = new T.Matrix4();
    postes.forEach(([x, zz], i) => inst.setMatrixAt(i, M.makeTranslation(x, 0, zz)));
    inst.castShadow = true;
    grupo.add(inst);
  }

  // árvores fora do alambrado e no miolo, longe da pista e dos boxes
  {
    const lista = arvores(track, origem, { cerca, reservas: [reservaDosBoxes(track, origem)] }), r = sorteio(77);
    for (const tipo of [0, 1]) {
      const desse = lista.filter((a) => a.tipo === tipo);
      if (!desse.length) continue;
      const inst = new T.InstancedMesh(geometriaArvore(tipo, r), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }), desse.length);
      const M = new T.Matrix4(), Q = new T.Quaternion(), c = new T.Color(), Y = new T.Vector3(0, 1, 0);
      desse.forEach((a, i) => {
        const s = a.escala * (tipo ? 1.4 : 1.6);
        M.compose(new T.Vector3(a.x, 0, a.z), Q.setFromAxisAngle(Y, a.giro), new T.Vector3(s, s * (0.9 + a.tom * 0.3), s));
        inst.setMatrixAt(i, M);
        inst.setColorAt(i, c.setRGB(0.85 + a.tom * 0.3, 0.9 + a.tom * 0.2, 0.85 + (1 - a.tom) * 0.2));
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.name = `RCL-Karts:arvores${tipo}`;
      grupo.add(inst);
    }
  }

  scene.add(grupo);
  return grupo;
}
