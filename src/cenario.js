// Cenário do kartódromo (chat RCL-Karts, sem asset de fora): céu com degradê e mata no horizonte, pátio de concreto,
// prédio dos boxes (13 boxes com porta de enrolar, marquise, andar de cima envidraçado e letreiro da casa), torre de
// cronometragem, arquibancada coberta, pórtico de largada com as cinco luzes e postes de luz com refletores.
// Só desenho: nada disso entra na física. Assinatura de sempre: montaCenario(scene, track, origem, linha).
// O grupo devolvido tem userData.luzesDaLargada(acesas, verde) para o pórtico acompanhar a largada da prova.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { postes, naReta } from './pista-dados.js';
import { faixaTrecho, sorteio } from './pista3d/dados3d.js';
import { terreno } from './pista3d/terreno.js';
import { malhaChao } from './pista3d/malhas.js';
import * as TX from './pista3d/texturas.js';

const mat = (cor, o = {}) => new T.MeshStandardMaterial({ color: cor, roughness: 0.85, metalness: 0.05, ...o });

// Junta geometrias por material (uma chamada de desenho por material em cada peça grande).
class Lote {
  constructor() { this.por = new Map(); }
  poe(material, geo) { if (!this.por.has(material)) this.por.set(material, []); this.por.get(material).push(geo); }
  // caixa [x, y, z] com o canto de baixo no chão (y0) e centro em (cx, cz), no quadro local
  caixa(material, [lx, ly, lz], [cx, y0, cz], { uvMetros = 0 } = {}) {
    const g = new T.BoxGeometry(lx, ly, lz).translate(cx, y0 + ly / 2, cz);
    if (uvMetros) {
      const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
        const u = ax > 0.5 ? p.getZ(i) : p.getX(i), v = ay > 0.5 ? p.getZ(i) : p.getY(i);
        uv.setXY(i, u / uvMetros, v / uvMetros);
      }
    }
    this.poe(material, g);
  }
  malhas(grupo, { sombra = true } = {}) {
    for (const [m, gs] of this.por) {
      const mesh = new T.Mesh(mergeGeometries(gs), m);
      mesh.castShadow = sombra;
      mesh.receiveShadow = true;
      grupo.add(mesh);
    }
  }
}

// grupo no ponto (s, d) da reta: +Z ao longo da reta (no sentido da corrida), +X para a esquerda (para longe da pista,
// do lado dos boxes)
function naRetaGrupo(track, origem, s, d) {
  const r = naReta(track, origem, s, d), g = new T.Group();
  g.position.set(r.x, terreno(track, origem).alt(r.x, r.z), r.z);   // (no chão do relevo)
  g.rotation.y = r.rumo;
  return g;
}

// Céu: domo com degradê (cor da neblina no horizonte, azul no alto, brilho do lado do sol) e uma faixa de mata escura
// no horizonte, em volta de tudo.
function ceu(scene, centro, sol) {
  const horizonte = scene.fog?.color?.clone() ?? new T.Color(0x9fb4c8);
  const geo = new T.SphereGeometry(1300, 32, 16);
  const m = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { horizonte: { value: horizonte }, alto: { value: new T.Color(0x3f6fa8) }, sol: { value: sol.clone().normalize() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 horizonte; uniform vec3 alto; uniform vec3 sol; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizonte, alto, pow(h, 0.55));
        float s = max(dot(normalize(vDir), sol), 0.0); c += vec3(1.0, 0.92, 0.75) * (pow(s, 64.0) * 0.6 + pow(s, 6.0) * 0.12);
        if (vDir.y < 0.0) c = horizonte; gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const domo = new T.Mesh(geo, m);
  domo.position.copy(centro);
  domo.renderOrder = -1;
  domo.frustumCulled = false;
  domo.name = 'RCL-Karts:ceu';
  // mata no horizonte: anel de ~360 m de raio com a borda de cima recortada como copa de árvore (a cada ~2 m)
  const r = sorteio(5), n = 1100, pos = [], idx = [];
  let onda = 0;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, raio = 360 + Math.sin(a * 3 + 0.7) * 25 + Math.sin(a * 11) * 6;
    onda = onda * 0.6 + (r() - 0.5) * 6;
    const h = i === n ? pos[4] : 13 + Math.sin(a * 7) * 3 + Math.sin(a * 23 + 2) * 2 + onda + (i % 2 ? 1.2 : 0);
    pos.push(centro.x + Math.cos(a) * raio, -1, centro.z + Math.sin(a) * raio, centro.x + Math.cos(a) * raio, h, centro.z + Math.sin(a) * raio);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mata = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x2b4426, roughness: 1, side: T.DoubleSide }));
  mata.name = 'RCL-Karts:mata';
  return [domo, mata];
}

