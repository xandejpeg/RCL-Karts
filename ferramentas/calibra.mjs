// Ferramenta de calibragem (Node): volta limpa de um kart sozinho na pista, com o cfg e o piloto dados.
import fs from 'node:fs';
import { KartRace, KART_CONFIG } from '../vendor/rcl-transito/traffic-kart.js';
import { tracadoDaCorrida } from '../src/pista-dados.js';

export const json = tracadoDaCorrida(JSON.parse(fs.readFileSync(new URL('../assets/pista/tracado101.json', import.meta.url), 'utf8')));

// Sem erros de piloto e sem a forma do dia, para medir o ritmo puro.
export const LIMPO = { erro: { ...KART_CONFIG.erro, base: 0 }, forma: { ...KART_CONFIG.forma, sigma: 0 } };

// Roda `voltas` voltas lançadas e devolve as voltas, a velocidade (km/h) em cada passagem pela linha (s = 0) e pela
// linha do TrackNight (s = 32 m: o `start` do site fica ~32 m depois do primeiro ponto do eixo) e a máxima da volta.
export function voltaLimpa(cfg, piloto = null, { voltas = 3, acel = 1 } = {}) {
  const race = new KartRace(json, { seed: 74, pilotos: 1, start: 'espalhado', cfg });
  const k = race.karts[0];
  if (piloto) race.setDriver(k, { ...k.dr, ...piloto });
  if (acel !== 1) {
    const drive = race.drive.bind(race);
    race.drive = (kk, h) => { drive(kk, h); kk.inp.acel *= acel; };
  }
  const sf = [], sf32 = [];
  let lap = k.lap, vmax = 0, sAntes = k.s;
  for (let t = 0; t < 400 && k.laps.length < voltas + 1; t += 1 / 60) {
    race.update(1 / 60);
    if (k.laps.length >= 1) vmax = Math.max(vmax, k.v * 3.6);
    if (k.lap !== lap) { lap = k.lap; sf.push(k.v * 3.6); }
    if (sAntes < 32 && k.s >= 32 && k.laps.length >= 1) sf32.push(k.v * 3.6);
    sAntes = k.s;
  }
  const laps = k.laps.slice(1), media = (a) => a.reduce((x, y) => x + y, 0) / Math.max(a.length, 1);
  return { laps, best: Math.min(...laps), sf: media(sf.slice(1)), sf32: media(sf32), vmax, refLap: race.refLap };
}
