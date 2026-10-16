// RCL-Karts · desempenho (chat RCL-Karts, pedido do Xande, 16/10/2026: "bem mais leve, sem consumir tanto recurso").
// Duas peças usadas pelo main.js:
// - SombraQueSegue: a sombra do sol cobria a pista inteira (±140 m) e, por isso, todo quadro desenhava de novo, no passe
//   de sombra, os 20 karts, os 20 pilotos e as pilhas de pneus de longe (~2 milhões de triângulos). Agora a caixa da sombra
//   anda com a câmera (um quadrado de ~2 × meio m à frente dela): só o que está perto faz sombra, e com mais definição. A
//   caixa cresce com a altura da câmera (na câmera de cima, de novo a pista inteira). O centro anda em passos de um texel
//   do mapa de sombra, para a borda das sombras não tremer quando a câmera anda.
// - ResolucaoAdaptativa: se o quadro passa de `lento` ms por `espera` s, a resolução (pixel ratio) desce um `passo`; se fica
//   firme abaixo de `firme` ms por `sobe` s, tenta subir de novo. Cada vez que um nível fica lento, a espera para voltar a
//   ele dobra (não fica subindo e descendo).
import * as T from 'three';

export const DESEMPENHO = {
  sombra: { meio: 42, porAltura: 1.2, max: 150, frente: 0.45, mapa: 1024 },
  resolucao: { min: 0.6, max: 1.5, lento: 21, firme: 17.6, espera: 1.2, sobe: 6, passo: 0.15, suave: 0.1 }
};

export class SombraQueSegue {
  // sol: DirectionalLight já posicionado (a direção dele, sol.position − sol.target.position, fica a mesma)
  constructor(sol, P = DESEMPENHO.sombra) {
    this.sol = sol;
    this.P = P;
    this.desloc = sol.position.clone().sub(sol.target.position);
    // eixos da câmera da sombra (a mesma conta do lookAt): z = do alvo para o sol, x = cima × z, y = z × x
    this.ez = this.desloc.clone().normalize();
    this.ex = new T.Vector3(0, 1, 0).cross(this.ez).normalize();
    this.ey = this.ez.clone().cross(this.ex).normalize();
    this.meioAtual = null;
    this._f = new T.Vector3();
    this._d = new T.Vector3();
  }

  // camera: a câmera do jogo (no quadro do desenho)
  update(camera) {
    const P = this.P, c = this.sol.shadow.camera, alt = Math.max(0, camera.position.y);
    const meio = Math.min(P.max, P.meio + alt * P.porAltura);
    // foco: no chão, um pouco à frente da câmera (onde está o que ela vê de perto)
    camera.getWorldDirection(this._d);
    this._d.y = 0;
    if (this._d.lengthSq() > 1e-6) this._d.normalize();
    this._f.copy(camera.position).addScaledVector(this._d, meio * P.frente);
    this._f.y = 0;
    // passo de um texel nos eixos da sombra
    const texel = (2 * meio) / P.mapa, a = Math.round(this._f.dot(this.ex) / texel) * texel, b = Math.round(this._f.dot(this.ey) / texel) * texel;
    const zz = this._f.dot(this.ez);
    this._f.copy(this.ex).multiplyScalar(a).addScaledVector(this.ey, b).addScaledVector(this.ez, zz);
    this.sol.target.position.copy(this._f);
    this.sol.position.copy(this._f).add(this.desloc);
    this.sol.target.updateMatrixWorld();
    if (this.meioAtual == null || Math.abs(meio - this.meioAtual) > texel) {
      Object.assign(c, { left: -meio, right: meio, top: meio, bottom: -meio });
      c.updateProjectionMatrix();
      this.meioAtual = meio;
    }
  }
}

export class ResolucaoAdaptativa {
  constructor(renderer, P = DESEMPENHO.resolucao) {
    this.r = renderer;
    this.P = P;
    this.maximo = Math.min(globalThis.devicePixelRatio || 1, P.max);
    this.falhas = new Map();   // nível (em passos) → vezes que ficou lento
    this.atual = this.maximo;
    this.ms = 16.7;
    this.tLento = 0;
    this.tFirme = 0;
    renderer.setPixelRatio(this.atual);
  }

  // dt: s entre um quadro e outro (o de verdade)
  quadro(dt) {
    const P = this.P;
    if (!(dt > 0) || dt > 0.5) return;   // (aba escondida, pausa do navegador)
    this.ms += (dt * 1000 - this.ms) * P.suave;
    this.tLento = this.ms > P.lento ? this.tLento + dt : 0;
    this.tFirme = this.ms < P.firme ? this.tFirme + dt : 0;
    const nivel = (v) => Math.round(v / P.passo);
    if (this.tLento > P.espera && this.atual > P.min + 1e-6) {
      this.falhas.set(nivel(this.atual), (this.falhas.get(nivel(this.atual)) || 0) + 1);
      this.muda(this.atual - P.passo);
    } else if (this.atual + 1e-6 < this.maximo) {
      const prox = Math.min(this.maximo, this.atual + P.passo);
      if (this.tFirme > P.sobe * 2 ** Math.min(5, this.falhas.get(nivel(prox)) || 0)) this.muda(prox);
    }
  }

  muda(v) {
    this.atual = Math.max(this.P.min, Math.min(this.maximo, v));
    this.r.setPixelRatio(this.atual);
    this.tLento = 0;
    this.tFirme = 0;
  }
}