// Prédio dos boxes: 110 m ao longo da reta, 10 m de fundo; frente (para a pista) em x = −5 no quadro local.
function predioDosBoxes(M) {
  const L = new Lote(), comp = 110, baias = 13, larguraBaia = comp / baias;
  // bloco do térreo (paredes) e a laje
  L.caixa(M.parede, [9.6, 4.2, comp], [0.2, 0, 0], { uvMetros: 3 });
  for (let i = 0; i <= baias; i++) L.caixa(M.concreto, [0.7, 4.2, 1.1], [-4.9, 0, -comp / 2 + i * larguraBaia], { uvMetros: 2 });
  L.caixa(M.concreto, [0.7, 0.6, comp], [-4.9, 3.6, 0], { uvMetros: 2 });
  // portas de enrolar, recuadas
  for (let i = 0; i < baias; i++) L.caixa(M.porta, [0.1, 3.6, larguraBaia - 1.1], [-4.75, 0, -comp / 2 + (i + 0.5) * larguraBaia]);
  // marquise de 3 m para a pista, com colunas finas e a faixa da frente
  L.caixa(M.laje, [13.4, 0.32, comp + 1], [-1.6, 4.2, 0]);
  for (let z = -comp / 2 + 2; z <= comp / 2 - 2; z += 15.5) L.caixa(M.metal, [0.18, 4.2, 0.18], [-7.9, 0, z]);
  L.caixa(M.escuro, [0.12, 0.9, comp + 1], [-8.3, 4.05, 0]);
  // andar de cima no meio: vidro na frente, paredes e laje
  L.caixa(M.parede, [7.6, 3.2, 44], [1.2, 4.52, 0], { uvMetros: 3 });
  L.caixa(M.vidro, [0.12, 2.6, 43.6], [-2.72, 4.82, 0]);
  for (let z = -22; z <= 22; z += 5.5) L.caixa(M.metal, [0.2, 3.2, 0.2], [-2.8, 4.52, z]);
  L.caixa(M.laje, [9.6, 0.28, 46], [0.2, 7.72, 0]);
  // guarda-corpo de vidro no terraço, na beira da marquise
  L.caixa(M.vidroClaro, [0.06, 1.0, comp], [-8.1, 4.52, 0]);
  L.caixa(M.metal, [0.1, 0.08, comp], [-8.1, 5.52, 0]);
  const g = new T.Group();
  L.malhas(g);
  // letreiro da casa na faixa da marquise, virado para a pista
  const letreiro = new T.Mesh(new T.PlaneGeometry(26, 0.9), new T.MeshStandardMaterial({ map: TX.placa('RCL KARTS · CIRCUITO 101', { largura: 2048, altura: 72 }), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.05 }));
  letreiro.position.set(-8.37, 4.5, 0);
  letreiro.rotation.y = -Math.PI / 2;
  g.add(letreiro);
  // números dos boxes acima das portas
  return g;
}

// Torre de cronometragem: coluna, cabine de vidro, telhado e o painel virado para a pista.
function torre(M) {
  const L = new Lote();
  L.caixa(M.parede, [3, 8, 3], [0, 0, 0], { uvMetros: 3 });
  L.caixa(M.vidro, [4.2, 2.4, 4.2], [0, 8, 0]);
  for (const [x, z] of [[-2.1, -2.1], [-2.1, 2.1], [2.1, -2.1], [2.1, 2.1]]) L.caixa(M.metal, [0.16, 2.4, 0.16], [x, 8, z]);
  L.caixa(M.laje, [5.2, 0.3, 5.2], [0, 10.4, 0]);
  L.caixa(M.metal, [0.08, 3, 0.08], [0.8, 10.7, 0.8]);
  const g = new T.Group();
  L.malhas(g);
  const painel = new T.Mesh(new T.PlaneGeometry(3.4, 0.9), new T.MeshStandardMaterial({ map: TX.placa('CIRCUITO 101', { largura: 512, altura: 136 }), roughness: 0.5 }));
  painel.position.set(-1.52, 6.6, 0);
  painel.rotation.y = -Math.PI / 2;
  g.add(painel);
  return g;
}

