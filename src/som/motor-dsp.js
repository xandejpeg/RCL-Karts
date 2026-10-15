// RCL-Karts · síntese do som do kart, amostra por amostra (JS puro: roda no AudioWorklet e nos testes do Node).
// Nada gravado e nada de outro jogo: o som sai do ciclo do motor.
//
// Motor monocilíndrico 4 tempos: uma explosão a cada 2 voltas do virabrequim (a 1.400 rpm, 11,7 por segundo; a 3.800,
// 32). Cada explosão solta um pulso de pressão no escape (sobe rápido e cai), com variação de ciclo para ciclo (maior na
// lenta: o "pô-pô-pô" irregular). O pulso passa por um tubo (guia de onda: ida e volta com reflexão negativa na ponta
// aberta, ressonâncias em c/4L) e pelo silencioso (realce grave e um médio, corte dos agudos). Tirando o pé em giro alto a
// combustão fica fraca e às vezes estala no escape. Por cima: admissão (chiado na hora da aspiração, com o pé), tique das
// válvulas, a corrente na frequência dos dentes da coroa, o pneu cantando quando escorrega, rolagem e vento.
import { MOTOR_GX390 } from './motor.js';

// filtro biquad (RBJ), forma direta II transposta
export class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.z1 = 0; this.z2 = 0; }
  _set(b0, b1, b2, a0, a1, a2) { this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this; }
  passaBaixa(sr, f, q) { const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q); return this._set((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al); }
  passaAlta(sr, f, q) { const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q); return this._set((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al); }
  passaBanda(sr, f, q) { const w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q); return this._set(al, 0, -al, 1 + al, -2 * c, 1 - al); }
  pico(sr, f, q, db) { const A = Math.pow(10, db / 40), w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q); return this._set(1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A); }
  proc(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}

