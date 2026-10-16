// Calibragem do kart rental no Circuito 101. Física (CFG_101): ajustada à hot lap do vídeo do 101 (volta de 0:58,61,
// velocidade na tela a cada 0,1 s, lida por OCR). Habilidade (TABELA e QUANTIS): dados reais do TrackNight (melhor volta de
// 112 pilotos no seco). Medido com ferramentas/calibra.mjs (volta limpa, kart sozinho, sem erros de piloto).

// Física: com a aderência e a freada inteiras (perfil com atrito 1 e freio 1) e a linha exata, a IA faz 58,73 s, a volta
// do vídeo (0:58,61): ninguém anda mais rápido que isto sem sair da pista ou cortar. Com o relevo e os S ajustados pelo
// Xande (16/10), o formato da velocidade fica a 4,3 km/h (RMS) do vídeo; a máxima é 77 km/h (vídeo: 80,5). Diferença que
// ficou (estimativa): a 1ª curva sai ~8 km/h e as duas curvas antes da subida final (~790 e ~860 m no eixo) saem
// 10–13 km/h mais lentas que no vídeo.
// potencia em W na roda (menos que os 8,7 kW do GX390: perdas e o motor de rental), cdA em m², freioMax em N; mu 2,0 é a
// aderência no limite (a IA mais rápida usa 88% dela).
// linha: margem (m do centro do kart à borda do asfalto) e a linha de curvatura mínima com sobrerrelaxação.
export const CFG_101 = {
  potencia: 6000, massa: 175, cdA: 0.85, mu: 2.0, tracaoMax: 1500, freioMax: 2200,
  linha: { margem: 1.05, iter: 6000, relax: 1.9 }
};

// Habilidade p (−0,7 a 1; abaixo de −0,8 fica em −0,8, para a volta ruim do empenho não zerar o freio): aderência que ousa usar na curva, freada, precisão da linha, constância e o nível dos erros
// do RCL-Trânsito (0,45–0,55). acelPiloto é só o peso do piloto (±1,5% de motor): todo mundo acelera quase igual na
// reta, como o Xande viu no rental. A diferença de velocidade na linha (nas folhas, ~8 km/h entre 3 s de volta) sai da
// saída de curva, que a física já dá. (Antes era 0,86 + 0,14p: a IA média andava com 10% menos motor que o jogador.)
export function nivel(p) {
  p = Math.max(-0.8, Math.min(1, p));
  return {
    atrito: 0.66 + 0.34 * p, freio: 0.5 + 0.5 * p, linha: 0.35 - 0.25 * p,
    constancia: 0.014 - 0.01 * p, nivel: 0.45 + 0.1 * p
  };
}
export const acelPiloto = (p) => 0.97 + 0.03 * Math.max(-0.8, Math.min(1, p));

// Melhor volta limpa (s) por habilidade, medida com CFG_101, nivel(p) e acelPiloto(p). O p = 1 fica logo acima do
// limite (58,73 s); o recorde do TrackNight (59,3 s) cai em p ≈ 0,85 e o mais lento das folhas (75 s) em p ≈ −0,65.
export const TABELA = [
  [-0.7, 76.33], [-0.6, 73.46], [-0.4, 69.23], [-0.2, 66.39], [0, 64.24], [0.1, 63.38], [0.2, 62.59], [0.3, 61.93],
  [0.4, 61.34], [0.5, 60.79], [0.6, 60.27], [0.7, 59.77], [0.8, 59.38], [0.9, 59.07], [1, 58.83]
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
