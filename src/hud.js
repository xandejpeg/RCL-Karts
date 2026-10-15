// HUD da etapa 1: cabeçalho (traçado e tempo de prova), torre de tempos e ajuda de teclas.
import { tempo, numeroKart } from './tempo.js';

export class Hud {
  constructor(raiz) {
    raiz.innerHTML = `
      <header class="hud-cab painel">
        <p class="kicker">RCL-Karts · KGV Circuito 101</p>
        <p class="hud-relogio chrono" data-relogio>0.000</p>
        <p class="hud-camera" data-camera></p>
      </header>
      <section class="hud-torre painel" aria-label="Torre de tempos">
        <table>
          <thead><tr><th>P</th><th>No.</th><th>V</th><th>Última</th><th>Melhor</th></tr></thead>
          <tbody data-torre></tbody>
        </table>
      </section>
      <footer class="hud-ajuda painel">
        <span><kbd>C</kbd> câmera</span><span><kbd>←</kbd><kbd>→</kbd> kart</span>
        <span><kbd>P</kbd> pausa</span><span><kbd>R</kbd> nova corrida</span><span><kbd>H</kbd> HUD</span>
      </footer>`;
    this.raiz = raiz;
    this.relogio = raiz.querySelector('[data-relogio]');
    this.camera = raiz.querySelector('[data-camera]');
    this.torre = raiz.querySelector('[data-torre]');
  }

  alterna() {
    this.raiz.hidden = !this.raiz.hidden;
  }

  update(race, seguido, modo, pausado) {
    this.relogio.textContent = pausado ? 'PAUSA' : tempo(race.time);
    this.camera.textContent = `Câmera ${modo} · kart ${numeroKart(seguido.dr.numero)}`;
    const melhorGeral = Math.min(...race.karts.map((k) => k.best ?? Infinity));
    this.torre.innerHTML = race.standings().map((k, i) => {
      const ultima = k.laps.length ? k.laps[k.laps.length - 1] : null;
      const roxo = k.best != null && k.best === melhorGeral ? ' class="melhor-sessao"' : '';
      const foco = k === seguido ? ' class="foco"' : '';
      return `<tr${foco}><td>${i + 1}</td><td><span class="cor" style="background:#${k.dr.cor.toString(16).padStart(6, '0')}"></span>${numeroKart(k.dr.numero)}</td>` +
        `<td>${k.lap}</td><td>${tempo(ultima)}</td><td${roxo}>${tempo(k.best)}</td></tr>`;
    }).join('');
  }
}
