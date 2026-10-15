// HUD da prova: cabeçalho (modo, tempo de prova e o que falta), luzes de largada, torre de tempos, painel do jogador
// (posição, volta, km/h e setores) e aviso de bandeirada.
import { tempo, numeroKart } from './tempo.js';

export class Hud {
  constructor(raiz) {
    raiz.innerHTML = `
      <header class="hud-cab painel">
        <p class="kicker" data-modo>RCL-Karts · KGV Circuito 101</p>
        <p class="hud-relogio chrono" data-relogio>0.000</p>
        <p class="hud-restante" data-restante></p>
        <p class="hud-camera" data-camera></p>
      </header>
      <div class="luzes" data-luzes hidden>${'<span></span>'.repeat(5)}</div>
      <p class="hud-aviso painel" data-aviso hidden></p>
      <section class="hud-torre painel" aria-label="Torre de tempos">
        <table>
          <thead><tr><th>P</th><th>No.</th><th>Gap</th><th>Última</th><th>Melhor</th></tr></thead>
          <tbody data-torre></tbody>
        </table>
      </section>
      <section class="hud-piloto painel" aria-label="Seu kart">
        <div><p class="kicker">Posição</p><p class="hud-grande chrono" data-pos>—</p></div>
        <div><p class="kicker">Volta</p><p class="hud-grande chrono" data-volta>—</p></div>
        <div><p class="kicker">km/h</p><p class="hud-grande chrono" data-vel>0</p></div>
        <div class="hud-setores"><p class="kicker">S1 · S2 · S3</p><p class="chrono"><span data-s0>—</span> <span data-s1>—</span> <span data-s2>—</span></p>
          <p class="kicker">Última · Melhor</p><p class="chrono"><span data-ultima>—</span> <span data-melhor>—</span></p></div>
      </section>
      <footer class="hud-ajuda painel">
        <span><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> pilotar</span><span><kbd>T</kbd> volta à pista</span>
        <span><kbd>C</kbd> câmera</span><span><kbd>[</kbd><kbd>]</kbd> outro kart</span><span><kbd>Esc</kbd> pausa</span>
        <span><kbd>R</kbd> recomeçar</span><span><kbd>H</kbd> HUD</span><span class="hud-controle" data-controle></span>
      </footer>`;
    this.raiz = raiz;
    const nomes = ['modo', 'relogio', 'restante', 'camera', 'luzes', 'aviso', 'torre', 'pos', 'volta', 'vel', 's0', 's1', 's2', 'ultima', 'melhor', 'controle'];
    this.el = Object.fromEntries(nomes.map((s) => [s, raiz.querySelector(`[data-${s}]`)]));
  }

  alterna() { this.raiz.hidden = !this.raiz.hidden; }
  mostra(sim) { this.raiz.hidden = !sim; }

  // a cada quadro: velocidade e luzes
  quadro(prova, jogador) {
    this.el.vel.textContent = Math.round(jogador.v * 3.6);
    const n = prova.luzesAcesas;
    this.el.luzes.hidden = prova.fase !== 'luzes';
    this.el.luzes.querySelectorAll('span').forEach((s, i) => s.classList.toggle('acesa', i < n));
  }

  // a cada 250 ms: o resto
  update({ prova, seguido, jogador, modoCamera, controle }) {
    const el = this.el, race = prova.race, ordem = prova.classificacao(), lider = ordem[0];
    el.modo.textContent = `RCL-Karts · KGV 101 · ${prova.modo.nome}`;
    el.relogio.textContent = tempo(race.time);
    el.restante.textContent = prova.fase === 'luzes' ? 'Largada parada' : prova.restante.texto;
    el.camera.textContent = `Câmera ${modoCamera} · kart ${numeroKart(seguido.dr.numero)}${seguido === jogador ? ' · você' : ''}`;
    el.controle.textContent = controle ? 'Controle conectado' : '';
    const melhorGeral = prova.melhorVolta;
    el.torre.innerHTML = ordem.map((k, i) => {
      const ultima = prova.ultima(k), melhor = prova.melhor(k);
      const roxo = melhor != null && melhor === melhorGeral ? ' class="melhor-sessao"' : '';
      const classes = [k === jogador && 'jogador', k === seguido && 'foco', prova.dados.get(k).chegou && 'chegou'].filter(Boolean).join(' ');
      return `<tr class="${classes}"><td>${i + 1}</td><td><span class="cor" style="background:#${k.dr.cor.toString(16).padStart(6, '0')}"></span>${numeroKart(k.dr.numero)}</td>` +
        `<td>${prova.gap(k, lider)}</td><td>${tempo(ultima)}</td><td${roxo}>${tempo(melhor)}</td></tr>`;
    }).join('');

    const d = prova.dados.get(jogador);
    el.pos.textContent = `${ordem.indexOf(jogador) + 1}/${ordem.length}`;
    const v = d.chegou ? d.chegou.voltas : d.voltas.length + (d.passagens.length ? 1 : 0);
    el.volta.textContent = prova.modo.voltas ? `${Math.max(v, 1)}/${prova.modo.voltas}` : Math.max(v, 1);
    // setores da volta em curso; os que ainda não fecharam mostram os da volta anterior
    for (let i = 0; i < 3; i++) {
      const s = d.setoresVolta[i] ?? d.ultimosSetores[i], e = el[`s${i}`];
      e.textContent = tempo(s);
      e.className = s != null && s === prova.melhorSetor[i] ? 'melhor-sessao' : s != null && s === d.melhorSetor[i] ? 'melhor-pessoal' : '';
    }
    el.ultima.textContent = tempo(prova.ultima(jogador));
    el.melhor.textContent = tempo(d.melhor);
    el.melhor.className = d.melhor != null && d.melhor === melhorGeral ? 'melhor-sessao' : '';

    const aviso = d.chegou ? `Bandeirada · P${ordem.indexOf(jogador) + 1} · ${d.chegou.voltas} voltas`
      : prova.fase === 'bandeira' ? 'Bandeirada para o líder. Cruze a linha.' : '';
    el.aviso.textContent = aviso;
    el.aviso.hidden = !aviso;
  }
}
