// RCL-Karts · medidas do kart de aluguel 4 tempos (o kart do KGV no jogo). JS puro, sem three: serve ao desenho
// (kart-modelo.js), ao som (rodas e relação, em ../som/motor.js) e, depois, à física.
//
// Fontes (o que não é medida está marcado como estimativa):
// - Chassi de referência Birel N35 (pacote RCL-Karts, dados/kgv101-dados.md): entre-eixos 1,070 m, comprimento 2,036 m,
//   bitola 1,208 m na frente e 1,410 m atrás (lida aqui como largura de fora a fora dos pneus), volante de 320 a 340 mm.
// - Motor Honda GX390 (ficha da Honda): 389 cm³, 8,7 kW a 3.600 rpm, 26,5 N·m a 2.500 rpm, 380 × 460 × 448 mm, 31,7 kg.
// - Pneus: medida típica de aluguel, 10×4.50-5 na frente e 11×7.10-5 atrás (estimativa até o TrackNight confirmar).
// - Kart de aluguel com GX390 pesa ~141 kg sem piloto (Sodi Sport, ficha do fabricante): referência, não o kart do KGV.
//
// Quadro do kart (o mesmo do traffic-kart.js e do desenho dele): x para a ESQUERDA, y para cima, z para a FRENTE; origem
// no chão, no centro do kart, sob o centro de gravidade da física (0,60 m atrás do eixo dianteiro: KART_CONFIG.cgFrente).
// Com yaw do traffic-kart.js, o z do kart vira (sen yaw, cos yaw) no mundo e o x vira (cos yaw, −sen yaw).

const POL = 0.0254;
export const KART_ALUGUEL = Object.freeze({
  entreEixos: 1.07,
  cgFrente: 0.6,                       // m do eixo dianteiro ao CG (KART_CONFIG do RCL-Trânsito)
  comprimento: 2.036,
  bitolaFrente: 1.208,                 // de fora a fora dos pneus da frente
  bitolaTras: 1.41,                    // de fora a fora dos pneus de trás
  pneuFrente: { diametro: 10 * POL, largura: 4.5 * POL, aro: 5 * POL },     // 10×4.50-5
  pneuTras: { diametro: 11 * POL, largura: 7.1 * POL, aro: 5 * POL },       // 11×7.10-5
  volante: { diametro: 0.33 },
  tubo: 0.032,                         // tubo do chassi (estimativa: 30–32 mm nos karts de aluguel)
  eixoTras: { diametro: 0.04 },        // estimativa
  motor: { comprimento: 0.38, largura: 0.46, altura: 0.448, lado: 'direita' },  // ficha Honda; lado: estimativa
  numeros: { de: 2, ate: 72 }          // números reais do KGV, sempre com 3 dígitos
});

const K = KART_ALUGUEL;
// posições derivadas (m, no quadro do kart)
export const zEixoFrente = K.cgFrente;
export const zEixoTras = K.cgFrente - K.entreEixos;
export const raioFrente = K.pneuFrente.diametro / 2;
export const raioTras = K.pneuTras.diametro / 2;
// centro de cada roda (x do meio do pneu)
export const RODAS = Object.freeze([
  { nome: 'roda_de', eixo: 'frente', lado: 1, x: (K.bitolaFrente - K.pneuFrente.largura) / 2, y: raioFrente, z: zEixoFrente },
  { nome: 'roda_dd', eixo: 'frente', lado: -1, x: -(K.bitolaFrente - K.pneuFrente.largura) / 2, y: raioFrente, z: zEixoFrente },
  { nome: 'roda_te', eixo: 'tras', lado: 1, x: (K.bitolaTras - K.pneuTras.largura) / 2, y: raioTras, z: zEixoTras },
  { nome: 'roda_td', eixo: 'tras', lado: -1, x: -(K.bitolaTras - K.pneuTras.largura) / 2, y: raioTras, z: zEixoTras }
]);
// a frente e a traseira do kart (para-choque), com o comprimento total
export const zFrente = zEixoFrente + 0.42;
export const zTras = zFrente - K.comprimento;

// pontos que o jogo usa (câmera, som, piloto). O piloto é o provisório: até o RCL-Personagens mandar o macacão e a pose.
export const PONTOS = Object.freeze({
  volante: { x: 0, y: 0.43, z: 0.23 },          // centro do volante
  coluna: { x: 0, y: 0.11, z: 0.62 },           // pé da coluna de direção
  quadril: { x: 0, y: 0.17, z: -0.2 },
  olho: { x: 0, y: 0.83, z: -0.21 },            // olho do piloto (câmera do capacete)
  escape: { x: -0.37, y: 0.34, z: -1.0 },       // ponta do escapamento (som e fumaça)
  motor: { x: -0.43, y: 0.3, z: -0.08 }         // centro do motor (de onde vem o som)
});

// número do kart com 3 dígitos
export const numeroKart = (n) => String(Math.round(n)).padStart(3, '0');
