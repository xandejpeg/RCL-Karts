// Calibragem do kart rental no Circuito 101 com os dados reais do TrackNight (melhor volta de 112 pilotos no seco,
// SFSpd das folhas KGV). Medido com ferramentas/calibra.mjs (volta limpa, kart sozinho, sem erros de piloto).

// Física: Honda GX390 (8,7 kW líquidos, ficha da Honda), kart com piloto de 175 kg, área frontal com arrasto 0,6 m²,
// pneu de rental duro (μ 1,25). Com isso o piloto mais rápido faz ~59,2 s e passa a ~86–87 km/h no fim da reta,
// como o recorde (59,314) e o SFSpd máximo (~86) das folhas.
export const CFG_101 = { potencia: 8700, massa: 175, cdA: 0.6, mu: 1.25, tracaoMax: 1500, freioMax: 1640 };

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

// Melhor volta limpa (s) por habilidade, medida com CFG_101, nivel(p) e acelPiloto(p).
export const TABELA = [
  [-0.4, 77.07], [-0.2, 72.67], [0, 69.22], [0.1, 67.8], [0.2, 66.41], [0.3, 65.23], [0.4, 64.09],
  [0.5, 63.11], [0.6, 62.19], [0.7, 61.41], [0.8, 60.6], [0.9, 59.85], [1, 59.24]
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
