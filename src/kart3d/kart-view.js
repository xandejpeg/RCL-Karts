// RCL-Karts · desenho dos karts com o modelo novo (kart-modelo.js), no lugar do provisório de caixas do RCL-Trânsito.
// Mesma API do KartView (vendor/rcl-transito/traffic-kart-view.js), para trocar no main.js sem mexer em mais nada:
//   new KartView3D(scene, { capacity }), sync(karts, origem), hide(), drawCalls(), dispose()
// Uma InstancedMesh por peça e material para todos os karts (~20 chamadas de desenho para o grid inteiro). Por kart:
// cor da pintura (dr.cor), do macacão (dr.macacao, ou a pintura escurecida) e do capacete (dr.capacete, ou a pintura);
// número nas placas (dr.numero, 002 a 072) por um atlas de números; rodas girando pelo caminho andado (odo) e as da frente
// esterçando (delta); volante girando ~3:1; a carroceria inclina um pouco pela aceleração de lado e de frente.
import * as T from 'three';
import { montaKart, EIXO_VOLANTE, RELACAO_VOLANTE } from './kart-modelo.js';
import { RODAS, PONTOS, KART_ALUGUEL } from './medidas.js';

// atlas dos números: 8 colunas × 9 linhas (002 a 072 → célula numero − 2)
export const ATLAS = { colunas: 8, linhas: 9, celW: 160, celH: 100 };
export const celulaDoNumero = (n) => Math.max(0, Math.min(ATLAS.colunas * ATLAS.linhas - 1, Math.round(n) - KART_ALUGUEL.numeros.de));

function desenhaAtlas(canvas) {
  const { colunas, linhas, celW, celH } = ATLAS, ctx = canvas.getContext('2d');
  canvas.width = colunas * celW; canvas.height = linhas * celH;
  ctx.fillStyle = '#f4f4f6'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < colunas * linhas; i++) {
    const x = (i % colunas) * celW, y = Math.floor(i / colunas) * celH, n = i + KART_ALUGUEL.numeros.de;
    ctx.fillStyle = '#f4f4f6'; ctx.fillRect(x, y, celW, celH);
    ctx.strokeStyle = '#0e0e12'; ctx.lineWidth = 8; ctx.strokeRect(x + 6, y + 6, celW - 12, celH - 12);
    ctx.fillStyle = '#0e0e12'; ctx.font = `italic 800 ${Math.round(celH * 0.72)}px "Barlow Condensed", "Arial Narrow", Arial, sans-serif`;
    ctx.fillText(String(n).padStart(3, '0'), x + celW / 2, y + celH / 2 + 3);
  }
}

