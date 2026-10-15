// RCL-Karts · o motor do kart para o som: Honda GX390 com embreagem centrífuga e transmissão direta por corrente (kart de
// aluguel não tem câmbio). JS puro, sem Web Audio: dá a rotação, a carga e se a embreagem está colada, a partir da
// velocidade do kart e do acelerador. Quem toca é o motor-dsp.js (no AudioWorklet).
//
// Fontes: GX390 com 8,7 kW a 3.600 rpm e 26,5 N·m a 2.500 rpm (ficha Honda); marcha lenta dos motores Honda GX de
// 1.400 ± 150 rpm (manual); embreagem de karts de lazer engatando ~200 rpm acima da lenta, até ~2.300 rpm (fórum
// 4cycle.com). O resto é ESTIMATIVA até o TrackNight passar a rpm e a relação do kart do KGV: governador a 3.850 rpm,
// pinhão 13 × coroa 30 (relação 2,31: ~86 km/h, o máximo das folhas, a ~3.770 rpm).
import { KART_ALUGUEL } from '../kart3d/medidas.js';

export const MOTOR_GX390 = Object.freeze({
  lenta: 1400,
  engata: 2200,        // a embreagem começa a pegar
  trava: 2700,         // a embreagem cola (sem patinar)
  estol: 2900,         // pé embaixo com o kart parado: o motor sobe até aqui e a embreagem patina
  max: 3850,           // governador
  pinhao: 13,
  coroa: 30,
  raioRoda: KART_ALUGUEL.pneuTras.diametro / 2,
  sobe: 0.12,          // s · constante de tempo do motor solto subindo de giro
  desce: 0.3           // s · descendo
});
export const relacao = (m = MOTOR_GX390) => m.coroa / m.pinhao;
// rotação do eixo traseiro (rpm) e a do motor que ela pede (colado), pela velocidade (m/s)
export const rpmEixo = (v, m = MOTOR_GX390) => (Math.max(0, v) / (2 * Math.PI * m.raioRoda)) * 60;
export const rpmDaRoda = (v, m = MOTOR_GX390) => rpmEixo(v, m) * relacao(m);
// velocidade (km/h) no governador
export const kmhNoMaximo = (m = MOTOR_GX390) => (m.max / relacao(m) / 60) * 2 * Math.PI * m.raioRoda * 3.6;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class MotorKart {
  constructor(m = MOTOR_GX390) {
    this.m = m;
    this.rpm = m.lenta;
    this.carga = 0;
    this.embreado = false;
    this.governador = 0;
  }

  // v: velocidade do kart (m/s); acel: 0..1
  update(dt, { v = 0, acel = 0 } = {}) {
    const m = this.m, roda = rpmDaRoda(v, m);
    acel = clamp(acel, 0, 1);
    // embreagem centrífuga, com histerese: cola acima de 'trava', solta abaixo de 'engata'
    if (this.embreado) { if (roda < m.engata - 100) this.embreado = false; }
    else if (roda >= m.trava || (roda >= m.engata && this.rpm <= roda + 50)) this.embreado = true;
    // solto ou patinando: o motor vai para a lenta ou sobe até a embreagem segurar; colado: segue a roda
    const livre = m.lenta + acel * (m.estol - m.lenta);
    let alvo = this.embreado ? roda : Math.max(livre, roda);
    alvo = Math.min(alvo, m.max + 40);
    const tau = this.embreado ? 0.03 : alvo > this.rpm ? m.sobe : m.desce;
    this.rpm += (alvo - this.rpm) * (1 - Math.exp(-dt / tau));
    // governador: perto do máximo fecha a borboleta
    this.governador = clamp((this.rpm - (m.max - 220)) / 220, 0, 1);
    // carga: com a embreagem pegando (patinando ou colada) o motor puxa o kart; abaixo dela gira solto
    const alvoCarga = acel * (1 - 0.85 * this.governador) * (this.embreado || this.rpm >= m.engata ? 1 : 0.5);
    this.carga += (alvoCarga - this.carga) * (1 - Math.exp(-dt / 0.05));
    return this;
  }

  get rpmEixo() { return this.rpm / relacao(this.m); }
}
