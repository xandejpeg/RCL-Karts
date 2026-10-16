// RCL-Karts · câmera de primeira pessoa (chat RCL-Karts, pedido do Xande, 16/10/2026). No olho do piloto e presa ao
// chassi (rumo, subida e inclinação do kart): quando a traseira sai, o mundo escorrega de lado na tela, como no kart de
// verdade. Olha para baixo como a câmera do capacete do vídeo do 101 (aparecem o volante girando, as mãos, as pernas e o
// bico do kart). A cabeça balança com a força G (a freada joga para a frente, a curva joga para fora e inclina) e treme na
// zebra, na grama e com o pneu escorregando. Usada pela câmera 'cockpit' do camera.js.
import * as T from 'three';

export const PP = {
  fov: 86,                 // graus (a câmera do capacete é grande-angular)
  perto: 0.06,             // m: plano de corte perto (o volante fica a ~0,4 m do olho)
  olhaBaixo: 0.44,         // rad (~25°) abaixo da frente do kart
  recuo: [0, 0.07, -0.1],  // m no quadro do kart (x esquerda, y cima, z frente): um pouco acima e atrás do olho, no capacete
  cabeca: { lado: 0.03, frente: 0.025, inclina: 0.045, suave: 6 },   // por g de força: m, m, rad; suavização (1/s)
  tremor: { base: 0.0006, zebra: 0.004, grama: 0.01, escorrega: 0.05 }, // m de tremor (escorrega: por rad de deriva da traseira)
  re: { olha: 0.5, olho: [0, 0.1, 0.1] },  // de ré: a vista vai com a cabeça do piloto debruçado (olho = cabeça + isto, no quadro do kart) e olha mais para baixo
  corpo: { lado: 0.16, inclina: 0.14 }     // na curva (msg 018): com o corpo todo jogado para dentro (k.peso = ±1), a cabeça vai m para dentro e inclina rad
};

// Poses puras (sem three), testadas no Node: deslocamento da cabeça (no quadro do kart) e inclinação pela força G.
export function cabecaPelaForca(gLado, gFrente, P = PP, peso = 0) {
  // gLado > 0: curva para a esquerda (a força joga para a direita: −x); gFrente < 0: freada (a cabeça vai para a frente).
  // peso (−1 a 1, da física, + = esquerda): o piloto joga o corpo para dentro da curva, contra a força (msg 018)
  return { x: -gLado * P.cabeca.lado + peso * P.corpo.lado, z: -gFrente * P.cabeca.frente, roll: gLado * P.cabeca.inclina - peso * P.corpo.inclina };
}

export function tremorDoPiso(k, P = PP) {
  let a = P.tremor.base;
  if ((k.grip ?? 1) < 0.999) a += P.tremor.zebra;
  if ((k.gripTras ?? 1) < 0.9) a += P.tremor.grama;
  a += Math.min(0.4, Math.abs(k.slipR || 0)) * P.tremor.escorrega * Math.min(1, (k.v || 0) / 8);
  return a;
}

export class PrimeiraPessoa {
  constructor(olho, P = PP) {
    this.olho = olho;
    this.P = P;
    this.gLado = 0;
    this.gFrente = 0;
    this._qK = new T.Quaternion();
    this._qC = new T.Quaternion();
    this._e = new T.Euler();
    this._v = new T.Vector3();
    this.pos = new T.Vector3();
    this.quat = new T.Quaternion();
    this._fase = 0;
    this.re = 0;
  }

  // kart: o da física (x, z globais, y, yaw, arfagem, rolagem, vx, r, ax); origem: a do desenho
  pose(kart, origem, dt) {
    const P = this.P, g = 9.81, f = 1 - Math.exp(-dt * P.cabeca.suave);
    const gLado = ((kart.vx || 0) * (kart.r || 0)) / g, gFrente = (kart.ax || 0) / g;
    this.gLado += (Math.max(-2.5, Math.min(2.5, gLado)) - this.gLado) * f;
    this.gFrente += (Math.max(-2, Math.min(2, gFrente)) - this.gFrente) * f;
    const c = cabecaPelaForca(this.gLado, this.gFrente, P, kart.peso || 0);
    // de ré o piloto se debruça nas rodas da frente: a vista vai junto, para a frente, para baixo e olhando as mãos
    this.re += ((kart.re ? 1 : 0) - this.re) * Math.min(1, dt * 6);

    // tremor: soma de senos rápidos (não pisca de quadro a quadro como um aleatório puro)
    this._fase += dt * (18 + (kart.v || 0) * 1.5);
    const a = tremorDoPiso(kart, P), tx = a * Math.sin(this._fase * 1.7), ty = a * Math.sin(this._fase * 2.3 + 1.1);
    const [ox, oy, oz] = this.olho;
    // (o chassi torcendo na curva já vem em kart.y e kart.rolagem, msg 018)
    this._qK.setFromEuler(this._e.set(-(kart.arfagem || 0), kart.yaw || 0, kart.rolagem || 0, 'YXZ'));
    this._v.set(ox + P.recuo[0] + c.x + tx, oy + P.recuo[1] + ty, oz + P.recuo[2] + c.z).applyQuaternion(this._qK);
    this.pos.set(kart.x - origem.x, kart.y || 0, kart.z - origem.z).add(this._v);
    // debruçado (ré): o olho vai para a cabeça de verdade do piloto (pilotos.js põe em kart.cabeca3d), aos poucos
    if (this.re > 0.001 && kart.cabeca3d) {
      const [ex, ey, ez] = P.re.olho;
      this._w = (this._w || new T.Vector3()).set(ex, ey, ez).applyQuaternion(this._qK).add(kart.cabeca3d);
      this.pos.lerp(this._w, this.re);
    }
    // câmera do three olha para −Z: vira para a frente do kart (+Z), abaixa o olhar e inclina a cabeça com a curva
    this._qC.setFromEuler(this._e.set(-(P.olhaBaixo + P.re.olha * this.re), Math.PI, -c.roll, 'YXZ'));
    this.quat.copy(this._qK).multiply(this._qC);
    return { pos: this.pos, quat: this.quat };
  }
}
