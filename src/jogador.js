// Kart do jogador na corrida do RCL-Trânsito, sem editar o traffic-kart.js: o kart vira `player` (a IA não dirige
// ele, mas desvia dele e encosta nele como em qualquer kart) e recebe volante, acelerador e freio em `k.inp`.
// Sem three e sem DOM, para rodar nos testes.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Ajuda no volante, como a IA do RCL-Trânsito pilota: o comando (−1 a 1) é a curva que o jogador quer fazer (fração
// da aceleração lateral máxima). Vira uma taxa de guinada desejada; o volante é o ângulo geométrico dela mais a
// correção pela guinada real (cfg.giro; mais forte quando a traseira escorrega). Devagar, o comando vai direto ao
// volante (manobra).
export const AJUDA = { aderencia: 0.95, devagar: [3, 6] };

export function volanteAjudado(u, k, cfg, ajuda = AJUDA) {
  const v = Math.max(k.vx, 0), direto = u * cfg.volanteMax;
  if (v <= ajuda.devagar[0]) return direto;
  const rDes = (u * ajuda.aderencia * cfg.mu * cfg.g) / v;
  const giro = Math.abs(k.slipR || 0) > 0.08 ? cfg.giro * 1.8 : cfg.giro;
  const ajudado = clamp(Math.atan((cfg.entreEixos * rDes) / v) + giro * (rDes - k.r), -cfg.volanteMax, cfg.volanteMax);
  const t = clamp((v - ajuda.devagar[0]) / (ajuda.devagar[1] - ajuda.devagar[0]), 0, 1);
  return direto + (ajudado - direto) * t;
}

export class Jogador {
  constructor(race, indice) {
    this.race = race;
    this.k = race.karts[indice];
    this.k.player = true;
    this.k.inp = { volante: 0, acel: 0, freio: 0 };
    this.ajuda = true;
    this.fatorAcel = 1;   // jeito do kart (motor): ver karts.js
  }

  // ctrl: volante −1 (direita) a 1 (esquerda), acel e freio de 0 a 1
  aplica(ctrl) {
    const k = this.k, cfg = this.race.cfg, u = clamp(ctrl.volante, -1, 1);
    k.inp.volante = this.ajuda ? volanteAjudado(u, k, cfg) : u * cfg.volanteMax;
    k.inp.acel = clamp(ctrl.acel, 0, 1) * this.fatorAcel;
    k.inp.freio = clamp(ctrl.freio, 0, 1);
  }

  // Volta à pista: parado na linha de corrida, no ponto mais perto, virado no sentido da corrida. Se tiver kart
  // em cima, recua de 4 em 4 m (no máximo 40 m).
  devolve() {
    const race = this.race, T = race.track, k = this.k;
    let s = T.project(k.x, k.z, k.hint).s;
    for (let t = 0; t < 10; t++) {
      const P = T.point(s, race.lineD(s));
      const ocupado = race.karts.some((o) => o !== k && Math.hypot(o.x - P.x, o.z - P.z) < 2.5);
      if (!ocupado) break;
      s = T.wrap(s - 4);
    }
    const d = race.lineD(s), P = T.point(s, d), Q = T.point(s + 1, race.lineD(s + 1));
    Object.assign(k, {
      x: P.x, z: P.z, yaw: Math.atan2(Q.x - P.x, Q.z - P.z), vx: 0, vy: 0, r: 0, v: 0, delta: 0, ax: 0,
      s, d, hint: T.idx(s), trava: false
    });
    k.inp = { volante: 0, acel: 0, freio: 0 };
  }
}