function xorshift(s) { let x = (s >>> 0) || 0x9e3779b9; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

export const SOM = Object.freeze({
  tubo: { comprimento: 0.9, c: 480, reflexao: -0.5, perda: 0.45 },   // escape (m, m/s de gás quente)
  silencioso: [[110, 1.2, 7], [640, 1.5, 3]],                          // realces (Hz, Q, dB)
  corte: 2200,                                                         // Hz · o silencioso corta acima disso
  pulso: { fracao: 0.06, min: 0.0008, max: 0.004 },                     // largura do pulso: fração do ciclo (s)
  irregular: { base: 0.05, lenta: 0.09 },                               // variação de ciclo a ciclo
  estalo: { chance: 0.08, rpm: 2300 },                                  // tirando o pé acima desse giro
  mix: { escape: 0.3, mecanica: 0.05, admissao: 0.06, valvula: 0.012, corrente: 0.03, pneu: 0.22, rolagem: 0.05, vento: 0.035 }
});

export class MotorDSP {
  constructor(sr = 48000, { semente = 1, motor = MOTOR_GX390, som = SOM } = {}) {
    this.sr = sr; this.m = motor; this.s = som;
    this.rnd = xorshift(semente * 2654435761);
    this.fase = this.rnd(); this.rpm = motor.lenta; this.carga = 0; this.eixo = 0; this.esc = 0; this.vel = 0; this.ganho = 1;
    this.tp = 1; this.A = 0; this.tau = 0.002; this.popT = -1; this.popA = 0; this.popD = 0; this.tique = 1; this.q = -1;
    const t = som.tubo;
    this.D = Math.max(8, Math.round((2 * t.comprimento / t.c) * sr));
    this.linha = new Float32Array(this.D); this.li = 0; this.lp = 0;
    this.silencioso = som.silencioso.map(([f, q, db]) => new Biquad().pico(sr, f, q, db));
    this.corte = new Biquad().passaBaixa(sr, som.corte, 0.7);
    this.dc = new Biquad().passaAlta(sr, 28, 0.7);
    this.fAdm = new Biquad().passaBanda(sr, 320, 1.4);
    this.fTique = new Biquad().passaAlta(sr, 3500, 0.7);
    this.fCorrente = new Biquad().passaBanda(sr, 800, 4);
    this.fPneu = new Biquad().passaBanda(sr, 2300, 2.5);
    this.fPneuTom = new Biquad().passaBanda(sr, 1150, 12);
    this.fRol = new Biquad().passaBaixa(sr, 240, 0.7);
    this.fSopro = new Biquad().passaBanda(sr, 1800, 0.8);
    this.fMec = new Biquad().passaBaixa(sr, 700, 0.7);
    this.deriva = 0;
    this.fVento = new Biquad().passaAlta(sr, 900, 0.7);
    this.faseCorr = 0; this.fasePneu = 0; this.vib = 0;
  }

  gauss() { let u = 0, v = 0; while (!u) u = this.rnd(); while (!v) v = this.rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  // uma explosão: pulso novo no escape
  explode() {
    const m = this.m, s = this.s, lentaF = Math.max(0, 1 - (this.rpm - m.lenta) / 1500);
    const jit = 1 + this.gauss() * (s.irregular.base + s.irregular.lenta * lentaF);
    const fraca = this.carga < 0.06 && this.rpm > s.estalo.rpm;   // desacelerando com o motor puxado pela roda
    // mais giro, mais forte (o pulso fica mais curto e a energia por segundo tem de subir com a rotação)
    this.A = Math.max(0, (fraca ? 0.16 : 0.38 + 0.62 * this.carga) * jit * Math.pow(Math.max(600, this.rpm) / 2900, 0.8));
    this.tau = Math.min(s.pulso.max, Math.max(s.pulso.min, s.pulso.fracao * (120 / Math.max(300, this.rpm))));
    this.tp = 0;
    if (fraca && this.popT < 0 && this.rnd() < s.estalo.chance) { this.popT = 0; this.popD = 0.004 + 0.01 * this.rnd(); this.popA = 0.8 + 0.7 * this.rnd(); }
  }

  // enche out[0..n) · p: { rpm, carga, eixo (rpm do eixo traseiro), escorrega 0..1, vel (m/s), ganho }
  processa(out, n, p) {
    const sr = this.sr, s = this.s, mx = s.mix, dt = 1 / sr, k = 1 - Math.exp(-dt / 0.02);
    const rpmA = p.rpm ?? this.rpm, cargaA = p.carga ?? this.carga, escA = Math.min(1, Math.max(0, p.escorrega ?? 0));
    const velA = p.vel ?? 0, eixoA = p.eixo ?? 0, ganhoA = p.ganho ?? 1, coroa = this.m.coroa;
    for (let i = 0; i < n; i++) {
      this.rpm += (rpmA - this.rpm) * k; this.carga += (cargaA - this.carga) * k; this.esc += (escA - this.esc) * k;
      this.vel += (velA - this.vel) * k; this.eixo += (eixoA - this.eixo) * k; this.ganho += (ganhoA - this.ganho) * k;
      // ciclo do motor (0..1 = duas voltas)
      this.fase += (this.rpm / 60 / 2) * dt;
      if (this.fase >= 1) { this.fase -= 1; this.explode(); }
      const ruido = this.rnd() * 2 - 1;
      // pulso de escape e estalo
      this.tp += dt;
      let pr = 0;
      // pulso: subida rápida (0,25 ms) e queda pela largura do ciclo, mais o ruído turbulento da abertura da válvula
      const rb = this.fSopro.proc(ruido);
      if (this.tp < 0.06) { const env = Math.exp(-this.tp / this.tau); pr = this.A * (1 - Math.exp(-this.tp / 0.00025)) * env * 1.6 + this.A * 0.55 * rb * Math.exp(-this.tp / (this.tau * 0.7)); }
      if (this.popT >= 0) {
        this.popT += dt;
        const t = this.popT - this.popD;
        if (t > 0) { const x = t / 0.0005; pr += this.popA * (x * Math.exp(1 - x) + 0.25 * ruido * Math.exp(-t / 0.004)); }
        if (t > 0.03) this.popT = -1;
      }
      // tubo: ida e volta com reflexão na ponta e perda (passa-baixa no laço)
      const volta = this.linha[this.li];
      this.lp += (volta - this.lp) * s.tubo.perda;
      const y = pr + s.tubo.reflexao * this.lp;
      this.linha[this.li] = y; this.li = (this.li + 1) % this.D;
      let e = y;
      for (const f of this.silencioso) e = f.proc(e);
      e = this.corte.proc(e);
      // admissão: chiado na aspiração (último quarto do ciclo), com o pé
      const fa = this.fase - 0.75, ra = this.fAdm.proc(ruido), adm = fa > 0 ? Math.sin((fa / 0.25) * Math.PI) * ra * (0.2 + 0.8 * this.carga) : 0;
      // tique das válvulas (abre o escape em 0,5 e a admissão em 0,75 do ciclo)
      const q = Math.floor(this.fase * 4);
      if (q !== this.q) { this.q = q; this.tique = 0; } else this.tique += dt;
      const tq = this.fTique.proc(this.tique < 0.0015 && q >= 2 ? ruido : 0);
      // corrente: dente de serra na frequência dos dentes da coroa
      this.faseCorr += (coroa * this.eixo / 60) * dt; if (this.faseCorr >= 1) this.faseCorr -= Math.floor(this.faseCorr);
      const corr = this.fCorrente.proc(2 * this.faseCorr - 1 + 0.4 * ruido) * Math.min(1, this.eixo / 300);
      // pneu cantando: tom que oscila + ruído agudo, pelo quanto escorrega
      // (tom que deriva devagar, sem vibrato regular, e muito ruído: borracha esfregando)
      this.deriva += (ruido * 0.02 - this.deriva * 0.0005); this.vib += dt;
      this.fasePneu += (1100 + 900 * this.deriva + 18 * Math.sin(this.vib * 31)) * dt; if (this.fasePneu >= 1) this.fasePneu -= 1;
      const pe = this.esc * this.esc, pneu = (0.35 * this.fPneuTom.proc(Math.sin(this.fasePneu * 6.283) + 0.6 * ruido) * 5 + 0.8 * this.fPneu.proc(ruido)) * pe;
      // mecânica do motor: ruído grave contínuo, mais forte logo depois da explosão e com o pé
      const mec = this.fMec.proc(ruido) * (0.35 + 0.65 * this.carga) * (0.4 + 0.6 * Math.exp(-this.tp / 0.012)) * Math.min(1, this.rpm / 2500);
      // rolagem (grave) e vento (agudo), pela velocidade
      const vv = Math.min(1.3, this.vel / 24), rol = this.fRol.proc(ruido) * vv, vento = this.fVento.proc(ruido) * vv * vv;
      let x = mx.escape * e + mx.mecanica * mec + mx.admissao * adm + mx.valvula * tq + mx.corrente * corr + mx.pneu * pneu + mx.rolagem * rol + mx.vento * vento;
      x = this.dc.proc(x) * this.ganho;
      out[i] = Math.tanh(x * 1.3) / 1.3;
    }
    return out;
  }
}