function materiais() {
  const M = (o) => new T.MeshStandardMaterial(o);
  return {
    pintura: M({ color: 0xffffff, roughness: 0.32, metalness: 0.05 }),
    preto: M({ color: 0x1b1b20, roughness: 0.72, metalness: 0 }),
    metal: M({ color: 0xb4b9c0, roughness: 0.34, metalness: 0.45 }),
    banco: M({ color: 0x121215, roughness: 0.28, metalness: 0.05, side: T.DoubleSide }),
    motor: M({ color: 0xa3a7ad, roughness: 0.42, metalness: 0.4 }),
    escuro: M({ color: 0x2c2e33, roughness: 0.55, metalness: 0.2 }),
    pneu: M({ color: 0x151515, roughness: 0.9, metalness: 0 }),
    aro: M({ color: 0xc8cbd1, roughness: 0.3, metalness: 0.5 }),
    volante: M({ color: 0x1c1c20, roughness: 0.5, metalness: 0.1 }),
    macacao: M({ color: 0xffffff, roughness: 0.78, metalness: 0 }),
    capacete: M({ color: 0xffffff, roughness: 0.22, metalness: 0.1 }),
    pilotoEscuro: M({ color: 0x0c0c0f, roughness: 0.18, metalness: 0.35 })
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class KartView3D {
  constructor(scene, { capacity = 24, sombra = true } = {}) {
    this.group = new T.Group();
    this.group.name = 'RCL-Karts:karts';
    scene.add(this.group);
    this.cap = capacity;
    const modelo = this.modelo = montaKart(), mat = this.mat = materiais(), cap = capacity;
    const inst = (geom, material, n, nome, { cor = false, sombraRecebe = false } = {}) => {
      const m = new T.InstancedMesh(geom, material, n);
      m.name = 'RCL-Karts:' + nome; m.count = 0; m.frustumCulled = false;
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.castShadow = sombra; m.receiveShadow = sombraRecebe;
      if (cor) { m.setColorAt(0, new T.Color(1, 1, 1)); m.instanceColor.setUsage(T.DynamicDrawUsage); }
      this.group.add(m);
      return m;
    };
    this.corpo = Object.entries(modelo.corpo).map(([k, g]) => inst(g, mat[k], cap, k, { cor: k === 'pintura', sombraRecebe: k === 'pintura' || k === 'banco' }));
    this.pintura = this.corpo[Object.keys(modelo.corpo).indexOf('pintura')];
    this.rodas = {
      frente: { pneu: inst(modelo.rodas.frente.pneu, mat.pneu, cap * 2, 'pneu-frente'), aro: inst(modelo.rodas.frente.aro, mat.aro, cap * 2, 'aro-frente') },
      tras: { pneu: inst(modelo.rodas.tras.pneu, mat.pneu, cap * 2, 'pneu-tras'), aro: inst(modelo.rodas.tras.aro, mat.aro, cap * 2, 'aro-tras') }
    };
    this.volante = inst(modelo.volante, mat.volante, cap, 'volante');
    this.piloto = {
      macacao: inst(modelo.piloto.macacao, mat.macacao, cap, 'macacao', { cor: true }),
      capacete: inst(modelo.piloto.capacete, mat.capacete, cap, 'capacete', { cor: true }),
      escuro: inst(modelo.piloto.escuro, mat.pilotoEscuro, cap, 'piloto-escuro')
    };
    // placas de número: um quadrado por placa, com o número de cada instância lido do atlas no shader
    this.placasDef = modelo.placas.map((p) => ({ ...p, M: new T.Matrix4().compose(new T.Vector3(...p.pos), new T.Quaternion().setFromEuler(new T.Euler(...p.rot)), new T.Vector3(p.w, p.h, 1)) }));
    const gPlaca = new T.PlaneGeometry(1, 1), nPlacas = cap * this.placasDef.length;
    this.aNumero = new T.InstancedBufferAttribute(new Float32Array(nPlacas), 1);
    this.aNumero.setUsage(T.DynamicDrawUsage);
    gPlaca.setAttribute('aNumero', this.aNumero);
    const matPlaca = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      desenhaAtlas(canvas);
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      matPlaca.map = tex;
      document.fonts?.ready?.then(() => { desenhaAtlas(canvas); tex.needsUpdate = true; });
    }
    const { colunas, linhas } = ATLAS;
    matPlaca.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aNumero;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
  { float c = mod(aNumero, ${colunas}.0), r = floor(aNumero / ${colunas}.0);
    vMapUv = vec2((c + vMapUv.x) / ${colunas}.0, 1.0 - (r + 1.0 - vMapUv.y) / ${linhas}.0); }
#endif`);
    };
    mat.placa = matPlaca;
    this.placas = inst(gPlaca, matPlaca, nPlacas, 'placas');
    this.placas.castShadow = false;
    // pivô do volante: no centro dele, com o eixo +z do volante ao longo da coluna
    this.Mvol = new T.Matrix4().compose(new T.Vector3(PONTOS.volante.x, PONTOS.volante.y, PONTOS.volante.z),
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(...EIXO_VOLANTE)), new T.Vector3(1, 1, 1));
    this.eixoVol = new T.Vector3(0, 0, 1);
    this.estado = new WeakMap();
    this._M = new T.Matrix4(); this._B = new T.Matrix4(); this._W = new T.Matrix4(); this._R = new T.Matrix4(); this._q = new T.Quaternion();
    this._p = new T.Vector3(); this._s = new T.Vector3(1, 1, 1); this._y = new T.Vector3(0, 1, 0); this._c = new T.Color(); this._e = new T.Euler();
  }

  // karts: os da corrida (x, y, z globais, yaw, delta, odo, vx, r, ax, dr.cor, dr.capacete, dr.numero); origem: a do desenho
  sync(karts, origem = { x: 0, z: 0 }) {
    const n = Math.min(karts.length, this.cap), M = this._M, B = this._B, W = this._W, R = this._R, c = this._c, np = this.placasDef.length;
    for (let i = 0; i < n; i++) {
      const k = karts[i];
      let st = this.estado.get(k);
      if (!st) { st = { roll: 0, pitch: 0 }; this.estado.set(k, st); }
      // inclinação: rola para fora na curva e mergulha na freada (pouco: kart é duro), suavizada
      const ay = (k.vx || 0) * (k.r || 0), ax = k.ax || 0;
      st.roll += (clamp(0.0028 * ay, -0.045, 0.045) - st.roll) * 0.2;
      st.pitch += (clamp(-0.0022 * ax, -0.03, 0.03) - st.pitch) * 0.2;
      this._p.set(k.x - origem.x, k.y || 0, k.z - origem.z);
      this._q.setFromEuler(this._e.set(-(k.arfagem || 0), k.yaw || 0, k.rolagem || 0, 'YXZ'));   // (relevo)
      M.compose(this._p, this._q, this._s);
      B.copy(M).multiply(R.makeRotationFromEuler(this._e.set(st.pitch, 0, st.roll, 'ZXY')));
      for (const m of this.corpo) m.setMatrixAt(i, B);
      const cor = k.dr?.cor ?? 0xe10600;
      this.pintura.setColorAt(i, c.setHex(cor));
      this.piloto.macacao.setMatrixAt(i, B); this.piloto.capacete.setMatrixAt(i, B); this.piloto.escuro.setMatrixAt(i, B);
      if (k.dr?.macacao != null) c.setHex(k.dr.macacao); else c.setHex(cor).multiplyScalar(0.62);
      this.piloto.macacao.setColorAt(i, c);
      this.piloto.capacete.setColorAt(i, c.setHex(k.dr?.capacete ?? cor));
      // rodas
      for (let j = 0; j < RODAS.length; j++) {
        const r = RODAS[j], frente = r.eixo === 'frente', raio = frente ? KART_ALUGUEL.pneuFrente.diametro / 2 : KART_ALUGUEL.pneuTras.diametro / 2;
        W.copy(M).multiply(R.makeTranslation(r.x, r.y, r.z));
        if (frente) W.multiply(R.makeRotationY(k.delta || 0));
        W.multiply(R.makeRotationX((k.odo || 0) / raio));
        const par = frente ? this.rodas.frente : this.rodas.tras, idx = i * 2 + (r.lado > 0 ? 0 : 1);
        par.pneu.setMatrixAt(idx, W); par.aro.setMatrixAt(idx, W);
      }
      // volante
      W.copy(B).multiply(this.Mvol).multiply(R.makeRotationAxis(this.eixoVol, (k.delta || 0) * RELACAO_VOLANTE));
      this.volante.setMatrixAt(i, W);
      // placas
      const cel = (k.dr?.numero != null) ? Math.max(0, Math.round(k.dr.numero) - KART_ALUGUEL.numeros.de) : 0;
      for (let j = 0; j < np; j++) {
        W.copy(B).multiply(this.placasDef[j].M);
        this.placas.setMatrixAt(i * np + j, W);
        this.aNumero.setX(i * np + j, cel);
      }
    }
    const conta = (m, k) => { m.count = n * k; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
    for (const m of this.corpo) conta(m, 1);
    for (const par of [this.rodas.frente, this.rodas.tras]) { conta(par.pneu, 2); conta(par.aro, 2); }
    conta(this.volante, 1);
    for (const m of Object.values(this.piloto)) conta(m, 1);
    conta(this.placas, np);
    this.aNumero.needsUpdate = true;
    this.group.visible = n > 0;
  }

  hide() { this.group.visible = false; }
  drawCalls() { return this.group.visible ? this.group.children.filter((m) => m.count > 0).length : 0; }
  dispose() {
    this.group.parent?.remove(this.group);
    for (const m of this.group.children) { m.dispose(); m.geometry.dispose(); }
    for (const m of Object.values(this.mat)) { m.map?.dispose(); m.dispose(); }
  }
}
