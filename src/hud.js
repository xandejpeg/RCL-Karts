// HUD: cabeçalho (traçado e tempo de prova), torre de tempos, painel do jogador e ajuda de teclas.
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
      <section class="hud-piloto painel" aria-label="Seu kart">
        <div><p class="kicker">Posição</p><p class="hud-grande chrono" data-pos>—</p></div>
        <div><p class="kicker">Volta</p><p class="hud-grande chrono" data-volta>—</p></div>
        <div><p class="kicker">km/h</p><p class="hud-grande chrono" data-vel>0</p></div>
        <div><p class="kicker">Última</p><p class="chrono" data-ultima>—</p><p class="kicker">Melhor</p><p class="chrono" data-melhor>—</p></div>
      </section>
      <footer class="hud-ajuda painel">
        <span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> pilotar</span><span><kbd>T</kbd> volta à pista</span>
        <span><kbd>C</kbd> câmera</span><span><kbd>[</kbd><kbd>]</kbd> outro kart</span><span><kbd>P</kbd> pausa</span>
        <span><kbd>R</kbd> nova corrida</span><span><kbd>H</kbd> HUD</span><span class="hud-controle" data-controle></span>
      </footer>`;
    this.raiz = raiz;
    const q = (s) => raiz.querySelector(`[data-${s}]`);
    this.el = Object.fromEntries(['relogio', 'camera', 'torre', 'pos', 'volta', 'vel', 'ultima', 'melhor', 'controle'].map((s) => [s, q(s)]));
  }

  alterna() {
    this.raiz.hidden = !this.raiz.hidden;
  }

  // a velocidade muda todo quadro; o resto a cada 250 ms (ver main.js)
  velocidade(jogador) {
    this.el.vel.textContent = Math.round(jogador.v * 3.6);
  }

  update(race, seguido, jogador, modo, pausado, controle) {
    const el = this.el, ordem = race.standings();
    el.relogio.textContent = pausado ? 'PAUSA' : tempo(race.time);
    el.camera.textContent = `Câmera ${modo} · kart ${numeroKart(seguido.dr.numero)}${seguido === jogador ? ' · você' : ''}`;
    el.controle.textContent = controle ? 'Controle conectado' : '';
    const melhorGeral = Math.min(...race.karts.map((k) => k.best ?? Infinity));
    el.torre.innerHTML = ordem.map((k, i) => {
      const ultima = k.laps.length ? k.laps[k.laps.length - 1] : null;
      const roxo = k.best != null && k.best === melhorGeral ? ' class="melhor-sessao"' : '';
      const classes = [k === jogador && 'jogador', k === seguido && 'foco'].filter(Boolean).join(' ');
      return `<tr class="${classes}"><td>${i + 1}</td><td><span class="cor" style="background:#${k.dr.cor.toString(16).padStart(6, '0')}"></span>${numeroKart(k.dr.numero)}</td>` +
        `<td>${k.lap}</td><td>${tempo(ultima)}</td><td${roxo}>${tempo(k.best)}</td></tr>`;
    }).join('');
    el.pos.textContent = `${ordem.indexOf(jogador) + 1}/${ordem.length}`;
    el.volta.textContent = Math.max(jogador.lap, 1);
    el.ultima.textContent = tempo(jogador.laps.length ? jogador.laps[jogador.laps.length - 1] : null);
    el.melhor.textContent = tempo(jogador.best);
    el.melhor.classList.toggle('melhor-sessao', jogador.best != null && jogador.best === melhorGeral);
  }
}
