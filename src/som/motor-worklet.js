// RCL-Karts · AudioWorklet de uma voz de kart: liga o MotorDSP (motor-dsp.js) ao Web Audio. Os parâmetros chegam
// pelos AudioParams (taxa k: um valor por bloco de 128 amostras; o DSP suaviza por amostra).
import { MotorDSP } from './motor-dsp.js';

class VozKart extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 1400, minValue: 0, maxValue: 12000, automationRate: 'k-rate' },
      { name: 'carga', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'eixo', defaultValue: 0, minValue: 0, maxValue: 6000, automationRate: 'k-rate' },
      { name: 'escorrega', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'vel', defaultValue: 0, minValue: 0, maxValue: 60, automationRate: 'k-rate' },
      { name: 'ganho', defaultValue: 1, minValue: 0, maxValue: 4, automationRate: 'k-rate' }
    ];
  }
  constructor(opcoes) {
    super();
    this.dsp = new MotorDSP(sampleRate, opcoes?.processorOptions || {});
    this.p = {};
  }
  process(_entradas, saidas, params) {
    const out = saidas[0], ch = out[0];
    if (!ch) return true;
    const p = this.p;
    p.rpm = params.rpm[0]; p.carga = params.carga[0]; p.eixo = params.eixo[0];
    p.escorrega = params.escorrega[0]; p.vel = params.vel[0]; p.ganho = params.ganho[0];
    this.dsp.processa(ch, ch.length, p);
    for (let c = 1; c < out.length; c++) out[c].set(ch);
    return true;
  }
}
registerProcessor('rcl-voz-kart', VozKart);
