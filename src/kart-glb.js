// Encaixe da arte do kart (GLB do contrato da mensagem 007) no jogo: um clone por kart, achado pelos nomes dos nós.
// Gira as rodas pela distância andada, esterça as da frente, gira o volante, tinge a carenagem (kart_pintura) com a cor
// do piloto e escreve o número de 3 dígitos nos planos numero_*. Longe da câmera some o detalhe (LOD).
// Mesma interface do KartView provisório (sync, hide, dispose, drawCalls); se o GLB faltar, o jogo fica no provisório.
// (Arquivo kart-glb.js, classe KartGlbView: o src/kart3d/kart-modelo.js é o kart modelado em código, do chat RCL-Karts.)
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { confere, achaNos, NOS, MATERIAL_PINTURA, GIRO_RAIZ_Y, giroRoda, RAZAO_VOLANTE } from './kart-contrato.js';
import { numeroKart } from './tempo.js';

// além desta distância (m) da câmera somem volante, banco, motor e números
export const LOD_DETALHE = 45;

export async function carregaKart(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  return { cena: gltf.scene, contrato: confere(gltf.scene) };
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
  constructor(scene, cena, contrato, { capacity = 24 } = {}) {
    this.group = new T.Group();
    this.group.name = 'RCL-Karts:karts-glb';
    scene.add(this.group);
    this.base = cena;
    this.pontos = contrato.pontos;
    this.cap = capacity;
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
      piloto: this.pilotoProvisorio(kart)
    };
    this.group.add(raiz);
    this.itens[i] = it;
    return it;
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
      const odo = k.odo || 0, delta = k.delta || 0;
      for (const e of it.esterco) this.gira(e, Y, delta);
      for (const r of it.frente) this.gira(r, Z, giroRoda(odo, rF));
      for (const r of it.tras) this.gira(r, Z, giroRoda(odo, rT));
      this.gira(it.volante, it.eixo, delta * RAZAO_VOLANTE);
      const perto = !camPos || camPos.distanceTo(it.raiz.position) < LOD_DETALHE;
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
  }
}
