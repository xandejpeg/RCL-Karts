// Valida a corrida calibrada contra os dados reais do TrackNight: prova de 18 min + 1 volta com 20 karts da IA,
// cronometrada pela Prova na linha do `cronometro` (no 101, a do TrackNight, 32 m depois do primeiro ponto do eixo).
// Uso: node ferramentas/valida-corrida.mjs [seed ...]
import { json } from './calibra.mjs';
import { montaCorrida } from '../src/grid.js';
import { Prova } from '../src/prova.js';

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.round((s.length - 1) * p)]; };
const seeds = process.argv.slice(2).map(Number);

for (const seed of seeds.length ? seeds : [74, 75, 76]) {
  const { race } = montaCorrida(json, { seed, pilotos: 20, jogador: false });
  const prova = new Prova(race, { modo: 'bateria', rnd: () => 0 });
  for (let t = 0; t < 1500 && prova.fase !== 'fim'; t += 1 / 60) prova.update(1 / 60);
  const vencedor = prova.chegada[0], dv = prova.dados.get(vencedor);
  const melhores = race.karts.map((k) => prova.melhor(k)), melhor = Math.min(...melhores), alvo = race.karts.map((k) => k.dr.alvo);
  // SFSpd: passagens pela linha depois da largada (a primeira é a saída do grid, parado)
  const sf = race.karts.flatMap((k) => prova.dados.get(k).sf.slice(1));
  const s = race.snapshot();
  console.log(`seed ${seed} · linha de cronometragem em s = ${prova.linha} m`);
  console.log(`  vencedor: ${dv.chegou.voltas} voltas em ${dv.chegou.t.toFixed(1)} s, média ${(dv.chegou.t / dv.chegou.voltas).toFixed(2)} = melhor da bateria +${((dv.chegou.t / dv.chegou.voltas / melhor - 1) * 100).toFixed(1)}%  (real: 14–17 voltas em 18:03–18:48, +7,2 a +9,6%)`);
  console.log(`  melhor volta: min ${melhor.toFixed(2)} p10 ${q(melhores, 0.1).toFixed(2)} mediana ${q(melhores, 0.5).toFixed(2)} p90 ${q(melhores, 0.9).toFixed(2)}  (alvo sorteado: mediana ${q(alvo, 0.5).toFixed(2)} p90 ${q(alvo, 0.9).toFixed(2)}; real: 59,3 / 61,1 / 64,6 / 70,9)`);
  console.log(`  SFSpd na linha: mediana ${q(sf, 0.5).toFixed(1)} p90 ${q(sf, 0.9).toFixed(1)} máx ${q(sf, 1).toFixed(1)} km/h  (real: 76,7 / 83,2 / ~86)`);
  console.log(`  chegada: ${prova.chegada.length}/20 · erros ${s.erros}, rodadas ${s.rodadas}, ultrapassagens ${s.ultrapassagens}`);
}
