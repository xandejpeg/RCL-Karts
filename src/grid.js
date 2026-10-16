// Monta a corrida do 101: kart calibrado (CFG_101), N pilotos com a distribuição real de melhor volta, números reais
// do KGV com o jeito de cada kart, largada parada em duas colunas e o kart do jogador. Sem editar o traffic-kart.js:
// cfg pelo construtor, pilotos por setDriver e o fator de motor (piloto × kart) por cima do drive() da IA.
import { KartRace, KART_CONFIG, rngK, assentaNoChao, speedProfile } from './fisica/kart-fisica.js';
import { CFG_101, nivel, acelPiloto, tempoDoQuantil, habilidadeDoTempo } from './calibragem.js';
import { acelDoKart, sorteiaNumeros } from './karts.js';
import { Jogador } from './jogador.js';
import { linhaDe } from './prova.js';

export const COR_JOGADOR = 0xe10600;
export const CAPACETE_JOGADOR = 0xf4f4f6;
export const GRID = { fila: 4.2, coluna: 1.5, primeira: 6 };
// Empenho por volta: a cada volta a IA anda abaixo da habilidade dela por |N(0, 1)| × desvio (em unidades de
// habilidade, até o máximo); de vez em quando sai a volta boa. Calibrado para o ritmo do vencedor ficar ~7–10%
// acima da melhor volta da bateria, como nas folhas (com a largada parada e o trânsito).
export const EMPENHO = { desvio: 0.25, maximo: 0.7 };
// Limitador do jogador (pedido do Xande, 16/10: "tenho que estar na média de velocidade máxima em cada trecho"): a volta
// é dividida em trechos de 50 m e, em cada um, o jogador não passa da velocidade máxima média de um grid típico do 101
// (os 20 quantis reais de melhor volta, cada um com a habilidade, o motor de piloto e o empenho médio). Perto do limite o
// motor corta (faixa em m/s), como um kart com limitador: o tempo se ganha na freada e na curva, não na reta. O motor do
// jogador também é o do piloto médio (acelPiloto(0)) vezes o jeito do kart dele.
export const LIMITADOR = { trecho: 50, pilotos: 20, empenho: 0.2, faixa: 0.5 };

// cores da IA: matizes espalhados, sem o vermelho (que é do jogador)
function corDaIA(i, n) {
  const h = (25 + (i * 320) / n) % 360, s = 0.7, l = i % 2 ? 0.42 : 0.55;
  const f = (k) => { const a = s * Math.min(l, 1 - l), t = (k + h / 30) % 12; return l - a * Math.max(-1, Math.min(t - 3, 9 - t, 1)); };
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255);
}

// Velocidade máxima média (m/s) em cada trecho da volta, do grid típico. Devolve { v: Float32Array, trecho (m), em(s) }.
export function limiteDoTrecho(race, L = LIMITADOR) {
  // (trechos contados da linha de cronometragem, como os setores)
  const T = race.track, linha = race.lines[race.mid], o = linhaDe(T), nT = Math.max(1, Math.round(T.L / L.trecho)), soma = new Float64Array(nT);
  for (let q = 0; q < L.pilotos; q++) {
    const p = habilidadeDoTempo(tempoDoQuantil((q + 0.5) / L.pilotos)) - L.empenho, nv = nivel(p), f = acelPiloto(p);
    const cfg = { ...race.cfg, potencia: race.cfg.potencia * f, tracaoMax: race.cfg.tracaoMax * f };
    const { v } = speedProfile(T, linha, { atrito: nv.atrito, freio: nv.freio, cfg }), m = new Float64Array(nT);
    for (let i = 0; i < T.n; i++) { const t = Math.floor((T.wrap(T.s[i] - o) / T.L) * nT) % nT; m[t] = Math.max(m[t], v[i]); }
    for (let t = 0; t < nT; t++) soma[t] += m[t] / L.pilotos;
  }
  const v = Float32Array.from(soma), passo = T.L / nT;
  return { v, trecho: passo, faixa: L.faixa, em: (s) => v[Math.floor(T.wrap(s - o) / passo) % nT] };
}

// coloca o kart parado em (s, d), virado no sentido da corrida
function posiciona(race, k, s, d) {
  const T = race.track, P = T.point(s, d), Q = T.point(s + 1, d);
  Object.assign(k, { x: P.x, z: P.z, yaw: Math.atan2(Q.x - P.x, Q.z - P.z), vx: 0, vy: 0, r: 0, v: 0, delta: 0, s: T.wrap(s), d, hint: T.idx(s) });
  assentaNoChao(T, k);   // (no chão do relevo)
}

export function montaCorrida(json, { seed = 74, pilotos = 20, jogador = true, cfg = {}, empenho = EMPENHO, limitador = true } = {}) {
  const race = new KartRace(json, { seed, pilotos, start: 'grid', cfg: { ...KART_CONFIG, ...CFG_101, ...cfg } });
  const rnd = rngK(seed ^ 0x101), n = race.karts.length, linha = linhaDe(race.track);
  const numeros = sorteiaNumeros(n, rnd);
  // quantis estratificados (um por faixa de 1/n), embaralhados no grid
  const quantis = race.karts.map((_, i) => (i + rnd()) / n);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [quantis[i], quantis[j]] = [quantis[j], quantis[i]]; }

  // habilidade da volta: a do piloto menos o empenho sorteado
  const daVolta = (k, p) => {
    race.setDriver(k, { ...k.dr, ...nivel(p) });
    k.acelPiloto = acelPiloto(p);
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

  race.karts.forEach((k, i) => {
    k.hab = habilidadeDoTempo(tempoDoQuantil(quantis[i]));
    k.dr = { ...k.dr, numero: numeros[i], cor: corDaIA(i, n), alvo: tempoDoQuantil(quantis[i]) };
    daVolta(k, k.hab);
    k.acelKart = acelDoKart(numeros[i]);
    k.voltaAntes = k.lap;
    // grid atrás da linha de cronometragem (o eixo continua começando no mesmo lugar)
    const fila = Math.floor(i / 2), lado = i % 2 ? 1 : -1;
    posiciona(race, k, linha - (GRID.primeira + fila * GRID.fila), lado * GRID.coluna);
    k.dist = race.rel({ s: linha }, k);
  });

  // o fator de motor entra depois de a IA decidir o acelerador e antes da física
  const drive = race.drive.bind(race);
  race.drive = (k, h) => { drive(k, h); k.inp.acel *= k.acelPiloto * k.acelKart; };
  // a cada volta que a IA começa, sorteia o empenho dela
  const update = race.update.bind(race);
  race.update = (dt) => {
    update(dt);
    for (const k of race.karts) {
      if (k.player || k.lap === k.voltaAntes) continue;
      k.voltaAntes = k.lap;
      if (empenho) daVolta(k, k.hab - Math.min(empenho.maximo, Math.abs(gauss()) * empenho.desvio));
    }
  };

  let j = null;
  if (jogador) {
    j = new Jogador(race, n - 1);
    j.fatorAcel = j.k.acelKart * acelPiloto(0);   // (motor do piloto médio; o kart mantém o jeito dele)
    j.limite = limitador ? limiteDoTrecho(race) : null;
    Object.assign(j.k.dr, { cor: COR_JOGADOR, capacete: CAPACETE_JOGADOR, alvo: null });
  }
  return { race, jogador: j };
}
