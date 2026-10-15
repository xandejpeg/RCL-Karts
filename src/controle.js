// Comandos do jogador: teclado e controle (Gamepad API, mapeamento padrão do Xbox/PlayStation).
// Saída por quadro: volante −1 (direita) a 1 (esquerda), acel e freio de 0 a 1, e os botões apertados neste quadro.
//
// Teclado: ↑/W acelera, ↓/S/Espaço freia, ←/A e →/D esterçam (o volante vai e volta com velocidade limitada).
// Controle: analógico esquerdo esterça, RT acelera, LT freia (A e B também), Y volta à pista, Back troca a câmera,
// Start pausa.

const TECLAS = {
  acel: ['ArrowUp', 'KeyW'],
  freio: ['ArrowDown', 'KeyS', 'Space'],
  esquerda: ['ArrowLeft', 'KeyA'],
  direita: ['ArrowRight', 'KeyD']
};
const BOTAO = { a: 0, b: 1, y: 3, lt: 6, rt: 7, back: 8, start: 9 };
const ZONA_MORTA = 0.08;

export class Controle {
  constructor() {
    this.teclas = new Set();
    this.volanteTeclado = 0;
    this.botoesAntes = [];
    this.controle = null;
    window.addEventListener('keydown', (e) => {
      if (Object.values(TECLAS).some((l) => l.includes(e.code))) e.preventDefault();
      this.teclas.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.teclas.delete(e.code));
    window.addEventListener('blur', () => this.teclas.clear());
  }

  aperta(lista) {
    return lista.some((c) => this.teclas.has(c)) ? 1 : 0;
  }

  le(dt) {
    // teclado: o volante anda até o alvo a 4/s e volta ao centro a 7/s
    const alvo = this.aperta(TECLAS.esquerda) - this.aperta(TECLAS.direita);
    const taxa = alvo === 0 || Math.sign(alvo) !== Math.sign(this.volanteTeclado) ? 7 : 4;
    const passo = taxa * dt;
    this.volanteTeclado += Math.max(-passo, Math.min(passo, alvo - this.volanteTeclado));
    const out = {
      volante: this.volanteTeclado,
      acel: this.aperta(TECLAS.acel),
      freio: this.aperta(TECLAS.freio),
      botoes: new Set()
    };

    const gp = [...(navigator.getGamepads?.() || [])].find((g) => g && g.connected);
    this.controle = gp ? gp.id : null;
    if (gp) {
      const eixo = gp.axes[0] || 0;
      const volante = Math.abs(eixo) < ZONA_MORTA ? 0 : -Math.sign(eixo) * (Math.abs(eixo) - ZONA_MORTA) / (1 - ZONA_MORTA);
      const b = (i) => gp.buttons[i]?.value ?? 0;
      const acel = Math.max(b(BOTAO.rt), b(BOTAO.a)), freio = Math.max(b(BOTAO.lt), b(BOTAO.b));
      if (Math.abs(volante) > Math.abs(out.volante)) out.volante = volante;
      out.acel = Math.max(out.acel, acel);
      out.freio = Math.max(out.freio, freio);
      for (const [nome, i] of [['volta', BOTAO.y], ['camera', BOTAO.back], ['pausa', BOTAO.start]]) {
        const agora = !!gp.buttons[i]?.pressed;
        if (agora && !this.botoesAntes[i]) out.botoes.add(nome);
        this.botoesAntes[i] = agora;
      }
    }
    return out;
  }
}