// Arquibancada coberta: cinco degraus subindo para longe da pista, cadeiras vermelhas e brancas, cobertura inclinada.
function arquibancada(M, comp = 30) {
  const L = new Lote(), cadeiras = [];
  for (let i = 0; i < 5; i++) {
    L.caixa(M.concreto, [1.1, 0.55 * (i + 1), comp], [i * 1.1, 0, 0], { uvMetros: 2 });
    for (let z = -comp / 2 + 0.4; z <= comp / 2 - 0.4; z += 0.55) cadeiras.push([i * 1.1 - 0.15, 0.55 * (i + 1), z, (Math.floor(z / 0.55) + i) % 5 === 0]);
  }
  L.caixa(M.parede, [0.25, 6.4, comp], [5.4, 0, 0], { uvMetros: 3 });
  for (const z of [-comp / 2, 0, comp / 2]) L.caixa(M.metal, [0.22, 6.2, 0.22], [5.2, 0, z]);
  const g = new T.Group();
  L.malhas(g);
  const telhado = new T.Mesh(new T.BoxGeometry(7.4, 0.14, comp + 1.5), M.telha);
  telhado.position.set(2.0, 6.45, 0);
  telhado.rotation.z = -0.12;
  telhado.castShadow = telhado.receiveShadow = true;
  g.add(telhado);
  // cadeiras: assento e encosto numa peça só, instanciadas
  const geo = mergeGeometries([new T.BoxGeometry(0.42, 0.06, 0.44).translate(0, 0.26, 0), new T.BoxGeometry(0.06, 0.42, 0.44).translate(0.2, 0.47, 0)]);
  const inst = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), cadeiras.length);
  const Mx = new T.Matrix4(), c = new T.Color();
  cadeiras.forEach(([x, y, z, branca], i) => { inst.setMatrixAt(i, Mx.makeTranslation(x, y, z)); inst.setColorAt(i, c.setHex(branca ? 0xeeeeee : 0xc8202a)); });
  inst.castShadow = true;
  g.add(inst);
  return g;
}

// Pórtico de largada sobre a linha: duas colunas fora da zebra, viga a 4,4 m e o painel das cinco luzes virado para o
// grid. Devolve o grupo e a função que acende as luzes.
function portico(M, larguraLivre) {
  const L = new Lote(), meia = larguraLivre / 2 + 0.5;
  for (const x of [-meia, meia]) L.caixa(M.metal, [0.36, 4.9, 0.36], [x, 0, 0]);
  // viga em treliça: banzos em cima e embaixo e diagonais
  for (const y of [4.2, 4.72]) for (const z of [-0.22, 0.22]) L.caixa(M.metal, [2 * meia, 0.08, 0.08], [0, y, z]);
  for (let x = -meia + 0.5; x < meia; x += 1.0) L.caixa(M.metal, [0.05, 0.6, 0.05], [x, 4.2, -0.22]), L.caixa(M.metal, [0.05, 0.6, 0.05], [x, 4.2, 0.22]);
  L.caixa(M.vermelho, [2 * meia, 0.5, 0.04], [0, 4.25, -0.26]);
  L.caixa(M.escuro, [3.4, 0.7, 0.18], [0, 3.62, -0.2]);
  const g = new T.Group();
  L.malhas(g);
  const apagada = new T.MeshStandardMaterial({ color: 0x220405, roughness: 0.3, emissive: 0x000000 });
  const luzes = [];
  for (let i = 0; i < 5; i++) {
    const m = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.1, 16).rotateX(Math.PI / 2), apagada.clone());
    m.position.set(-1.28 + i * 0.64, 3.97, -0.32);
    g.add(m);
    luzes.push(m);
  }
  const acende = (acesas = 0, verde = false) => {
    luzes.forEach((m, i) => {
      const liga = verde || i < acesas;
      m.material.emissive.setHex(liga ? (verde ? 0x10ff40 : 0xff1a10) : 0x000000);
      m.material.emissiveIntensity = liga ? 3 : 0;
      m.material.color.setHex(liga ? (verde ? 0x0a6a20 : 0x6a0805) : 0x220405);
    });
  };
  return { g, acende };
}

