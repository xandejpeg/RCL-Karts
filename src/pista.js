// Desenho do Circuito 101 (three.js), do chat RCL-Karts, com o relevo do SRTM: terreno de grama com faixas de corte
// acompanhando a pista, asfalto com textura e a borracha escurecendo a linha de corrida, faixas brancas, zebras finas com
// relevo e zebras largas pintadas, faixa azul, ombro de grama, linha de chegada, marcas do grid, muros e pilhas de pneus
// (vermelhas e brancas) onde a física põe, o Jersey, o alambrado em volta, as árvores e os postos de fiscal.
// Só desenho: a física é a de src/fisica. Assinatura de sempre: montaPista(scene, track, origem).
import * as T from 'three';
import { racingLine } from './fisica/kart-fisica.js';
import { linhaChegada } from './pista-dados.js';
import { faixaColunas, brilhoDoAsfalto, zebras3d, marcasDoGrid, contorno, arvores, sorteio, bordasDoTrack, faixaBorda, pneusDosMuros, postosDeFiscal } from './pista3d/dados3d.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terreno } from './pista3d/terreno.js';
import { malhaChao, malhaRelevo, geometriaPilha, geometriaPilhaLonge, geometriaJerseyLinha, geometriaArvore, geometriaAlambrado } from './pista3d/malhas.js';
import * as TX from './pista3d/texturas.js';
import { GRID } from './grid.js';

const FAIXA = 0xe9e9e9, PNEU_VERMELHO = 0xc41e24, PNEU_BRANCO = 0xe6e6e2, AZUL = 0x2f74d8;
// pilhas de pneus: tamanho do bloco (m) e distância (m, da câmera ao centro do bloco) em que passam à pilha simples
export const PNEUS = { bloco: 32, longe: 55 };

