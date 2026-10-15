// RCL-Karts · o kart de aluguel 4 tempos modelado em código (three.js), sem asset de fora: chassi de tubo, para-choque
// envolvente de aluguel, carenagens laterais, bico e painel com número, banco de fibra, volante, pedais, motor Honda GX390
// (bloco, cilindro aletado, partida retrátil, tanque, filtro, embreagem, silencioso e escape), eixo traseiro com disco de
// freio e coroa, rodas 10" e 11" e o piloto provisório (macacão e capacete) até o RCL-Personagens mandar o macacão.
// Visual: a foto de referência do TrackNight (rental_kart_4_strokes.png: para-choque preto em volta, carenagens na cor).
// Medidas: medidas.js. Quadro: x esquerda, y cima, z frente, origem no chão sob o CG (como o traffic-kart.js).
// Sai por material (cada um vira uma InstancedMesh no kart-view.js): pintura (cor do kart), preto (plástico), metal,
// banco, motor (alumínio), escuro; rodas, volante e piloto à parte, porque se mexem ou mudam de cor.
import * as T from 'three';
import { KART_ALUGUEL as K, RODAS, PONTOS, zEixoFrente as ZF, zEixoTras as ZT, zFrente, zTras, raioTras } from './medidas.js';
import { junta, poe, aponta, barra, caixaArredondada, varre, circulo, retArredondado, caminhoRet, torneadoX, triangulos } from './geometria.js';

const P = (o) => [o.x, o.y, o.z];
// direção da coluna de direção (do pé da coluna para o volante): o volante fica de frente para o piloto
export const EIXO_VOLANTE = (() => {
  const a = PONTOS.coluna, b = PONTOS.volante, d = [b.x - a.x, b.y - a.y, b.z - a.z], l = Math.hypot(...d);
  return d.map((v) => v / l);
})();
// quanto o volante gira por radiano de roda (kart: direção direta, ~3:1)
export const RELACAO_VOLANTE = 3;

function capsula(a, b, r, seg = 10) {
  const A = new T.Vector3(...a), B = new T.Vector3(...b), L = A.distanceTo(B);
  const g = new T.CapsuleGeometry(r, L, 4, seg);
  return aponta(g, B.clone().sub(A).toArray(), A.clone().add(B).multiplyScalar(0.5).toArray());
}
function esfera(r, pos, esc = [1, 1, 1], seg = 14) {
  return poe(new T.SphereGeometry(r, seg, Math.round(seg * 0.7)), { pos, esc });
}
// sobe o teto de uma peça para trás (carenagem que sobe para a traseira)
function inclinaTeto(g, k, zc) {
  const p = g.getAttribute('position');
  g.computeBoundingBox();
  const ym = (g.boundingBox.min.y + g.boundingBox.max.y) / 2;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > ym) p.setY(i, p.getY(i) - k * (p.getZ(i) - zc));
  g.computeVertexNormals();
  return g;
}
// afina a frente de uma peça (bico)
function afinaFrente(g, k, zc) {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - k * Math.max(0, p.getZ(i) - zc)));
  g.computeVertexNormals();
  return g;
}

