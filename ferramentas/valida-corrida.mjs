// Valida a corrida calibrada contra os dados reais do TrackNight: prova de 18 min + 1 volta com 20 karts da IA.
// Uso: node ferramentas/valida-corrida.mjs [seed ...]
import { json } from './calibra.mjs';
import { montaCorrida } from '../src/grid.js';

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.round((s.length - 1) * p)]; };
const seeds = process.argv.slice(2).map(Number);

for (const seed of seeds.length ? seeds : [74, 75, 76]) {
  const { race } = montaCorrida(json, { seed, pilotos: 20, jogador: false });
  const sf0 = [], sf32 = [], antes = new Map(race.karts.map((k) => [k, { lap: k.lap, s: k.s }]));
  let N = null, fim = null;
  for (let t = 0; t < 1300 && fim == null; t += 1 / 60) {
    race.update(1 / 60);
    for (const k of race.karts) {
      const a = antes.get(k);
      if (k.lap !== a.lap && k.laps.length) sf0.push(k.v * 3.6);
      if (a.s < 32 && k.s >= 32 && k.laps.length) sf32.push(k.v * 3.6);
      antes.set(k, { lap: k.lap, s: k.s });
    }
    const l = race.standings()[0];
    if (N == null && race.time >= 1080) N = l.laps.length + 1;
    if (N != null && l.laps.length >= N) fim = race.time;
  }
  const bests = race.karts.map((k) => k.best), melhor = Math.min(...bests), alvo = race.karts.map((k) => k.dr.alvo);
  const s = race.snapshot();
  console.log(`seed ${seed}`);
  console.log(`  vencedor: ${N} voltas em ${fim.toFixed(1)} s, média ${(fim / N).toFixed(2)} = melhor da bateria +${((fim / N / melhor - 1) * 100).toFixed(1)}%  (real: 14–17 voltas em 18:03–18:48, +7,2 a +9,6%)`);
  console.log(`  melhor volta: min ${melhor.toFixed(2)} p10 ${q(bests, 0.1).toFixed(2)} mediana ${q(bests, 0.5).toFixed(2)} p90 ${q(bests, 0.9).toFixed(2)}  (alvo sorteado: mediana ${q(alvo, 0.5).toFixed(2)} p90 ${q(alvo, 0.9).toFixed(2)})`);
  console.log(`  SFSpd na nossa linha (s = 0): mediana ${q(sf0, 0.5).toFixed(1)} p90 ${q(sf0, 0.9).toFixed(1)} | na linha do TrackNight (s = 32): mediana ${q(sf32, 0.5).toFixed(1)} p90 ${q(sf32, 0.9).toFixed(1)}  (real: 76,7 e 83,2)`);
  console.log(`  erros ${s.erros}, rodadas ${s.rodadas}, ultrapassagens ${s.ultrapassagens}`);
}
