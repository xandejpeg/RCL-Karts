// RCL-Karts · o som da corrida no navegador (Web Audio): uma voz de motor para o kart do jogador e para os karts mais
// perto do ouvinte (6 vozes por padrão), cada uma com posição 3D (PannerNode) e Doppler (o giro sobe chegando e desce
// indo embora). O ouvinte é a câmera. Cada kart tem o seu MotorKart (rotação, embreagem, carga) pela velocidade e pelo
// acelerador; o pneu canta pelo escorregamento (slipR/slipF do traffic-kart.js).
// Uso:
//   const som = new SomKarts();
//   botão → await som.liga()        (o navegador só deixa tocar depois de um clique ou tecla)
//   por quadro → som.update(dt, karts, { camera, origem, jogador })
//   som.volume(0..1), som.mudo(true/false), som.desliga()
import { MotorKart } from './motor.js';
import { PONTOS } from '../kart3d/medidas.js';

const C_SOM = 343;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class SomKarts {
  constructor({ vozes = 6, volume = 0.8 } = {}) {
    this.nVozes = vozes; this.vol = volume; this.ctx = null; this.vozes = []; this.motores = new WeakMap(); this.ligado = false;
  }

  async liga() {
    if (this.ligado) { await this.ctx.resume(); return this; }
    const ctx = this.ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(new URL('./motor-worklet.js', import.meta.url));
    this.master = new GainNode(ctx, { gain: this.vol });
    const comp = new DynamicsCompressorNode(ctx, { threshold: -14, knee: 8, ratio: 4, attack: 0.004, release: 0.2 });
    this.master.connect(comp).connect(ctx.destination);
    for (let i = 0; i < this.nVozes; i++) {
      const no = new AudioWorkletNode(ctx, 'rcl-voz-kart', { numberOfInputs: 0, outputChannelCount: [1], processorOptions: { semente: 11 + i * 7 } });
      const g = new GainNode(ctx, { gain: 0 });
      const pan = new PannerNode(ctx, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 3, rolloffFactor: 1.15, maxDistance: 500 });
      no.connect(g).connect(pan).connect(this.master);
      this.vozes.push({ no, g, pan, kart: null, ultimo: null, P: (n) => no.parameters.get(n) });
    }
    await ctx.resume();
    this.ligado = true;
    return this;
  }

  volume(v) { this.vol = clamp(v, 0, 1); if (this.master) this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.05); }
  mudo(sim) { if (this.ctx) (sim ? this.ctx.suspend() : this.ctx.resume()); }
  async desliga() { if (this.ctx) await this.ctx.close(); this.ctx = null; this.vozes = []; this.ligado = false; }

  // motor de cada kart (anda mesmo sem voz, para a rotação estar certa quando a voz chegar)
  motor(k) { let m = this.motores.get(k); if (!m) { m = new MotorKart(); this.motores.set(k, m); } return m; }

  // karts: os da corrida (x, z, yaw, vx, vy, inp.acel, slipR, slipF); camera: THREE.Camera (posição no desenho);
  // origem: a origem do desenho (o kart em k.x − origem.x); jogador: o kart do jogador (sempre tem voz)
  update(dt, karts, { camera, origem = { x: 0, z: 0 }, jogador = null } = {}) {
    for (const k of karts) this.motor(k).update(dt, { v: Math.hypot(k.vx || 0, k.vy || 0), acel: k.inp?.acel ?? 0 });
    if (!this.ligado || !camera) return;
    const ctx = this.ctx, t = ctx.currentTime, L = ctx.listener, cp = camera.position;
    // ouvinte = câmera
    const fw = camera.getWorldDirection(this._f ??= cp.clone()), up = (this._u ??= camera.up.clone()).copy(camera.up).applyQuaternion(camera.quaternion), suave = 0.03;
    if (L.positionX) {
      L.positionX.setTargetAtTime(cp.x, t, suave); L.positionY.setTargetAtTime(cp.y, t, suave); L.positionZ.setTargetAtTime(cp.z, t, suave);
      L.forwardX.setTargetAtTime(fw.x, t, suave); L.forwardY.setTargetAtTime(fw.y, t, suave); L.forwardZ.setTargetAtTime(fw.z, t, suave);
      L.upX.setTargetAtTime(up.x, t, suave); L.upY.setTargetAtTime(up.y, t, suave); L.upZ.setTargetAtTime(up.z, t, suave);
    } else { L.setPosition(cp.x, cp.y, cp.z); L.setOrientation(fw.x, fw.y, fw.z, up.x, up.y, up.z); }
    // de onde sai o som de cada kart: o motor (à direita, atrás do piloto)
    const ondeSom = (k) => { const s = Math.sin(k.yaw || 0), c = Math.cos(k.yaw || 0), M = PONTOS.motor;
      return { x: k.x - origem.x + s * M.z + c * M.x, y: (k.y || 0) + M.y, z: k.z - origem.z + c * M.z - s * M.x }; };
    // quem tem voz: o jogador e os mais perto da câmera (quem já tem voz fica com ela se ainda estiver entre os 2 a mais)
    const dist = new Map(karts.map((k) => { const p = ondeSom(k); return [k, Math.hypot(p.x - cp.x, p.y - cp.y, p.z - cp.z)]; }));
    const ordem = [...karts].sort((a, b) => (a === jogador ? -1 : b === jogador ? 1 : dist.get(a) - dist.get(b)));
    const quer = new Set(ordem.slice(0, this.nVozes)), aceita = new Set(ordem.slice(0, this.nVozes + 2));
    const livres = [];
    for (const v of this.vozes) { if (v.kart && aceita.has(v.kart) && karts.includes(v.kart)) quer.delete(v.kart); else { v.kart = null; livres.push(v); } }
    for (const k of quer) { const v = livres.shift(); if (!v) break; v.kart = k; v.ultimo = null; v.g.gain.setValueAtTime(0, t); }
    for (const v of livres) v.g.gain.setTargetAtTime(0, t, 0.08);
    for (const v of this.vozes) {
      const k = v.kart; if (!k) continue;
      const m = this.motor(k), p = ondeSom(k);
      // Doppler: velocidade com que a fonte se aproxima do ouvinte (pela posição do quadro anterior)
      let fator = 1;
      if (v.ultimo && dt > 0) {
        const dx = p.x - cp.x, dy = p.y - cp.y, dz = p.z - cp.z, d = Math.hypot(dx, dy, dz) || 1;
        const vr = ((v.ultimo.x - p.x) * dx + (v.ultimo.y - p.y) * dy + (v.ultimo.z - p.z) * dz) / d / dt;   // + = chegando
        fator = clamp(C_SOM / (C_SOM - clamp(vr, -60, 60)), 0.8, 1.25);
      }
      v.ultimo = p;
      v.pan.positionX.setTargetAtTime(p.x, t, suave); v.pan.positionY.setTargetAtTime(p.y, t, suave); v.pan.positionZ.setTargetAtTime(p.z, t, suave);
      const P = v.P;
      P('rpm').setTargetAtTime(m.rpm * fator, t, suave);
      P('carga').setTargetAtTime(m.carga, t, suave);
      P('eixo').setTargetAtTime(m.embreado ? m.rpmEixo : Math.hypot(k.vx || 0, k.vy || 0) / (2 * Math.PI * m.m.raioRoda) * 60, t, suave);
      P('escorrega').setTargetAtTime(clamp((Math.max(Math.abs(k.slipR || 0), Math.abs(k.slipF || 0) * 0.8) - 0.06) / 0.12, 0, 1) * clamp(Math.hypot(k.vx || 0, k.vy || 0) / 8, 0, 1), t, suave);
      P('vel').setTargetAtTime(Math.hypot(k.vx || 0, k.vy || 0), t, suave);
      v.g.gain.setTargetAtTime(k === jogador ? 1.25 : 1, t, 0.06);
    }
  }
}
