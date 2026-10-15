// Câmeras: 'segue' (atrás do kart escolhido), 'cockpit' (olho do piloto), 'tv' (postes fixos em volta da pista, o mais
// perto do kart) e 'topo' (vista de cima, arrastar gira e a roda aproxima). Coordenadas locais: x leste, z sul, y cima.
import * as T from 'three';

export const MODOS = ['segue', 'cockpit', 'tv', 'topo'];

export class Camera {
  constructor(camera, dom, track, origem) {
    this.cam = camera;
    this.modo = 'segue';
    // olho do piloto no cockpit (x esquerda, y cima, z frente); o desenho provisório tem o capacete a 1,0 m, 0,2 m atrás
    this.olho = [0, 1.02, -0.12];
    this.centro = new T.Vector3(track.center.x - origem.x, 0, track.center.z - origem.z);
    this.alvo = new T.Vector3();
    this.pos = new T.Vector3();
    this.iniciou = false;
    // postes da TV: a cada 60 m, 14 m para fora da pista do lado de fora da curva mais próxima, 6 m de altura
    this.postes = [];
    const p = {};
    for (let s = 0; s < track.L; s += 60) {
      track.point(s, 0, p);
      const lado = Math.hypot(p.x - track.center.x - p.tz, p.z - track.center.z + p.tx) >
        Math.hypot(p.x - track.center.x + p.tz, p.z - track.center.z - p.tx) ? 1 : -1;
      track.point(s, lado * (track.hw + 14), p);
      this.postes.push(new T.Vector3(p.x - origem.x, 6, p.z - origem.z));
    }
    this.topo = { theta: 0.6, phi: 0.9, raio: 190 };
    let arrasta = null;
    dom.addEventListener('pointerdown', (e) => { arrasta = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('pointerup', () => { arrasta = null; });
    window.addEventListener('pointermove', (e) => {
      if (!arrasta || this.modo !== 'topo') return;
      this.topo.theta -= (e.clientX - arrasta.x) * 0.005;
      this.topo.phi = Math.min(1.45, Math.max(0.15, this.topo.phi - (e.clientY - arrasta.y) * 0.004));
      arrasta = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('wheel', (e) => {
      if (this.modo !== 'topo') return;
      e.preventDefault();
      this.topo.raio = Math.min(400, Math.max(40, this.topo.raio * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: false });
  }

  proximo() {
    this.modo = MODOS[(MODOS.indexOf(this.modo) + 1) % MODOS.length];
    this.iniciou = false;
  }

  update(dt, kart, origem) {
    const kx = kart.x - origem.x, kz = kart.z - origem.z, fx = Math.sin(kart.yaw), fz = Math.cos(kart.yaw);
    let pos, alvo;
    if (this.modo === 'segue') {
      pos = new T.Vector3(kx - fx * 4.6, 1.9, kz - fz * 4.6);
      alvo = new T.Vector3(kx + fx * 3, 0.6, kz + fz * 3);
    } else if (this.modo === 'cockpit') {
      // olho no quadro do kart (x esquerda, y cima, z frente): do contrato da arte, ou o do desenho provisório
      const [ox, oy, oz] = this.olho, lx = Math.cos(kart.yaw), lz = -Math.sin(kart.yaw);
      const ex = kx + lx * ox + fx * oz, ez = kz + lz * ox + fz * oz;
      pos = new T.Vector3(ex, oy, ez);
      alvo = new T.Vector3(ex + fx * 10, oy - 0.45, ez + fz * 10);
    } else if (this.modo === 'tv') {
      const k = new T.Vector3(kx, 0, kz);
      pos = this.postes.reduce((a, b) => (b.distanceToSquared(k) < a.distanceToSquared(k) ? b : a));
      alvo = new T.Vector3(kx, 0.5, kz);
    } else {
      if (this.auto) this.topo.theta += dt * 0.06;
      const { theta, phi, raio } = this.topo;
      pos = new T.Vector3(
        this.centro.x + raio * Math.sin(phi) * Math.sin(theta),
        raio * Math.cos(phi),
        this.centro.z + raio * Math.sin(phi) * Math.cos(theta)
      );
      alvo = this.centro;
    }
    const rapido = !this.iniciou || this.modo === 'tv' || this.modo === 'cockpit';
    const suave = rapido ? 1 : 1 - Math.exp(-dt * 8);
    this.pos.lerp(pos, suave);
    this.alvo.lerp(alvo, rapido ? 1 : 1 - Math.exp(-dt * 12));
    this.iniciou = true;
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.alvo);
  }
}
