// Telas por cima do jogo: início, pausa, folha final (formato KGV) e ranking local. Uma ação primária vermelha por tela.
import { MODOS, COLUNAS_KGV, linhaKgv } from './prova.js';
import { tempo } from './tempo.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NOME = 'rcl-karts.nome', MODO = 'rcl-karts.modo';

export class Telas {
  constructor(raiz, ranking) {
    this.raiz = raiz;
    this.ranking = ranking;
    this.acoes = {};
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-acao]');
      if (b) this.acoes[b.dataset.acao]?.(b);
    });
    raiz.addEventListener('submit', (e) => { e.preventDefault(); this.acoes.largar?.(); });
  }

  aberta() { return !this.raiz.hidden; }
  fecha() { this.raiz.hidden = true; this.raiz.innerHTML = ''; this.atual = null; }
  abre(html, nome) { this.raiz.innerHTML = html; this.raiz.hidden = false; this.atual = nome; }

  get nome() { return (localStorage.getItem(NOME) || 'VOCÊ').toUpperCase(); }
  get modo() { const m = localStorage.getItem(MODO); return MODOS[m] ? m : 'bateria'; }

  inicio() {
    const rec = this.ranking.recorde();
    const modos = Object.entries(MODOS).map(([k, m]) => `
      <label class="opcao"><input type="radio" name="modo" value="${k}" ${k === this.modo ? 'checked' : ''}>
        <span><strong>${m.nome}</strong><small>${m.descricao}</small></span></label>`).join('');
    this.abre(`
      <form class="tela painel tela-inicio" autocomplete="off">
        <p class="kicker">Kart rental · KGV Circuito 101 · 1.015 m</p>
        <h1 class="titulo">RCL-KARTS</h1>
        <label class="campo"><span class="kicker">Seu nome na folha</span>
          <input name="nome" maxlength="24" value="${esc(this.nome === 'VOCÊ' ? '' : this.nome)}" placeholder="VOCÊ"></label>
        <fieldset class="modos"><legend class="kicker">Modo</legend>${modos}</fieldset>
        <p class="recorde">Seu recorde no 101: <span class="chrono">${rec ? tempo(rec) : '—'}</span></p>
        <div class="botoes">
          <button type="submit" class="btn-primario">Largar</button>
          <button type="button" class="btn-ghost" data-acao="ranking">Ranking</button>
        </div>
        <p class="dica">Setas ou WASD pilotam · controle: analógico, RT e LT · Esc pausa</p>
      </form>`, 'inicio');
    const form = this.raiz.querySelector('form');
    form.addEventListener('change', () => this.guardaEscolhas(form));
    form.addEventListener('input', () => this.guardaEscolhas(form));
    form.querySelector('[name=nome]').focus();
  }

  guardaEscolhas(form) {
    const nome = form.nome.value.trim().toUpperCase().replace(/[^A-ZÀ-Ý0-9 .'-]/g, '');
    localStorage.setItem(NOME, nome || 'VOCÊ');
    localStorage.setItem(MODO, form.modo.value);
  }

  pausa() {
    this.abre(`
      <div class="tela painel tela-pausa">
        <p class="kicker">Prova parada</p><h2 class="titulo">PAUSA</h2>
        <div class="botoes">
          <button class="btn-primario" data-acao="continuar">Continuar</button>
          <button class="btn-ghost" data-acao="recomecar">Recomeçar</button>
          <button class="btn-ghost" data-acao="menu">Menu</button>
        </div>
      </div>`, 'pausa');
  }

  folha(prova, linhas, jogador) {
    const melhor = Math.min(...linhas.map((l) => l.melhor ?? Infinity));
    const corpo = linhas.map((l) => {
      const c = linhaKgv(l).map((v, i) => {
        const roxo = i === 5 && l.melhor === melhor ? ' class="melhor-sessao"' : '';
        return `<td${roxo}>${esc(v)}</td>`;
      }).join('');
      return `<tr class="${l.k === jogador ? 'jogador' : ''}">${c}</tr>`;
    }).join('');
    const eu = linhas.find((l) => l.k === jogador);
    this.abre(`
      <div class="tela painel tela-folha">
        <p class="kicker">${esc(prova.modo.nome)} · KGV Circuito 101 · ${new Date().toLocaleDateString('pt-BR')}</p>
        <h2 class="titulo">Resultado</h2>
        ${eu ? `<p class="resumo">P${eu.pos} de ${linhas.length} · ${eu.voltas} voltas · melhor <span class="chrono">${tempo(eu.melhor)}</span></p>` : ''}
        <div class="rolagem"><table class="folha-kgv">
          <thead><tr>${COLUNAS_KGV.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${corpo}</tbody>
        </table></div>
        <div class="botoes">
          <button class="btn-primario" data-acao="recomecar">Nova corrida</button>
          <button class="btn-ghost" data-acao="ranking">Ranking</button>
          <button class="btn-ghost" data-acao="menu">Menu</button>
        </div>
      </div>`, 'folha');
  }

  rankingTela(volta = 'inicio') {
    const linha = (p, i) => `<tr><td>${i + 1}</td><td class="chrono">${tempo(p.melhor)}</td><td>${esc(MODOS[p.modo]?.nome ?? p.modo)}</td>` +
      `<td>${p.pos ? `P${p.pos}/${p.de}` : '—'}</td><td>${esc(p.kart)}</td><td>${new Date(p.data).toLocaleDateString('pt-BR')}</td></tr>`;
    const melhores = this.ranking.melhores(10), ultimas = this.ranking.ultimas(10);
    const vazio = '<tr><td colspan="6" class="vazio">Nenhuma prova ainda.</td></tr>';
    this.abre(`
      <div class="tela painel tela-ranking">
        <p class="kicker">Neste navegador</p><h2 class="titulo">Ranking</h2>
        <h3 class="kicker">Melhores voltas</h3>
        <table class="lista"><thead><tr><th>#</th><th>Melhor</th><th>Modo</th><th>Posição</th><th>Kart</th><th>Data</th></tr></thead>
          <tbody>${melhores.length ? melhores.map(linha).join('') : vazio}</tbody></table>
        <h3 class="kicker">Últimas provas</h3>
        <table class="lista"><thead><tr><th>#</th><th>Melhor</th><th>Modo</th><th>Posição</th><th>Kart</th><th>Data</th></tr></thead>
          <tbody>${ultimas.length ? ultimas.map(linha).join('') : vazio}</tbody></table>
        <div class="botoes"><button class="btn-primario" data-acao="${volta}">Voltar</button></div>
      </div>`, 'ranking');
  }
}
