// A prova por cima da corrida do RCL-Trânsito: luzes de largada, cronometragem (setores S1/S2/S3 e SFSpd), bandeirada,
// ordem de chegada e a folha final no formato do KGV. Sem DOM, para rodar nos testes.
import { speedProfile } from '../vendor/rcl-transito/traffic-kart.js';
import { tempo, numeroKart } from './tempo.js';

export const MODOS = {
  bateria: { nome: 'Bateria KGV', descricao: '18 min + 1 volta', duracao: 18 * 60, voltas: null },
  curta: { nome: 'Corrida curta', descricao: '5 voltas', duracao: null, voltas: 5 },
  treino: { nome: 'Treino livre', descricao: 'sem fim, só tempo de volta', duracao: null, voltas: null }
};
// cinco luzes vermelhas, uma por segundo; apagam depois de uma espera sorteada
export const LUZES = { acende: 1, esperaMin: 0.4, esperaMax: 2.2 };
// fim da prova: depois da bandeirada, quem não cruzar a linha em até 2 min fica com o que tinha
export const ESPERA_CHEGADA = 120;
// setores pela fração do tempo de volta medida nas folhas reais do 101 (S1 23,2%, fim do S2 em 63,7%)
export const FRACAO_SETORES = [0.232, 0.637];

// posição (m ao longo da volta) dos fins de S1 e S2 no perfil de velocidade de referência da linha de corrida
export function limitesSetores(race, fracoes = FRACAO_SETORES) {
  const T = race.track, line = race.line, n = T.n, { v } = speedProfile(T, line, { cfg: race.cfg });
  const t = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) t[i + 1] = t[i] + line.ds[i] / Math.max(0.5, (v[i] + v[(i + 1) % n]) / 2);
  return fracoes.map((f) => {
    const alvo = f * t[n];
    let i = 0;
    while (t[i + 1] < alvo) i++;
    return T.s[i] + ((alvo - t[i]) / (t[i + 1] - t[i])) * (T.s[i + 1] - T.s[i]);
  });
}

const menor = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));

export class Prova {
  constructor(race, { modo = 'bateria', rnd = Math.random, jogador = null } = {}) {
    this.race = race;
    this.chave = modo;
    this.modo = MODOS[modo];
    this.jogador = jogador;
    this.fase = modo === 'treino' ? 'correndo' : 'luzes';
    this.tLuzes = 0;
    this.apagaEm = 5 * LUZES.acende + LUZES.esperaMin + rnd() * (LUZES.esperaMax - LUZES.esperaMin);
    this.limites = limitesSetores(race);
    this.melhorSetor = [null, null, null];
    this.melhorVolta = null;
    this.chegada = [];
    this.bandeira = null;
    this.dados = new Map(race.karts.map((k) => [k, {
      passagens: [], setoresVolta: [null, null, null], ultimosSetores: [null, null, null],
      melhorSetor: [null, null, null], sf: [], chegou: null, lap: k.lap, s: k.s, tSetor: null
    }]));
  }

  get luzesAcesas() {
    return this.fase === 'luzes' ? Math.min(5, Math.floor(this.tLuzes / LUZES.acende)) : 0;
  }

  // tempo que falta (bateria) ou voltas (curta), para o HUD
  get restante() {
    const m = this.modo;
    if (this.bandeira != null) return { texto: 'Bandeirada' };
    if (m.duracao) {
      const f = m.duracao - this.race.time;
      return f > 0 ? { texto: `Faltam ${tempo(f).replace(/\.\d+$/, '')}`, segundos: f } : { texto: 'Última volta' };
    }
    if (m.voltas) {
      const v = Math.min(m.voltas, (this.race.standings()[0]?.laps.length ?? 0) + 1);
      return { texto: v >= m.voltas ? 'Última volta' : `Volta ${v}/${m.voltas}` };
    }
    return { texto: 'Treino livre' };
  }

  update(dt) {
    if (this.fase === 'luzes') {
      this.tLuzes += dt;
      if (this.tLuzes >= this.apagaEm) this.fase = 'correndo';
      return;
    }
    const race = this.race, T = race.track, t0 = race.time;
    race.update(dt);
    const t1 = race.time;
    for (const k of race.karts) {
      const d = this.dados.get(k);
      let ds = k.s - d.s;
      if (ds < -T.L / 2) ds += T.L;
      if (ds > T.L / 2) ds -= T.L;
      // fins de S1 e S2: tempo interpolado entre o quadro de antes e o de agora
      if (ds > 0 && d.tSetor != null) {
        for (const [i, b] of this.limites.entries()) {
          const desde = T.wrap(b - d.s);
          if (desde > 0 && desde <= ds && d.setoresVolta[i] == null && (i === 0 || d.setoresVolta[0] != null)) {
            const t = t0 + (desde / ds) * (t1 - t0);
            this.fechaSetor(k, d, i, t - d.tSetor);
            d.tSetor = t;
          }
        }
      }
      if (k.lap !== d.lap) this.passagem(k, d);
      d.s = k.s;
    }
    if (this.fase === 'bandeira' && (this.chegada.length === race.karts.length || race.time - this.bandeira > ESPERA_CHEGADA)) {
      this.fase = 'fim';
    }
  }