export function montaKart() {
  const pintura = [], preto = [], metal = [], banco = [], motor = [], escuro = [];
  const lados = [1, -1];

  // ---- para-choque de aluguel em volta do kart (preto), mais o traseiro alto
  preto.push(varre(caminhoRet(-0.775, 0.775, zTras + 0.05, zFrente - 0.05, 0.36, 0.24, 0.13, 8), retArredondado(0.075, 0.11, 0.03), { fechado: true }));
  preto.push(poe(caixaArredondada(1.5, 0.2, 0.16, 0.05), { pos: [0, 0.17, -0.9] }));

  // ---- carenagens laterais (a da direita é curta: o motor fica atrás dela), bico e painel da frente (pintura)
  pintura.push(inclinaTeto(poe(caixaArredondada(0.32, 0.16, 0.74, 0.06), { pos: [0.57, 0.17, 0.07] }), 0.07, 0.07));
  pintura.push(inclinaTeto(poe(caixaArredondada(0.32, 0.16, 0.3, 0.06), { pos: [-0.57, 0.17, 0.28] }), 0.07, 0.28));
  // bico: perfil arredondado varrido para a frente, mais largo e alto atrás (junto dos pés), baixo e estreito na ponta
  {
    const n = 12, caminho = Array.from({ length: n }, (_, i) => [0, 0, 0.74 + (0.27 * i) / (n - 1)]);
    const g = varre(caminho, retArredondado(1, 1, 0.32, 4), { binormal: [1, 0, 0], escala: (i, N) => { const t = i / (N - 1); return [0.68 - 0.2 * t * t, 0.2 - 0.09 * t]; } });
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const t = (p.getZ(i) - 0.74) / 0.27; p.setY(i, p.getY(i) + 0.16 - 0.05 * t); }
    g.computeVertexNormals();
    pintura.push(g);
  }
  pintura.push(poe(caixaArredondada(0.44, 0.2, 0.03, 0.012), { pos: [0, 0.34, 0.63], rot: [-0.45, 0, 0] }));

  // ---- assoalho
  preto.push(poe(caixaArredondada(0.46, 0.012, 0.8, 0.005, 1), { pos: [0, 0.035, 0.22] }));

  // ---- chassi de tubo (metal)
  const tubo = K.tubo / 2;
  for (const s of lados) {
    metal.push(varre([[s * 0.22, 0.045, 0.82], [s * 0.25, 0.045, 0.6], [s * 0.3, 0.045, 0.2], [s * 0.32, 0.045, -0.25], [s * 0.3, 0.05, -0.62]], circulo(tubo, 8)));
    metal.push(barra([s * 0.47, 0.04, ZF], [s * 0.47, 0.21, ZF], 0.014));                       // pino-mestre
    metal.push(barra([s * 0.47, 0.127, ZF], [s * 0.55, 0.127, ZF], 0.012));                     // manga de eixo
    metal.push(barra([s * 0.47, 0.1, ZF], [s * 0.42, 0.1, ZF - 0.08], 0.008));                  // braço de direção
    metal.push(barra([0, 0.09, 0.56], [s * 0.42, 0.1, ZF - 0.08], 0.006));                      // barra de direção
    metal.push(barra([s * 0.14, 0.05, -0.4], [s * 0.12, 0.4, -0.47], 0.009));                   // suporte do banco
    metal.push(barra([s * 0.31, 0.05, 0.25], [s * 0.74, 0.12, 0.25], 0.012));                   // suportes do para-choque
    metal.push(barra([s * 0.32, 0.05, -0.22], [s * 0.74, 0.12, -0.22], 0.012));
    metal.push(barra([s * 0.22, 0.05, 0.8], [s * 0.4, 0.12, 0.92], 0.012));
    metal.push(barra([s * 0.3, 0.06, -0.62], [s * 0.55, 0.13, -0.92], 0.012));
    metal.push(poe(caixaArredondada(0.03, 0.12, 0.09, 0.01, 1), { pos: [s * 0.3, 0.1, ZT] }));    // mancal do eixo
  }
  metal.push(barra([0.47, 0.075, ZF], [-0.47, 0.075, ZF], tubo));
  metal.push(barra([0.3, 0.05, -0.62], [-0.3, 0.05, -0.62], tubo));
  metal.push(barra([0.7, raioTras, ZT], [-0.7, raioTras, ZT], K.eixoTras.diametro / 2, { seg: 12 }));
  const v = PONTOS.volante, c = PONTOS.coluna;
  metal.push(barra(P(c), [v.x - EIXO_VOLANTE[0] * 0.04, v.y - EIXO_VOLANTE[1] * 0.04, v.z - EIXO_VOLANTE[2] * 0.04], 0.0125));
  metal.push(barra([0, 0.04, 0.6], P(c), 0.012));
  metal.push(barra([0, 0.2, 0.6], [0, 0.3, 0.6], 0.01));                                        // suporte do painel
  // pedais: freio à esquerda, acelerador à direita
  for (const [x, w] of [[0.1, 0.08], [-0.1, 0.065]]) {
    metal.push(poe(caixaArredondada(w, 0.012, 0.13, 0.004, 1), { pos: [x, 0.14, 0.68], rot: [-1.0, 0, 0] }));
    metal.push(barra([x, 0.05, 0.64], [x, 0.13, 0.67], 0.006));
  }
  // disco de freio e pinça (esquerda), coroa e protetor da corrente (direita, do lado do motor)
  metal.push(poe(torneadoX([[0.03, -0.004], [0.1, -0.004], [0.1, 0.004], [0.03, 0.004]], 28), { pos: [0.2, raioTras, ZT] }));
  escuro.push(poe(caixaArredondada(0.045, 0.06, 0.07, 0.012, 1), { pos: [0.2, raioTras + 0.08, ZT - 0.04] }));
  escuro.push(poe(torneadoX([[0.02, -0.003], [0.085, -0.003], [0.085, 0.003], [0.02, 0.003]], 28), { pos: [-0.25, raioTras, ZT] }));
  preto.push(poe(caixaArredondada(0.05, 0.17, 0.62, 0.02), { pos: [-0.255, 0.17, -0.245], rot: [-0.133, 0, 0] }));

  // ---- banco de fibra: concha em U varrida do lábio da frente até o alto do encosto
  const curva = new T.CatmullRomCurve3([[0, 0.17, 0.04], [0, 0.1, -0.06], [0, 0.065, -0.16], [0, 0.07, -0.27], [0, 0.12, -0.37], [0, 0.24, -0.43], [0, 0.4, -0.465], [0, 0.56, -0.48]].map((p) => new T.Vector3(...p)));
  const U = Array.from({ length: 15 }, (_, i) => { const a = -1.4 + (2.8 * i) / 14; return [0.2 * Math.sin(a), 0.16 * (1 - Math.cos(a))]; });
  banco.push(varre(curva.getPoints(24).map((p) => p.toArray()), U, { binormal: [1, 0, 0], perfilFechado: false, tampas: false, escala: (i, n) => [1 + 0.15 * (i / (n - 1)), 1] }));

  // ---- motor Honda GX390, à direita do piloto (virabrequim paralelo ao eixo; embreagem para dentro, partida para fora)
  const M0 = PONTOS.motor;
  metal.push(poe(caixaArredondada(0.36, 0.012, 0.36, 0.004, 1), { pos: [M0.x, 0.075, M0.z] }));                    // base
  escuro.push(poe(caixaArredondada(0.32, 0.26, 0.34, 0.05), { pos: [M0.x, 0.21, M0.z] }));                       // cárter
  const cil = [-0.02, 0.4, -0.18], rotCil = [-0.42, 0, 0];
  motor.push(poe(caixaArredondada(0.18, 0.22, 0.19, 0.03), { pos: [M0.x + cil[0], cil[1], cil[2]], rot: rotCil }));
  for (let k = 0; k < 5; k++) {                                                                                     // aletas
    const off = -0.07 + k * 0.035, dy = Math.cos(rotCil[0]) * off, dz = Math.sin(rotCil[0]) * off;
    motor.push(poe(caixaArredondada(0.22, 0.008, 0.22, 0.003, 1), { pos: [M0.x + cil[0], cil[1] + dy, cil[2] - dz], rot: rotCil }));
  }
  motor.push(poe(caixaArredondada(0.15, 0.06, 0.15, 0.02), { pos: [M0.x + cil[0], cil[1] + Math.cos(rotCil[0]) * 0.12, cil[2] + Math.sin(rotCil[0]) * 0.12], rot: rotCil }));
  escuro.push(poe(torneadoX([[0, 0], [0.12, 0], [0.155, 0.015], [0.165, 0.05], [0.165, 0.09], [0, 0.09]], 28), { pos: [M0.x - 0.25, 0.27, M0.z + 0.01] }));   // partida retrátil
  metal.push(poe(torneadoX([[0, 0], [0.09, 0], [0.09, 0.004], [0, 0.004]], 24), { pos: [M0.x - 0.254, 0.27, M0.z + 0.01] }));                                // grade
  escuro.push(poe(caixaArredondada(0.32, 0.13, 0.25, 0.05), { pos: [M0.x - 0.03, 0.535, M0.z + 0.07] }));                                                       // tanque
  escuro.push(poe(caixaArredondada(0.13, 0.18, 0.15, 0.04), { pos: [M0.x + 0.12, 0.42, M0.z + 0.19] }));                                                      // filtro de ar
  metal.push(poe(torneadoX([[0, 0], [0.055, 0], [0.055, 0.05], [0, 0.05]], 20), { pos: [M0.x + 0.15, 0.2, -0.02] }));                                        // embreagem
  metal.push(varre([[M0.x + 0.06, 0.44, -0.26], [-0.38, 0.42, -0.3], [-0.4, 0.37, -0.37]], circulo(0.018, 8)));                                                                                 // coletor
  const sil = barra([-0.4, 0.36, -0.36], [-0.4, 0.36, -0.8], 0.07, { seg: 16 });
  motor.push(sil);                                                                                                                                         // silencioso
  escuro.push(barra([-0.37, 0.34, -0.79], [PONTOS.escape.x, PONTOS.escape.y, PONTOS.escape.z], 0.02));                                                    // ponteira

  // ---- rodas (torneadas em volta do eixo X, centradas na roda)
  const pf = K.pneuFrente, pt = K.pneuTras, ra = pf.aro / 2;
  const pneu = (R, w) => torneadoX([[ra + 0.003, -w * 0.44], [R * 0.82, -w * 0.5], [R * 0.95, -w * 0.47], [R, -w * 0.36], [R, w * 0.36], [R * 0.95, w * 0.47], [R * 0.82, w * 0.5], [ra + 0.003, w * 0.44]], 28);
  const aro = (w) => torneadoX([[0, -w * 0.3], [0.035, -w * 0.32], [ra + 0.004, -w * 0.45], [ra + 0.004, w * 0.45], [0.035, w * 0.32], [0, w * 0.3]], 20);
  const rodas = {
    frente: { pneu: pneu(pf.diametro / 2, pf.largura), aro: aro(pf.largura) },
    tras: { pneu: pneu(pt.diametro / 2, pt.largura), aro: aro(pt.largura) }
  };

  // ---- volante (no quadro dele: eixo +z para o piloto; o desenho põe no pivô e gira pela direção)
  const vol = [new T.TorusGeometry(K.volante.diametro / 2 - 0.016, 0.016, 8, 36), poe(new T.CylinderGeometry(0.04, 0.04, 0.05, 14), { rot: [Math.PI / 2, 0, 0] })];
  for (const a of [0, Math.PI, -Math.PI / 2]) vol.push(barra([0, 0, -0.01], [Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0], 0.011, { seg: 6 }));
  const volante = junta(vol);

  // ---- piloto provisório: macacão (cor do kart), capacete (cor do capacete), viseira, luvas, sapatilhas e balaclava
  const macacao = [], capacete = [], pEscuro = [];
  macacao.push(poe(caixaArredondada(0.34, 0.16, 0.26, 0.07), { pos: [0, 0.17, -0.2] }));
  { const g = poe(new T.CapsuleGeometry(0.15, 0.3, 6, 14), { esc: [1.25, 1, 0.85] }); macacao.push(aponta(g, [0, 0.36, -0.09], [0, 0.42, -0.315])); }
  for (const s of lados) {
    const ombro = [s * 0.21, 0.56, -0.33], cotovelo = [s * 0.25, 0.38, -0.08], mao = [s * 0.155, 0.443, 0.215];
    const quadril = [s * 0.1, 0.17, -0.16], joelho = [s * 0.13, 0.27, 0.18], tornozelo = [s * 0.1, 0.16, 0.56];
    macacao.push(capsula(ombro, cotovelo, 0.055), capsula(cotovelo, mao, 0.047), capsula(quadril, joelho, 0.072), capsula(joelho, tornozelo, 0.058));
    pEscuro.push(esfera(0.045, mao), poe(caixaArredondada(0.085, 0.1, 0.2, 0.03), { pos: [s * 0.1, 0.15, 0.63], rot: [-0.4, 0, 0] }));
  }
  pEscuro.push(barra([0, 0.6, -0.36], [0, 0.72, -0.33], 0.05));
  capacete.push(esfera(0.15, [0, 0.82, -0.31], [0.95, 1, 1.1], 22));
  pEscuro.push(poe(new T.SphereGeometry(0.153, 22, 8, Math.PI / 2 - 0.85, 1.7, 1.2, 0.45), { pos: [0, 0.82, -0.31], esc: [0.95, 1, 1.1] }));

  // ---- placas de número (UV própria; o número vem do atlas no kart-view.js): frente, laterais e traseira
  const nP = [0, Math.sin(0.45), Math.cos(0.45)];
  const placas = [
    { nome: 'placa_frente', pos: [0, 0.34 + nP[1] * 0.017, 0.63 + nP[2] * 0.017], rot: [-0.45, 0, 0], w: 0.2, h: 0.12 },
    { nome: 'placa_esquerda', pos: [0.736, 0.18, 0.27], rot: [0, Math.PI / 2, 0], w: 0.18, h: 0.1 },
    { nome: 'placa_direita', pos: [-0.736, 0.18, 0.27], rot: [0, -Math.PI / 2, 0], w: 0.18, h: 0.1 },
    { nome: 'placa_tras', pos: [0, 0.17, -0.985], rot: [0, Math.PI, 0], w: 0.2, h: 0.11 }
  ];

  const corpo = { pintura: junta(pintura), preto: junta(preto), metal: junta(metal), banco: junta(banco), motor: junta(motor), escuro: junta(escuro) };
  const piloto = { macacao: junta(macacao), capacete: junta(capacete), escuro: junta(pEscuro) };
  const todas = [...Object.values(corpo), rodas.frente.pneu, rodas.frente.aro, rodas.tras.pneu, rodas.tras.aro, volante, ...Object.values(piloto)];
  return { corpo, rodas, volante, piloto, placas, rodasPos: RODAS, triangulos: todas.reduce((s, g) => s + triangulos(g), 0) + 2 * (triangulos(rodas.frente.pneu) + triangulos(rodas.frente.aro) + triangulos(rodas.tras.pneu) + triangulos(rodas.tras.aro)) + placas.length * 2 };
}