// cor da grama por posição (faixas de corte de 6 m, escurece longe do centro, um pouco de ruído fixo)
function corGrama(x, z, cx, cz) {
  const faixaCorte = Math.floor((x * 0.8 + z * 0.6) / 6) % 2 ? 1.06 : 0.94, longe = Math.min(1, Math.hypot(x - cx, z - cz) / 450);
  const ruido = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453, r = ruido - Math.floor(ruido);
  const v = faixaCorte * (1 - longe * 0.18) * (0.96 + r * 0.08);
  return [v, v, v * (1 - longe * 0.1)];
}

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
  const hw = track.hw, linha = track.wrap(track.json?.cronometro?.s ?? 0), B = bordasDoTrack(track);
  const [x0, z0, x1, z1] = track.box, cx = (x0 + x1) / 2 - origem.x, cz = (z0 + z1) / 2 - origem.z;
  const H = terreno(track, origem).alt, h = (i, d = 0) => (track.h?.[i] ?? 0) + d * (track.inc?.[i] ?? 0), hs = (s, d = 0) => (track.altura ? track.altura(s, d) : 0);
  const matGrama = new T.MeshStandardMaterial({ map: TX.grama(), vertexColors: true, roughness: 1, metalness: 0 });

  // terreno de grama: grade de 4 m com o relevo (um pouco abaixo da pista), textura a cada 7 m e as faixas de corte
  {
    const L = x1 - x0 + 900, A = z1 - z0 + 700, g = new T.PlaneGeometry(L, A, Math.round(L / 4), Math.round(A / 4));
    g.rotateX(-Math.PI / 2);
    g.translate(cx, 0, cz);
    const p = g.attributes.position, uv = g.attributes.uv, cores = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), zz = p.getZ(i);
      p.setY(i, H(x, zz) - 0.07);
      uv.setXY(i, x / 7, zz / 7);
      cores.set(corGrama(x, zz, cx, cz), i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(cores, 3));
    g.computeVertexNormals();
    const chao = new T.Mesh(g, matGrama);
    chao.receiveShadow = true;
    chao.name = 'RCL-Karts:grama';
    grupo.add(chao);
  }

  // borda pintada de cada lado em cada ponto: asfalto + zebra + faixa azul
  const zb = (lado, i) => (lado < 0 ? B.L : B.R).z[i], az = (lado, i) => (lado < 0 ? B.L : B.R).a[i];
  const fimPintado = (lado, i) => hw + zb(lado, i) + az(lado, i);

  // ombro de grama: 1,5 m depois da borda pintada, descendo da altura da pista até o terreno (sem degrau nem buraco)
  {
    const o = faixaBorda(track, origem, {
      dIn: fimPintado, dOut: (lado, i) => fimPintado(lado, i) + 1.5,
      altIn: (i, d) => h(i, d) - 0.004, altOut: (x, zz) => H(x, zz) - 0.07
    });
    const n = o.pos.length / 3, cores = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const x = o.pos[k * 3], zz = o.pos[k * 3 + 2];
      o.uv[k * 2] = x / 7; o.uv[k * 2 + 1] = zz / 7;
      cores.set(corGrama(x, zz, cx, cz), k * 3);
    }
    const m = malhaChao({ ...o, cores }, matChao(1, { map: TX.grama(), vertexColors: true, roughness: 1 }));
    m.geometry.computeVertexNormals();
    m.name = 'RCL-Karts:ombro';
    grupo.add(m);
  }

  // faixa azul pintada depois da zebra (onde a física tem 'azul')
  {
    const f = faixaBorda(track, origem, {
      dIn: (lado, i) => hw + zb(lado, i), dOut: fimPintado, tem: (lado, i) => az(lado, i) > 0,
      altIn: (i, d) => h(i, d) + 0.012, altOut: (x, zz, i, d) => h(i, d) + 0.012
    });
    if (f.idx.length) {
      const m = malhaChao(f, matChao(2, { color: AZUL, roughness: 0.72 }));
      m.name = 'RCL-Karts:azul';
      grupo.add(m);
    }
  }

  // áreas de escape asfaltadas (a do 1º S): faixa no chão do terreno, com as bordas pintadas de branco
  for (const a of track.json?.areas || []) {
    const C = a.centro.map(([x, zz]) => [x - origem.x, zz - origem.z]), w = a.largura / 2, n = C.length;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
    let acum = 0;
    for (let i = 0; i < n; i++) {
      const p = C[Math.max(0, i - 1)], q = C[Math.min(n - 1, i + 1)], tx = q[0] - p[0], tz = q[1] - p[1], L = Math.hypot(tx, tz) || 1, rx = -tz / L, rz = tx / L;
      if (i) acum += Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]);
      for (const [k, sg] of [[0, -1], [1, 1]]) {
        const x = C[i][0] + rx * w * sg, zz = C[i][1] + rz * w * sg;
        pos.set([x, H(x, zz) + 0.012, zz], (i * 2 + k) * 3);
        uv.set([acum / 5, (sg * w) / 5], (i * 2 + k) * 2);
      }
      if (i < n - 1) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const m = malhaChao({ pos, uv, idx: Uint32Array.from(idx) }, matChao(1, { map: TX.asfalto(), color: 0xb9b9b9, roughness: 0.9, side: T.DoubleSide }));
    m.geometry.computeVertexNormals();
    m.name = 'RCL-Karts:escape';
    grupo.add(m);
  }

  // asfalto: textura de brita (repete a cada 5 m) e a borracha da linha de corrida na cor por vértice
  const lc = racingLine(track);
  const asf = faixaColunas(track, -hw, hw, origem, {
    y: 0.02, colunas: 16, escalaU: 5, escalaV: 5, alt: h,
    cor: (s, d, i) => { const b = brilhoDoAsfalto(d, lc.d[i], hw); return [b, b, b]; }
  });
  const asfalto = malhaChao(asf, matChao(2, { map: TX.asfalto(), vertexColors: true, roughness: 0.88 }));
  asfalto.geometry.computeVertexNormals();
  asfalto.name = 'RCL-Karts:asfalto';
  grupo.add(asfalto);

  // faixas brancas nas bordas
  const matFaixa = matChao(3, { color: FAIXA, roughness: 0.6 });
  for (const lado of [-1, 1]) {
    const f = faixaColunas(track, lado * (hw - 0.12), lado * hw, origem, { y: 0.03, alt: h });
    grupo.add(malhaChao(f, matFaixa));
  }

  // zebras: fina com relevo e listras de 1 m, larga pintada com listras de 2 m
  {
    const z3 = zebras3d(track, origem, { y: 0.02, alt: hs });
    if (z3.pos.length) {
      const m = malhaRelevo(z3, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12 }));
      m.name = 'RCL-Karts:zebras';
      grupo.add(m);
    }
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
        for (const [s, d] of [[s0, d0], [s0, d1], [s1, d1], [s0, d0], [s1, d1], [s1, d0]]) { track.point(s, d, p); pos.push(p.x - origem.x, 0.036 + hs(s, d), p.z - origem.z); }
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

  // muros de pneus (os da física: em volta da pista e as pilhas soltas dos ápices), pilhas de três vermelhas e brancas.
  // Desempenho (16/10): eram 3.600 pilhas num desenho só, sempre inteiro e com sombra (~800 mil triângulos duas vezes por
  // quadro). Agora em blocos de PNEUS.bloco m (o bloco fora da vista não é desenhado) e cada bloco com dois níveis: perto,
  // a pilha com os sulcos e sombra; a partir de PNEUS.longe m do centro do bloco, o cilindro simples, sem sombra.
  const pilhas = pneusDosMuros(track, origem, { passo: 0.6, alt: H });
  if (pilhas.length) {
    const geoPerto = geometriaPilha(8), geoLonge = geometriaPilhaLonge(), mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 });
    const M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3(1, 1, 1), V = new T.Vector3(), c = new T.Color(), r = sorteio(33), Y = new T.Vector3(0, 1, 0);
    const blocos = new Map();
    for (const p of pilhas) {
      const chave = `${Math.floor(p.x / PNEUS.bloco)},${Math.floor(p.z / PNEUS.bloco)}`;
      if (!blocos.has(chave)) blocos.set(chave, []);
      blocos.get(chave).push({ p, giro: r() * Math.PI * 2, alto: 0.97 + r() * 0.06 });
    }
    for (const lista of blocos.values()) {
      const cx = lista.reduce((a, b) => a + b.p.x, 0) / lista.length, cz = lista.reduce((a, b) => a + b.p.z, 0) / lista.length;
      const lod = new T.LOD();
      lod.position.set(cx, 0, cz);
      for (const [geo, dist, sombra] of [[geoPerto, 0, true], [geoLonge, PNEUS.longe, false]]) {
        const inst = new T.InstancedMesh(geo, mat, lista.length);
        lista.forEach(({ p, giro, alto }, i) => {
          M.compose(V.set(p.x - cx, p.y - 0.03, p.z - cz), Q.setFromAxisAngle(Y, giro), S.set(1, alto, 1));
          inst.setMatrixAt(i, M);
          inst.setColorAt(i, c.setHex(p.vermelho ? PNEU_VERMELHO : PNEU_BRANCO));
        });
        inst.computeBoundingSphere();
        inst.castShadow = sombra;
        inst.receiveShadow = true;
        inst.name = 'RCL-Karts:pneus';
        lod.addLevel(inst, dist);
      }
      grupo.add(lod);
    }
  }
  // Jersey de concreto no perfil New Jersey, contínuo pela linha da física e com o pé no chão do relevo
  const matJersey = new T.MeshStandardMaterial({ map: TX.concreto(), roughness: 0.95, metalness: 0, side: T.DoubleSide });
  for (const m of (track.json?.muros || []).filter((w) => w.tipo === 'jersey')) {
    const b = new T.Mesh(geometriaJerseyLinha(m.pontos.map(([x, zz]) => [x - origem.x, zz - origem.z]), H), matJersey);
    b.castShadow = b.receiveShadow = true;
    b.name = 'RCL-Karts:jersey';
    grupo.add(b);
  }

  // postos de fiscal atrás do muro, por fora das curvas mais fechadas: plataforma, telhado e a bandeira amarela
  {
    const lista = postosDeFiscal(track, origem, lc.k, { areas: track.json?.areas || [] });
    if (lista.length) {
      const pos = (g, cor) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(cor, i * 3); g.setAttribute('color', new T.BufferAttribute(c, 3)); return g.index ? g.toNonIndexed() : g; };
      const partes = [
        pos(new T.BoxGeometry(1.8, 0.5, 1.8).translate(0, 0.25, 0), [0.93, 0.93, 0.9]),
        ...[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map(([x, z]) => pos(new T.BoxGeometry(0.08, 2.1, 0.08).translate(x, 1.55, z), [0.35, 0.36, 0.38])),
        pos(new T.BoxGeometry(2.1, 0.08, 2.1).translate(0, 2.62, 0), [0.95, 0.45, 0.08]),
        pos(new T.BoxGeometry(1.8, 0.9, 0.05).translate(0, 0.95, 0.88), [0.95, 0.45, 0.08]),
        pos(new T.CylinderGeometry(0.02, 0.02, 1.6, 5).translate(0.7, 1.7, 0.95), [0.3, 0.3, 0.3]),
        pos(new T.BoxGeometry(0.02, 0.45, 0.6).translate(0.7, 2.25, 1.25), [0.98, 0.84, 0.05])
      ];
      const inst = new T.InstancedMesh(mergeGeometries(partes), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 }), lista.length);
      const M = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), um = new T.Vector3(1, 1, 1);
      lista.forEach((q, i) => inst.setMatrixAt(i, M.compose(new T.Vector3(q.x, H(q.x, q.z) - 0.05, q.z), Q.setFromAxisAngle(Y, q.rumo), um)));
      inst.castShadow = true;
      inst.name = 'RCL-Karts:fiscais';
      grupo.add(inst);
    }
  }

  // alambrado em volta do kartódromo (42 m para fora do eixo), com postes
  const cerca = contorno(track, origem, { folga: 42, passo: 3 });
  {
    const { tela, postes } = geometriaAlambrado(cerca, { altura: 2.4, passoPoste: 3, alt: H });
    const matTela = new T.MeshStandardMaterial({ map: TX.alambrado(), transparent: false, alphaTest: 0.4, alphaToCoverage: true, side: T.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0xb9bec4 });
    const m = new T.Mesh(tela, matTela);
    m.name = 'RCL-Karts:alambrado';
    grupo.add(m);
    const pg = new T.CylinderGeometry(0.04, 0.04, 2.5, 6).translate(0, 1.25, 0);
    const inst = new T.InstancedMesh(pg, new T.MeshStandardMaterial({ color: 0x8d9298, roughness: 0.5, metalness: 0.7 }), postes.length);
    const M = new T.Matrix4();
    postes.forEach(([x, zz, y], i) => inst.setMatrixAt(i, M.makeTranslation(x, y, zz)));
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
        M.compose(new T.Vector3(a.x, H(a.x, a.z) - 0.1, a.z), Q.setFromAxisAngle(Y, a.giro), new T.Vector3(s, s * (0.9 + a.tom * 0.3), s));
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
