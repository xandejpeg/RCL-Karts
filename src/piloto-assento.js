// Onde o piloto senta e onde vão mãos e pés, no quadro do RCL (+X frente, +Y cima, +Z direita), sem three.
// Mensagem 009: ísquio no `kartPontos.banco` + 0,025 m, tronco 25° para trás, mãos no aro do volante e pés nos pedais
// por IK de dois ossos. Freio no pé esquerdo, acelerador no direito (kart).
import { RAZAO_VOLANTE } from './kart-contrato.js';

export const ASSENTO = { acimaBanco: 0.025, pelvisAcimaIsquio: 0.09, inclinacao: (25 * Math.PI) / 180 };
// aro do volante de rental: 320–340 mm (Birel N35) → raio ~0,165 m; mãos em "9 e 3 horas"
export const RAIO_ARO = 0.165;

// Pontos do desenho provisório do RCL-Trânsito (caixas), no quadro do RCL: banco (caixa de 0,42 m em z −0,32),
// volante (cilindro em z 0,12 e y 0,55, inclinado −1,1 rad), pedais no bico.
export const PONTOS_PROVISORIO = {
  banco: [-0.3, 0.3, 0],
  volante: { centro: [0.12, 0.55, 0], direcao: [-Math.sin(1.1), Math.cos(1.1), 0] },
  pedais: { acelerador: [0.6, 0.16, 0.1], freio: [0.6, 0.16, -0.1] },
  raioRodas: { frente: 0.13, tras: 0.14 }
};

const sub = (a, b) => a.map((x, i) => x - b[i]), soma = (a, b) => a.map((x, i) => x + b[i]), esc = (a, k) => a.map((x) => x * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norma = (a) => esc(a, 1 / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Mãos no aro, a 9 e 3 horas, giradas junto com o volante (esterço × RAZAO_VOLANTE em torno da coluna; virar à
// esquerda é giro positivo em torno da direção que aponta para o piloto).
export function alvosMaos(pontos, delta = 0, raio = RAIO_ARO) {
  const c = pontos.volante.centro, d = norma(pontos.volante.direcao);
  const lado = norma(sub([0, 0, 1], esc(d, dot([0, 0, 1], d))));   // +Z (direita) no plano do aro
  const ang = delta * RAZAO_VOLANTE, cima = cross(d, lado);           // d × lado: a 90° no sentido positivo
  const r = soma(esc(lado, Math.cos(ang)), esc(cima, Math.sin(ang)));
  return { direita: soma(c, esc(r, raio)), esquerda: sub(c, esc(r, raio)) };
}

export function alvosPes(pontos) {
  return { esquerdo: pontos.pedais.freio, direito: pontos.pedais.acelerador };
}

// ísquio e bacia (osso pelvis) no quadro do RCL
export function bacia(pontos) {
  const [x, y, z] = pontos.banco;
  return [x, y + ASSENTO.acimaBanco + ASSENTO.pelvisAcimaIsquio, z];
}

// Corpo de cada kart: o jogador é o Cláudio (eu); a IA vai rodando pelos outros, sem repetir vizinho.
export function corpoDoKart(i, jogador, ids) {
  if (jogador && ids.includes('eu')) return 'eu';
  const outros = ids.filter((id) => id !== 'eu');
  const lista = outros.length ? outros : ids;
  return lista[i % lista.length];
}

// Tinta do corpo pela cor do kart (até o macacão chegar): meio caminho entre o branco e a cor, para não apagar a textura.
export function tinta(cor, forca = 0.45) {
  const c = [(cor >> 16) & 255, (cor >> 8) & 255, cor & 255].map((x) => Math.round(255 + (x - 255) * forca));
  return (c[0] << 16) | (c[1] << 8) | c[2];
}