  fechaSetor(k, d, i, t) {
    d.setoresVolta[i] = t;
    d.melhorSetor[i] = menor(d.melhorSetor[i], t);
    this.melhorSetor[i] = menor(this.melhorSetor[i], t);
  }

  // cruzou a linha: fecha a volta (S3 = volta − S1 − S2), velocidade na linha e chegada
  passagem(k, d) {
    d.lap = k.lap;
    const t = k.lapStart;
    if (d.passagens.length && d.chegou == null) {
      const volta = k.laps[k.laps.length - 1];
      if (d.setoresVolta[0] != null && d.setoresVolta[1] != null) this.fechaSetor(k, d, 2, volta - d.setoresVolta[0] - d.setoresVolta[1]);
      d.ultimosSetores = [...d.setoresVolta];
      this.melhorVolta = menor(this.melhorVolta, volta);
    }
    d.passagens.push(t);
    d.sf.push(k.v * 3.6);
    d.setoresVolta = [null, null, null];
    d.tSetor = t;
    if (d.chegou != null || this.fase === 'luzes' || this.chave === 'treino') return;
    const m = this.modo, lider = this.race.standings()[0] === k;
    const acabou = (m.duracao && t >= m.duracao) || (m.voltas && k.laps.length >= m.voltas);
    if (this.bandeira == null && lider && acabou) {
      this.bandeira = t;
      this.fase = 'bandeira';
    }
    if (this.bandeira != null) {
      d.chegou = { t, voltas: k.laps.length };
      this.chegada.push(k);
      // quem recebeu a quadriculada dá a volta de desaceleração com a IA
      if (k.player) k.player = false;
    }
  }

  // ordem: quem chegou, na ordem de chegada; depois os outros pela corrida (voltas e distância)
  classificacao() {
    const chegou = new Set(this.chegada);
    return [...this.chegada, ...this.race.standings().filter((k) => !chegou.has(k))];
  }

  // diferença para o líder na torre: tempo na última passagem em comum, ou voltas de atraso
  gap(k, lider) {
    if (k === lider) return '—';
    const L = this.race.track.L, a = this.dados.get(k), b = this.dados.get(lider);
    const atras = Math.floor((lider.dist - k.dist) / L);
    if (atras >= 1 && !(a.chegou && b.chegou)) return `+${atras} V`;
    const i = a.passagens.length - 1;
    if (i < 0 || b.passagens[i] == null) return '—';
    return `+${tempo(a.passagens[i] - b.passagens[i])}`;
  }

  // linhas da folha final do KGV
  folha(nomes = new Map()) {
    const ordem = this.classificacao();
    const linhas = ordem.map((k, i) => {
      const d = this.dados.get(k), voltas = d.chegou ? d.chegou.voltas : k.laps.length;
      const total = d.chegou ? d.chegou.t : (d.passagens.length ? d.passagens[d.passagens.length - 1] : null);
      return {
        k, pos: i + 1, numero: numeroKart(k.dr.numero), nome: nomes.get(k) ?? '', classe: 'RENTAL', voltas,
        melhor: k.best, total, s1: d.melhorSetor[0], s2: d.melhorSetor[1], s3: d.melhorSetor[2],
        sfspd: d.sf.length ? Math.max(...d.sf) : null, chegou: !!d.chegou
      };
    });
    const diferenca = (a, b) => {
      if (!b) return '';
      if (a.voltas < b.voltas) { const n = b.voltas - a.voltas; return `${n} Volta${n > 1 ? 's' : ''}`; }
      return a.total != null && b.total != null ? tempo(a.total - b.total) : '';
    };
    return linhas.map((l, i) => ({ ...l, diff: i ? diferenca(l, linhas[0]) : '', espaco: i ? diferenca(l, linhas[i - 1]) : '' }));
  }
}

// uma linha da folha em texto, como nas folhas do KGV (tempos m:ss.mmm, velocidade com vírgula)
export function linhaKgv(l) {
  const sf = l.sfspd == null ? '' : l.sfspd.toFixed(1).replace('.', ',');
  return [l.pos, l.numero, l.nome, l.classe, l.voltas, tempo(l.melhor), l.total == null ? '' : tempo(l.total),
    l.diff, l.espaco, tempo(l.s1), tempo(l.s2), tempo(l.s3), sf];
}
export const COLUNAS_KGV = ['Pos', 'No.', 'Nome', 'Classe', 'Voltas', 'Melhor', 'Tempo Total', 'Diff', 'Espaço', 'S1', 'S2', 'S3', 'SFSpd'];
