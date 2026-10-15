// Números reais dos karts do KGV (002 a 072, sempre com 3 dígitos) e o jeito de cada um.
// Os 26 karts com 3 usos ou mais no TrackNight, do mais rápido para o mais lento (delta médio contra a mediana da
// bateria, que ainda mistura o piloto). Escolha de jogo, não medida: na mesma ordem, comprimido para ±0,5 s por volta.
// Os outros números ganham um sorteio fixo de ±0,2 s (sempre o mesmo para o mesmo número).
import { rngK } from '../vendor/rcl-transito/traffic-kart.js';

export const ORDEM_KGV = [44, 62, 65, 13, 16, 30, 2, 49, 54, 27, 50, 63, 14, 72, 15, 40, 7, 34, 24, 11, 43, 58, 29, 33, 35, 12];
export const NUMEROS = Array.from({ length: 71 }, (_, i) => i + 2);

// Segundos por volta que o kart dá (−) ou tira (+) do piloto.
export function segundosDoKart(numero) {
  const i = ORDEM_KGV.indexOf(numero);
  if (i >= 0) return -0.5 + i / (ORDEM_KGV.length - 1);
  return (rngK(numero * 7919)() * 2 - 1) * 0.2;
}

// Medido: 3% a menos de acelerador custa ~0,25 s por volta (8,5 s por unidade), em toda a faixa de habilidade.
export const SEGUNDOS_POR_ACEL = 8.5;
export const acelDoKart = (numero) => 1 - segundosDoKart(numero) / SEGUNDOS_POR_ACEL;

// n números diferentes, sorteados
export function sorteiaNumeros(n, rnd) {
  const pool = [...NUMEROS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
