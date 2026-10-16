// Encaixe da arte do kart (GLB do contrato da mensagem 007) no jogo: um clone por kart, achado pelos nomes dos nós.
// Gira as rodas pela distância andada, esterça as da frente, gira o volante, tinge a carenagem (kart_pintura) com a cor
// do piloto e escreve o número de 3 dígitos nos planos numero_*.
// Níveis de detalhe (kart-lod.js, mensagem 017): as peças fixas vão juntas por material; de 14 a 35 m da câmera, versão
// simplificada; além de 35 m, o kart inteiro (com as rodas paradas) num punhado de triângulos (a sombra dele também fica
// barata, o que conta na câmera de cima). Os números somem além de LOD_DETALHE.
// Mesma interface do KartView provisório (sync, hide, dispose, drawCalls); se o GLB faltar, o jogo fica no provisório.
// (Arquivo kart-glb.js, classe KartGlbView: o src/kart3d/kart-modelo.js é o kart modelado em código, do chat RCL-Karts.)
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { confere, achaNos, NOS, MATERIAL_PINTURA, GIRO_RAIZ_Y, giroRoda, RAZAO_VOLANTE } from './kart-contrato.js';
import { preparaLod, ESTATICOS, NIVEIS } from './kart-lod.js';
import { numeroKart } from './tempo.js';

// além desta distância (m) da câmera somem os números (e, sem os níveis, também volante, banco e motor)
export const LOD_DETALHE = 45;

export async function carregaKart(url) {
  const gltf = await new GLTFLoader().loadAsync(url), contrato = confere(gltf.scene);
  let lod = null;
  if (contrato.ok) {
    try {
      lod = await preparaLod(gltf.scene);
    } catch (e) {
      console.warn('RCL-Karts: níveis de detalhe do kart não saíram; fica o kart inteiro', e);
    }
  }
  return { cena: gltf.scene, contrato, lod };
}

// nível pela distância, com folga na divisa para não piscar
export function nivelPorDistancia(d, atual = 0, niveis = NIVEIS) {
  const lim = [niveis.meio.distancia, niveis.longe.distancia];
  let n = atual;
  while (n < 2 && d > lim[n] + niveis.folga) n++;
  while (n > 0 && d < lim[n - 1] - niveis.folga) n--;
  return n;
}

function texturaNumero(numero) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f6'; g.fillRect(0, 0, 128, 80);
  g.strokeStyle = '#060608'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 74);
  g.fillStyle = '#060608'; g.font = '800 54px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(numeroKart(numero), 64, 43);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

const Y = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);

export class KartGlbView {
  constructor(scene, cena, contrato, { capacity = 24, lod = null } = {}) {
    this.group = new T.Group();
    this.group.name = 'RCL-Karts:karts-glb';
    scene.add(this.group);
    this.base = cena;
    this.pontos = contrato.pontos;
    this.cap = capacity;
    this.lod = lod;
    this.itens = [];
    this._q = new T.Quaternion();
    this.pilotoVisivel = true;
  }

  // esconde o piloto provisório (tronco e capacete) quando o piloto de verdade (pilotos.js) entra
  mostraPilotoProvisorio(sim) {
    this.pilotoVisivel = sim;
    for (const it of this.itens) if (it) it.piloto.grupo.visible = sim;
  }

  // eixo da coluna (direção do kartPontos, no quadro do nó kart) levado para o quadro local do nó volante
  eixoVolante(kart, volante) {
    const q = new T.Quaternion();
    for (let n = volante; n && n !== kart; n = n.parent) q.premultiply(n.quaternion);
    return new T.Vector3(...this.pontos.volante.direcao).normalize().applyQuaternion(q.invert());
  }

