// Calibragem do kart rental no Circuito 101. Física (CFG_101): ajustada à hot lap do vídeo do 101 (volta de 0:58,61,
// velocidade na tela a cada 0,1 s, lida por OCR). Habilidade (TABELA e QUANTIS): dados reais do TrackNight (melhor volta de
// 112 pilotos no seco). Medido com ferramentas/calibra.mjs (volta limpa, kart sozinho, sem erros de piloto).

// Física: com a aderência e a freada inteiras (perfil com atrito 1 e freio 1) e a linha exata, a IA faz 58,72 s, a volta
// do vídeo (0:58,61): ninguém anda mais rápido que isto sem sair da pista ou cortar. Máxima 81,0 km/h (vídeo: 80,5) e o
// formato da velocidade a 5,8 km/h (RMS) do vídeo. Diferenças que ficaram (estimativa, vêm do desenho do traçado): o 1º
// "S" depois da reta, o cotovelo do miolo (~540 m) e a curva antes da subida final (~860 m) saem 10–15 km/h mais lentos
// que no vídeo; entre elas, mais rápidos.
// potencia em W na roda (menos que os 8,7 kW do GX390: perdas e o motor de rental), cdA em m², freioMax em N.
// linha: margem (m do centro do kart à borda do asfalto) e a linha de curvatura mínima com sobrerrelaxação.
export const CFG_101 = {
  potencia: 6450, massa: 175, cdA: 0.75, mu: 1.6, tracaoMax: 1500, freioMax: 1900,
  linha: { margem: 1.05, iter: 6000, relax: 1.9 }
};

// Habilidade p (−0,4 a 1): aderência que ousa usar na curva, freada, precisão da linha, constância e o nível dos erros
// do RCL-Trânsito (0,45–0,55). acelPiloto é o motor/peso: piloto lento também anda menos na reta (nas folhas, 3 s mais
// lento na volta = ~8 km/h a menos na linha; no rental pesa o peso do piloto e a saída de curva).
export function nivel(p) {
  return {
    atrito: 0.66 + 0.34 * p, freio: 0.5 + 0.5 * p, linha: 0.35 - 0.25 * p,
    constancia: 0.014 - 0.01 * p, nivel: 0.45 + 0.1 * p
  };
}
export const acelPiloto = (p) => 0.86 + 0.14 * p;

// Melhor volta limpa (s) por habilidade, medida com CFG_101, nivel(p) e acelPiloto(p). O p = 1 fica logo acima do
// limite (58,72 s); o recorde do TrackNight (59,3 s) cai em p ≈ 0,9.
export const TABELA = [
  [-0.4, 73.68], [-0.2, 70.07], [0, 67.34], [0.1, 66.05], [0.2, 64.92], [0.3, 63.87], [0.4, 62.97],
  [0.5, 62.15], [0.6, 61.41], [0.7, 60.65], [0.8, 59.97], [0.9, 59.36], [1, 58.84]
];

// Distribuição real da melhor volta no 101 seco (quantil → s). O 100% é estimado (a cauda real passa de 75 s).
export const QUANTIS = [[0, 59.3], [0.1, 61.1], [0.25, 61.9], [0.5, 64.6], [0.75, 68.0], [0.9, 70.9], [1, 75]];

function interpola(tab, x) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    const [x0, y0] = tab[i - 1], [x1, y1] = tab[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return tab[tab.length - 1][1];
}

export const tempoDoQuantil = (q) => interpola(QUANTIS, q);

// habilidade que dá a melhor volta T (a tabela é decrescente: inverte trocando as colunas, em ordem crescente de T)
export function habilidadeDoTempo(T) {
  const inv = TABELA.map(([p, t]) => [t, p]).sort((a, b) => a[0] - b[0]);
  return interpola(inv, T);
}
