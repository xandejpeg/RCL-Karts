// Pilotos de verdade nos karts (mensagem 009): os modelo.glb leves da frente Personagens (53 ossos, 45 clipes, nós
// lod0/lod1/lod2), um clone de esqueleto por kart tocando o Driving_Loop, sentado no banco (bacia no ísquio, tronco 25°
// para trás) e com mãos no aro e pés nos pedais por IK de dois ossos. Os arquivos ficam em assets/personagens/ (fora do
// git); sem eles o jogo segue com o piloto provisório.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ikDoisOssos } from './ik.js';
import { rclParaJogo } from './kart-contrato.js';
import { ASSENTO, alvosMaos, alvosPes, bacia, corpoDoKart, tinta } from './piloto-assento.js';

export const CLIPE = 'Driving_Loop';
// troca de LOD como os moradores do RCL Motos: lod0 até 15 m, lod1 até 40 m, depois lod2; IK só no lod0
export const LOD = [15, 40];
const OSSOS = ['pelvis', 'neck_01', 'head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
// o tronco vai 25° para trás; pescoço e cabeça devolvem esse ângulo para o olhar ficar na pista
const OLHAR = { pescoco: 0.55, cabeca: 0.45 };
const LADO = new T.Vector3(1, 0, 0);

export async function carregaPilotos(base = './assets/personagens/') {
  const r = await fetch(`${base}indice.json`).catch(() => null);
  if (!r?.ok) return [];
  const indice = await r.json(), loader = new GLTFLoader();
  const modelos = await Promise.all(indice.personagens.filter((p) => p.modelo).map(async (p) => {
    try {
      const g = await loader.loadAsync(base + p.modelo), clipe = g.animations.find((a) => a.name === CLIPE);
      return clipe ? { id: p.id, nome: p.nome, cena: g.scene, clipe } : null;
    } catch (e) {
      console.warn(`RCL-Karts: piloto ${p.id} não carregou`, e);
      return null;
    }
  }));
  return modelos.filter(Boolean);
}

const v3 = (a) => new T.Vector3(...rclParaJogo(a));

// Pedais (chat RCL-Karts, msg 016): o pé vai para a frente e para baixo conforme aperta (acelerador no direito, freio no
// esquerdo), no quadro do RCL (+X frente, +Y cima).
export const CURSO_PEDAL = { frente: 0.05, baixo: 0.03 };
export function pisaNosPedais(pes, inp = {}) {
  const pisa = (p, q) => [p[0] + CURSO_PEDAL.frente * q, p[1] - CURSO_PEDAL.baixo * q, p[2]];
  return { esquerdo: pisa(pes.esquerdo, Math.min(1, inp.freio || 0)), direito: pisa(pes.direito, Math.min(1, inp.acel || 0)) };
}

// Ré (chat RCL-Karts, msg 015): mãos no alto das rodas da frente, quadro do RCL (rodas do kart.glb em x 0,62, z ±0,455,
// raio 0,15; a mão fica um pouco por dentro e por cima do pneu).
const MAOS_NA_RODA = { esquerda: [0.6, 0.31, -0.42], direita: [0.6, 0.31, 0.42] };
// de ré o tronco vai para a frente (rad, a partir de em pé), para as mãos chegarem nas rodas de verdade (msg 017)
export const INCLINA_RE = 0.72;
// na curva o piloto joga o corpo para dentro (msg 018): rad com o corpo todo jogado (k.peso = ±1, da física), girando na
// bacia em torno do eixo da frente do kart; as mãos continuam no volante e os pés nos pedais (IK)
export const INCLINA_CURVA = 0.36;

export class PilotosView {
  constructor(scene, modelos, { capacity = 24 } = {}) {
    this.group = new T.Group();
    this.group.name = 'RCL-Karts:pilotos';
    scene.add(this.group);
    this.modelos = new Map(modelos.map((m) => [m.id, m]));
    this.ids = modelos.map((m) => m.id);
    this.cap = capacity;
    this.itens = [];
    this.pontos(null);
    this._p = new T.Vector3();
    this._alvo = new T.Vector3();
    this._polo = new T.Vector3();
    this._qa = new T.Quaternion();
    this._qb = new T.Quaternion();
    this._qc = new T.Quaternion();
  }

  // pontos do kart em uso (quadro do RCL): banco, volante e pedais
  pontos(p) {
    this.p = p;
    for (const it of this.itens) if (it) it.sentou = false;
  }

  item(i, k) {
    const id = corpoDoKart(i, !!k.player || k.eraJogador, this.ids);
    if (this.itens[i]?.id === id) return this.itens[i];
    if (this.itens[i]) this.solta(this.itens[i]);
    const m = this.modelos.get(id), corpo = SkeletonUtils.clone(m.cena), ossos = {}, lods = [];
    let material = null;
    corpo.traverse((o) => {
      if (o.isBone && OSSOS.includes(o.name)) ossos[o.name] = o;
      if (/^lod[012]$/.test(o.name)) lods[Number(o.name[3])] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        if (!material) material = o.material.clone();
        o.material = material;
      }
    });
    const carro = new T.Group(), assento = new T.Group();
    assento.add(corpo);
    carro.add(assento);
    this.group.add(carro);
    const mixer = new T.AnimationMixer(corpo), acao = mixer.clipAction(m.clipe);
    acao.play();
    acao.time = (i * 0.37) % m.clipe.duration;
    const it = { id, corpo, carro, assento, ossos, lods, material, mixer, cor: null, sentou: false };
    this.itens[i] = it;
    return it;
  }

  solta(it) {
    it.mixer.stopAllAction();
    this.group.remove(it.carro);
    it.material.dispose();
  }

  // posiciona o assento (bacia no banco, tronco para trás) e acerta o corpo para o osso pelvis cair na bacia
  senta(it) {
    const [bx, by, bz] = rclParaJogo(bacia(this.p));
    it.assento.position.set(bx, by, bz);
    it.inclina = ASSENTO.inclinacao;
    it.assento.rotation.x = -it.inclina;
    it.sentou = true;
  }

  // inclinação do tronco (msg 017): para trás sentado (ASSENTO.inclinacao); de ré, para a frente até as rodas. Na curva
  // (msg 018) o corpo vai para o lado de dentro: k.peso > 0 (curva para a esquerda) joga para a esquerda (+x)
  inclinaTronco(it, k, dt) {
    const alvo = k.re ? -INCLINA_RE : ASSENTO.inclinacao, atual = it.inclina ?? ASSENTO.inclinacao;
    it.inclina = atual + (alvo - atual) * Math.min(1, (dt || 0) * 6);
    it.lado = -(k.peso || 0) * INCLINA_CURVA;
    it.assento.rotation.set(-it.inclina, 0, it.lado, 'ZYX');
  }

  centraBacia(it) {
    it.corpo.position.set(0, 0, 0);
    it.corpo.updateMatrixWorld(true);
    const p = it.assento.worldToLocal(it.ossos.pelvis.getWorldPosition(this._p));
    it.corpo.position.set(-p.x, -p.y, -p.z);
    it.corpo.updateMatrixWorld(true);
  }

  // gira pescoço e cabeça para a frente, em torno do eixo lateral do kart (x do quadro do jogo), desfazendo a inclinação
  endireita(it) {
    const eixo = this._polo.copy(LADO).transformDirection(it.carro.matrixWorld);
    for (const [nome, f] of [['neck_01', OLHAR.pescoco], ['head', OLHAR.cabeca]]) {
      const osso = it.ossos[nome];
      if (!osso) continue;
      const qw = osso.getWorldQuaternion(this._qa), qp = osso.parent.getWorldQuaternion(this._qb);
      const giro = this._qc.setFromAxisAngle(eixo, (it.inclina ?? ASSENTO.inclinacao) * f);
      osso.quaternion.copy(qp.invert().multiply(giro).multiply(qw));
      osso.updateMatrixWorld(true);
    }
  }

  // mãos no aro (girando com o volante) e pés nos pedais; polos: cotovelos para fora e para baixo, joelhos para cima
  ik(it, k) {
    // de ré (k.re, msg 015): as mãos vão para o alto das rodas da frente (o piloto puxa o kart para trás)
    const o = it.ossos, maos = k.re ? MAOS_NA_RODA : alvosMaos(this.p, k.delta || 0), pes = pisaNosPedais(alvosPes(this.p), k.inp), c = it.carro;
    const alvo = (a) => c.localToWorld(this._alvo.copy(v3(a)));
    const polo = (x, y, z) => c.localToWorld(this._polo.set(x, y, z));
    // lado esquerdo do piloto = +x no quadro do jogo
    ikDoisOssos(o.upperarm_l, o.lowerarm_l, o.hand_l, alvo(maos.esquerda).clone(), polo(0.6, 0.1, -0.3));
    ikDoisOssos(o.upperarm_r, o.lowerarm_r, o.hand_r, alvo(maos.direita).clone(), polo(-0.6, 0.1, -0.3));
    ikDoisOssos(o.thigh_l, o.calf_l, o.foot_l, alvo(pes.esquerdo).clone(), polo(0.25, 1.2, 0.2));
    ikDoisOssos(o.thigh_r, o.calf_r, o.foot_r, alvo(pes.direito).clone(), polo(-0.25, 1.2, 0.2));
  }

  sync(karts, origin, camPos, dt) {
    if (!this.p) { this.group.visible = false; return; }
    const n = Math.min(karts.length, this.cap);
    for (let i = 0; i < n; i++) {
      const k = karts[i], it = this.item(i, k);
      if (k.player) k.eraJogador = true;
      it.carro.visible = true;
      it.carro.position.set(k.x - origin.x, k.y || 0, k.z - origin.z);
      it.carro.rotation.set(-(k.arfagem || 0), k.yaw, k.rolagem || 0, 'YXZ');   // (relevo, msg 014; o chassi torcendo na curva já vem em k.y e k.rolagem, msg 018)
      if (!it.sentou) this.senta(it);
      this.inclinaTronco(it, k, dt);
      if (it.cor !== k.dr.cor) {
        it.cor = k.dr.cor;
        it.material.color.setHex(tinta(k.dr.cor));
      }
      const dist = camPos ? camPos.distanceTo(it.carro.position) : 0, nivel = dist < LOD[0] ? 0 : dist < LOD[1] ? 1 : 2;
      it.lods.forEach((l, j) => { if (l) l.visible = j === nivel; });
      it.mixer.update(dt);
      it.carro.updateMatrixWorld(true);
      this.centraBacia(it);
      if (nivel < 2) this.endireita(it);
      if (nivel === 0) this.ik(it, k);
      // primeira pessoa (msg 016): com a câmera dentro do capacete do jogador, a cabeça dele some (não tapa a vista); e a
      // posição da cabeça fica no kart (k.cabeca3d, coordenadas do desenho) para a câmera ir junto quando ele se debruça
      if (it.ossos.head) {
        if (k.player) k.cabeca3d = it.ossos.head.getWorldPosition(k.cabeca3d || new T.Vector3());
        it.ossos.head.scale.setScalar(k.player && camPos && camPos.distanceTo(it.carro.position) < 1.4 ? 0.001 : 1);
      }
    }
    for (let i = n; i < this.itens.length; i++) if (this.itens[i]) this.itens[i].carro.visible = false;
    this.group.visible = n > 0;
  }

  drawCalls() {
    let c = 0;
    this.group.traverseVisible((o) => { if (o.isMesh) c++; });
    return c;
  }

  dispose() {
    for (const it of this.itens) if (it) this.solta(it);
    this.group.parent?.remove(this.group);
  }
}