  pilotoProvisorio(kart) {
    // até o piloto de macacão chegar: tronco e capacete, sentados no banco, tronco ~25° para trás
    const [bx, by, bz] = this.pontos.banco, g = new T.Group();
    const macacao = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), capacete = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.2 });
    const tronco = new T.Mesh(new T.CapsuleGeometry(0.17, 0.3, 4, 10), macacao);
    tronco.position.set(bx + 0.02, by + 0.36, bz);
    tronco.rotation.z = 0.44;
    const cabeca = new T.Mesh(new T.SphereGeometry(0.14, 16, 12), capacete);
    cabeca.position.set(bx + 0.06, by + 0.74, bz);
    for (const m of [tronco, cabeca]) { m.castShadow = true; g.add(m); }
    g.visible = this.pilotoVisivel;
    kart.add(g);
    return { macacao, capacete, grupo: g };
  }

  item(i) {
    if (this.itens[i]) return this.itens[i];
    const raiz = new T.Group(), copia = this.base.clone(true);
    copia.rotation.y = GIRO_RAIZ_Y;
    raiz.add(copia);
    const nos = achaNos(copia), kart = nos[NOS.raiz];
    const pinturas = [], numeros = [];
    copia.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const troca = (m) => (m?.name === MATERIAL_PINTURA ? (pinturas.push(m.clone()), pinturas[pinturas.length - 1]) : m);
      o.material = Array.isArray(o.material) ? o.material.map(troca) : troca(o.material);
    });
    const matNumero = new T.MeshStandardMaterial({ roughness: 0.6 });
    for (const n of NOS.numeros) nos[n]?.traverse((o) => { if (o.isMesh) { o.material = matNumero; numeros.push(o); } });
    const repouso = (nome) => nos[nome] && { no: nos[nome], q: nos[nome].quaternion.clone() };
    const it = {
      raiz, nos, pinturas, matNumero, cor: null, numero: null,
      esterco: NOS.esterco.map(repouso), frente: NOS.rodasFrente.map(repouso), tras: NOS.rodasTras.map(repouso),
      volante: repouso(NOS.volante), eixo: this.eixoVolante(kart, nos[NOS.volante]),
      detalhe: [NOS.volante, 'banco', 'motor', ...NOS.numeros].map((n) => nos[n]).filter(Boolean),
      piloto: this.pilotoProvisorio(kart), niveis: null, nivel: 0
    };
    if (this.lod) this.montaNiveis(it, kart, matNumero);
    this.group.add(raiz);
    this.itens[i] = it;
    return it;
  }

  // troca as peças fixas e os números do GLB pelas malhas juntas do kart-lod.js (geometrias divididas entre os karts)
  montaNiveis(it, kart, matNumero) {
    const lod = this.lod, nos = it.nos, niveis = [[], [], []];
    for (const n of [...ESTATICOS, ...NOS.numeros]) nos[n]?.traverse((o) => { if (o.isMesh) o.visible = false; });
    // a pintura (kart_pintura) é um material por kart, para levar a cor do piloto: um clone de cada original
    const clones = new Map();
    const material = (m) => {
      if (m?.name !== MATERIAL_PINTURA) return m;
      if (!clones.has(m)) { const c = m.clone(); clones.set(m, c); it.pinturas.push(c); }
      return clones.get(m);
    };
    const poe = (geo, mat, j) => {
      const m = new T.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = `lod${j}`;
      kart.add(m);
      niveis[j].push(m);
    };
    for (const e of lod.estaticos) {
      poe(e.perto, material(e.material), 0);
      poe(e.meio, material(e.material), 1);
      if (e.longe) poe(e.longe, material(e.materialLonge), 2);
    }
    for (const e of lod.longeRodas) poe(e.longe, material(e.material), 2);
    // rodas e volante animados: perto e meio
    for (const n of [...NOS.rodasFrente, ...NOS.rodasTras, NOS.volante]) if (nos[n]) { niveis[0].push(nos[n]); niveis[1].push(nos[n]); }
    it.detalhe = [];
    if (lod.numeros) {
      const m = new T.Mesh(lod.numeros, matNumero);
      m.name = 'numeros';
      kart.add(m);
      it.detalhe.push(m);
    }
    it.niveis = niveis;
    it.nivel = -1;
  }

  aplicaNivel(it, n) {
    if (it.nivel === n) return;
    for (const lista of it.niveis) for (const o of lista) o.visible = false;
    for (const o of it.niveis[n]) o.visible = true;
    it.nivel = n;
  }

  gira(p, eixo, ang) {
    if (p) p.no.quaternion.copy(p.q).multiply(this._q.setFromAxisAngle(eixo, ang));
  }

  // karts da corrida (x, z globais, yaw, delta, odo, dr.cor, dr.numero); origin: origem; camPos: câmera (local)
  sync(karts, origin, camPos = null) {
    const n = Math.min(karts.length, this.cap), { frente: rF, tras: rT } = this.pontos.raioRodas;
    for (let i = 0; i < n; i++) {
      const k = karts[i], it = this.item(i);
      it.raiz.visible = true;
      it.raiz.position.set(k.x - origin.x, k.y || 0, k.z - origin.z);
      it.raiz.rotation.set(-(k.arfagem || 0), k.yaw, k.rolagem || 0, 'YXZ');   // (relevo: bico sobe na subida, msg 014)
      if (it.cor !== k.dr.cor) {
        it.cor = k.dr.cor;
        for (const m of it.pinturas) m.color.setHex(k.dr.cor);
        it.piloto.macacao.color.setHex(k.dr.cor);
        it.piloto.capacete.color.setHex(k.dr.capacete ?? k.dr.cor);
      }
      if (it.numero !== k.dr.numero) {
        it.numero = k.dr.numero;
        it.matNumero.map?.dispose();
        it.matNumero.map = texturaNumero(k.dr.numero);
        it.matNumero.needsUpdate = true;
      }
      const odo = k.odo || 0, delta = k.delta || 0, dist = camPos ? camPos.distanceTo(it.raiz.position) : 0;
      if (it.niveis) this.aplicaNivel(it, nivelPorDistancia(dist, Math.max(it.nivel, 0)));
      if (!it.niveis || it.nivel < 2) {
        for (const e of it.esterco) this.gira(e, Y, delta);
        for (const r of it.frente) this.gira(r, Z, giroRoda(odo, rF));
        for (const r of it.tras) this.gira(r, Z, giroRoda(odo, rT));
        this.gira(it.volante, it.eixo, delta * RAZAO_VOLANTE);
      }
      const perto = dist < LOD_DETALHE;
      for (const d of it.detalhe) d.visible = perto;
    }
    for (let i = n; i < this.itens.length; i++) if (this.itens[i]) this.itens[i].raiz.visible = false;
    this.group.visible = n > 0;
  }

  hide() { this.group.visible = false; }

  drawCalls() {
    let c = 0;
    this.group.traverseVisible((o) => { if (o.isMesh) c++; });
    return c;
  }

  dispose() {
    this.group.parent?.remove(this.group);
    for (const it of this.itens) {
      if (!it) continue;
      it.matNumero.map?.dispose();
      it.matNumero.dispose();
      for (const m of it.pinturas) m.dispose();
    }
    if (this.lod) {
      for (const e of [...this.lod.estaticos, ...this.lod.longeRodas]) for (const g of [e.perto, e.meio, e.longe]) g?.dispose();
      for (const e of this.lod.estaticos) e.materialLonge?.dispose();
      for (const e of this.lod.longeRodas) e.material?.dispose();
      this.lod.numeros?.dispose();
    }
  }
}
