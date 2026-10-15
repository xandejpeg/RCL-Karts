// Ranking local (sem login): cada prova do jogador fica guardada no navegador (localStorage).
export const CHAVE = 'rcl-karts.v1';
const MAXIMO = 200;

export class Ranking {
  constructor(armazenamento = globalThis.localStorage) {
    this.arm = armazenamento;
  }

  lista() {
    try {
      const d = JSON.parse(this.arm?.getItem(CHAVE) || '{}');
      return Array.isArray(d.provas) ? d.provas : [];
    } catch {
      return [];
    }
  }

  // registro: { data, modo, nome, kart, pos, de, voltas, melhor, total, s1, s2, s3, sfspd }
  guarda(registro) {
    const provas = [registro, ...this.lista()].slice(0, MAXIMO);
    this.arm?.setItem(CHAVE, JSON.stringify({ provas }));
    return provas;
  }

  // melhores voltas (uma por prova), da mais rápida para a mais lenta
  melhores(n = 10) {
    return this.lista().filter((p) => p.melhor != null).sort((a, b) => a.melhor - b.melhor).slice(0, n);
  }

  ultimas(n = 10) {
    return this.lista().slice(0, n);
  }

  recorde() {
    return this.melhores(1)[0]?.melhor ?? null;
  }
}

// o registro da prova do jogador a partir da linha dele na folha
export function registroDaFolha(linha, { modo, de, nome, data = new Date().toISOString() }) {
  return {
    data, modo, nome, kart: linha.numero, pos: linha.pos, de, voltas: linha.voltas, melhor: linha.melhor,
    total: linha.total, s1: linha.s1, s2: linha.s2, s3: linha.s3, sfspd: linha.sfspd
  };
}