// Postes de luz: coluna afinando, travessa e três refletores virados para a pista.
function postesDeLuz(track, origem, M) {
  const lista = postes(track, origem);
  if (!lista.length) return [];
  const coluna = mergeGeometries([new T.CylinderGeometry(0.09, 0.17, 12, 8).translate(0, 6, 0), new T.BoxGeometry(0.12, 0.12, 2.6).translate(0, 11.9, 0)]);
  const refletor = mergeGeometries([-0.95, 0, 0.95].map((z) => new T.BoxGeometry(0.22, 0.42, 0.62).rotateZ(0.5).translate(-0.18, 11.55, z)));
  const cols = new T.InstancedMesh(coluna, M.metal, lista.length);
  const lamps = new T.InstancedMesh(refletor, new T.MeshStandardMaterial({ color: 0x2a2b30, roughness: 0.4, emissive: 0xfff4d6, emissiveIntensity: 1.6 }), lista.length);
  const Mx = new T.Matrix4(), Q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0), um = new T.Vector3(1, 1, 1), p = {};
  lista.forEach((q, i) => {
    track.point(q.s, 0, p);
    // o refletor (−x local) aponta para o eixo da pista
    const ang = Math.atan2(-(p.z - origem.z - q.z), p.x - origem.x - q.x);
    Mx.compose(new T.Vector3(q.x, terreno(track, origem).alt(q.x, q.z) - 0.05, q.z), Q.setFromAxisAngle(Y, ang + Math.PI), um);
    cols.setMatrixAt(i, Mx);
    lamps.setMatrixAt(i, Mx);
  });
  cols.castShadow = true;
  cols.name = 'RCL-Karts:postes';
  return [cols, lamps];
}

export function montaCenario(scene, track, origem, linha) {
  const g = new T.Group();
  g.name = 'RCL-Karts:cenario';
  const borda = track.hw + (track.zebra || 0), lado = -1;   // boxes à esquerda da reta (no 101, o norte)
  const M = {
    parede: mat(0xe6e7ea, { map: TX.concreto(), roughness: 0.9 }),
    concreto: mat(0xd2d3d6, { map: TX.concreto(), roughness: 0.95 }),
    laje: mat(0x8f939a, { roughness: 0.8 }),
    porta: mat(0x9aa0a8, { map: TX.portaDeEnrolar(), metalness: 0.4, roughness: 0.55 }),
    metal: mat(0x7c8189, { metalness: 0.7, roughness: 0.4 }),
    escuro: mat(0x1c1d21, { metalness: 0.4, roughness: 0.5 }),
    vidro: mat(0x1b2a38, { metalness: 0.8, roughness: 0.08, emissive: 0x07121c }),
    vidroClaro: mat(0x8fb3c8, { metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    telha: mat(0x5c6068, { metalness: 0.6, roughness: 0.45 }),
    vermelho: mat(0xc8102e, { roughness: 0.5 })
  };

  // céu e mata no horizonte, centrados no kartódromo
  const centro = new T.Vector3(track.center.x - origem.x, 0, track.center.z - origem.z);
  g.add(...ceu(scene, centro, new T.Vector3(80, 160, -60)));

  // pátio de concreto entre a área de escape e os prédios
  const patio = malhaChao(faixaTrecho(track, linha - 95, linha + 52, lado * (borda + 3.05), lado * (borda + 34), origem, { y: -0.03, passo: 2, escala: 9, alt: terreno(track, origem).alt }),
    new T.MeshStandardMaterial({ map: TX.concreto(), color: 0xc9cbce, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  patio.name = 'RCL-Karts:patio';
  g.add(patio);

  // prédio dos boxes (centro 25 m antes da linha, frente a 13 m da borda)
  const boxes = naRetaGrupo(track, origem, linha - 25, lado * (borda + 18));
  boxes.add(predioDosBoxes(M));
  boxes.name = 'RCL-Karts:boxes';
  g.add(boxes);

  // torre de cronometragem na linha
  const t = naRetaGrupo(track, origem, linha, lado * (borda + 7));
  t.add(torre(M));
  g.add(t);

  // arquibancada depois da torre
  const a = naRetaGrupo(track, origem, linha + 24, lado * (borda + 9));
  a.add(arquibancada(M));
  g.add(a);

  // pórtico de largada sobre a linha
  const pt = portico(M, 2 * (borda + 3.0));
  const pg = naRetaGrupo(track, origem, linha, 0);
  pg.add(pt.g);
  pg.name = 'RCL-Karts:portico';
  g.add(pg);
  g.userData.luzesDaLargada = pt.acende;

  // postes de luz em volta da pista
  g.add(...postesDeLuz(track, origem, M));

  scene.add(g);
  return g;
}
