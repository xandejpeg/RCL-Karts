// RCL-Karts · relevo e bordas do traçado (sem three, testado no Node). Monta, a partir do traçado bruto:
// - a altura de cada ponto do eixo, pelo perfil do relevo (distância da linha de largada → fração da volta);
// - as bordas, como na hot lap do vídeo do 101: onde a linha de corrida encosta na borda por dentro da curva, zebra fina
//   com relevo (1,0 m) e faixa azul curta; onde encosta por fora (saída e tomada), zebra larga pintada (1,8 m) e faixa azul
//   larga; depois, grama até o muro;
// - os muros de pneus em volta de todos os trechos, perto da pista (como no 101 real: escape curto), no meio do caminho
//   quando dois trechos passam perto, e pilhas de pneus soltas por dentro das curvas fechadas (não dá para cortar).
// O Jersey do traçado continua (reta dos boxes).

export const BORDAS = {
  dentro: { zebra: 1.0, tipo: 1, azul: 0.8 },       // tangência: zebra fina (com relevo) e azul curta
  fora: { zebra: 1.8, tipo: 2, azul: 1.4 },         // saída e tomada: zebra larga pintada e azul larga
  encosta: 0.25,                                    // m: a linha conta como encostada a esta distância do limite dela
  raioCurva: 80, alcance: 22,                       // m: zebra só perto (até 22 pontos, 44 m) de um ápice com raio < 80 m
  espalha: 3,                                       // pontos (2 m cada) de zebra antes e depois de onde a linha encosta
  grama: 1.2,                                       // m de grama entre a faixa azul e o muro
  escapeMin: 2.2, escapeMax: 4.5,                   // m do limite do asfalto ao muro
  rente: 0.8,                                       // m: o mais perto que o muro chega do asfalto (trechos colados)
  raioMuro: 0.32,                                   // m: meia largura da fileira de pneus
  pilhaRaio: 14, pilhaComp: 3,                      // curva mais fechada que isto ganha pilha solta por dentro (3 m)
  raioSaida: 30, saida: [4, 14]                     // curva com raio < 30 m: zebra larga por fora na saída (8 a 28 m)
};

// Altura (m) de cada ponto do eixo pelo perfil do relevo: pontos [distância da linha, altura], na fração da volta.
export function alturasDoEixo(track, relevo, linha) {
  const P = relevo.pontos, C = relevo.comprimento || P[P.length - 1][0], esc = relevo.escala ?? 1;
  const perfil = [...P, [C, P[0][1]]];
  const h = new Array(track.n);
  for (let i = 0; i < track.n; i++) {
    const x = (track.wrap(track.s[i] - linha) / track.L) * C;
    let k = 1;
    while (k < perfil.length - 1 && perfil[k][0] < x) k++;
    const [x0, y0] = perfil[k - 1], [x1, y1] = perfil[k], t = (x - x0) / ((x1 - x0) || 1);
    h[i] = +((y0 + (y1 - y0) * Math.max(0, Math.min(1, t))) * esc).toFixed(3);
  }
  return h;
}

// lado de dentro da curva em cada ponto: +1 direita, −1 esquerda (pela virada da tangente)
function ladoDeDentro(track, i) {
  const n = track.n, a = (i - 2 + n) % n, b = (i + 2) % n;
  const cx = track.tx[b] - track.tx[a], cz = track.tz[b] - track.tz[a];
  return Math.sign(cx * -track.tz[i] + cz * track.tx[i]) || 1;
}

// Bordas por ponto: { esquerda: [[zebra, tipo, azul], …], direita: […] } a partir da linha de corrida (line.d, line.k).
// Cada trecho onde a linha encosta no limite é ligado ao ápice mais perto (até `alcance` pontos): do lado de dentro desse
// ápice é tangência (zebra fina); do lado de fora é tomada ou saída (zebra larga). Longe de curva, nada.
export function bordasDaLinha(track, line, lim, B = BORDAS) {
  const n = track.n, lados = { '-1': new Array(n).fill(null), '1': new Array(n).fill(null) };
  const apices = [];
  for (let i = 0; i < n; i++) {
    const k = Math.abs(line.k[i]);
    if (k < 1 / B.raioCurva) continue;
    let max = true;
    for (let o = -6; o <= 6; o++) if (o && Math.abs(line.k[(i + o + n) % n]) > k) { max = false; break; }
    if (max) apices.push({ i, lado: ladoDeDentro(track, i) });
  }
  const alcance = B.alcance ?? 20;
  const apiceMaisPerto = (i) => {
    let m = null, dm = Infinity;
    for (const a of apices) { const d = Math.min((i - a.i + n) % n, (a.i - i + n) % n); if (d < dm) { dm = d; m = a; } }
    return dm <= alcance ? m : null;
  };
  for (let i = 0; i < n; i++) {
    for (const sg of [-1, 1]) {
      if (sg * line.d[i] < lim - B.encosta) continue;
      const a = apiceMaisPerto(i);
      let tipo = null;
      if (a) tipo = a.lado === sg ? B.dentro : B.fora;
      else {
        // curva rápida longe de ápice (tomada ou saída de um S): zebra larga; em reta, nada
        let kmax = 0;
        for (let o = -8; o <= 8; o++) kmax = Math.max(kmax, Math.abs(line.k[(i + o + n) % n]));
        if (kmax > 1 / (B.raioRapida ?? 150)) tipo = B.fora;
      }
      if (!tipo) continue;
      for (let o = -B.espalha; o <= B.espalha; o++) {
        const j = (i + o + n) % n, atual = lados[sg][j];
        // dentro vence fora no mesmo ponto (tangência é tangência)
        if (!atual || (tipo === B.dentro && atual !== B.dentro)) lados[sg][j] = tipo;
      }
    }
  }
  // toda curva de verdade (raio < raioSaida) tem zebra fina por dentro no ápice (±6 m), mesmo onde a linha não encosta,
  // e zebra larga por fora na saída, do ápice + 8 m até + 28 m (quem sai largo pisa na pintada antes da grama, como no 101)
  for (const a of apices) {
    if (1 / Math.abs(line.k[a.i]) > (B.raioSaida ?? 30)) continue;
    for (let o = -3; o <= 3; o++) {
      const j = (a.i + o + n) % n;
      if (lados[a.lado][j] !== B.dentro) lados[a.lado][j] = B.dentro;
    }
    const sg = -a.lado;
    for (let o = B.saida?.[0] ?? 4; o <= (B.saida?.[1] ?? 14); o++) {
      const j = (a.i + o) % n;
      if (!lados[sg][j]) lados[sg][j] = B.fora;
    }
  }
  // fecha buracos curtos (até 4 pontos) entre trechos com zebra do mesmo tipo
  for (const sg of [-1, 1]) {
    const L = lados[sg];
    for (let i = 0; i < n; i++) {
      if (L[i] || !L[(i - 1 + n) % n]) continue;
      for (let g = 1; g <= 4; g++) if (L[(i + g) % n] === L[(i - 1 + n) % n]) { for (let k = 0; k < g; k++) L[(i + k) % n] = L[(i - 1 + n) % n]; break; }
    }
  }
  const lista = (sg) => lados[sg].map((t) => (t ? [t.zebra, t.tipo, t.azul] : [0, 0, 0]));
  return { esquerda: lista(-1), direita: lista(1) };
}

// Distância (m) do ponto (x, z) global ao eixo, sem contar o trecho perto de s (±janela m): a outra parte da pista.
function distanciaOutroTrecho(track, x, z, s, janela = 30) {
  let m = Infinity;
  for (let i = 0; i < track.n; i++) {
    const ds = Math.abs(track.wrap(track.s[i] - s + track.L / 2) - track.L / 2);
    if (ds < janela) continue;
    const d = Math.hypot(track.x[i] - x, track.z[i] - z);
    if (d < m) m = d;
  }
  return m;
}

// Muros de pneus em volta da pista. Para cada lado, a cada ponto do eixo: o muro fica a (zebra + azul + grama) do
// asfalto, entre escapeMin e escapeMax; se outro trecho passa perto, o muro vai para o meio (igual distância das duas
// bordas), nunca mais perto que `rente`. Onde o Jersey já faz o muro, não põe pneu. Devolve polilinhas {tipo, lado, raio,
// pontos} em coordenadas globais, e as pilhas soltas por dentro das curvas fechadas.
export function murosDaPista(track, line, bordas, jersey = [], B = BORDAS) {
  const n = track.n, hw = track.hw, out = [], p = {};
  // trechos cobertos pelo Jersey: s e lado de cada ponto dele
  const cobertos = [];
  for (const j of jersey) {
    const L = Math.hypot(j.bx - j.ax, j.bz - j.az), k = Math.max(1, Math.ceil(L / 2));
    for (let t = 0; t <= k; t++) {
      const q = track.project(j.ax + ((j.bx - j.ax) * t) / k, j.az + ((j.bz - j.az) * t) / k);
      cobertos.push({ s: q.s, lado: Math.sign(q.d) });
    }
  }
  const coberto = (s, lado) => cobertos.some((c) => c.lado === lado && Math.abs(track.wrap(c.s - s + track.L / 2) - track.L / 2) < 2.5);
  for (const [sg, nome] of [[-1, 'esquerda'], [1, 'direita']]) {
    let atual = null;
    const fecha = () => { if (atual && atual.pontos.length > 1) out.push(atual); atual = null; };
    // a cada 1 m de eixo (por fora das curvas fechadas o muro anda quase o dobro: com o passo de 2 m do eixo abria buraco)
    const passos = Math.ceil(track.L);
    for (let k = 0; k <= passos; k++) {
      const s = (track.L * (k % passos)) / passos, ii = track.idx(s), [z, , a] = bordas[nome][ii];
      if (coberto(s, sg)) { fecha(); continue; }
      let e = Math.max(B.escapeMin, Math.min(B.escapeMax, z + a + B.grama));
      // outro trecho perto: muro no meio do caminho (busca binária no afastamento)
      let lo = B.rente, hi = e;
      track.point(s, sg * (hw + hi), p);
      if (distanciaOutroTrecho(track, p.x, p.z, s) - hw < hi) {
        for (let it = 0; it < 18; it++) {
          const mid = (lo + hi) / 2;
          track.point(s, sg * (hw + mid), p);
          if (distanciaOutroTrecho(track, p.x, p.z, s) - hw < mid) hi = mid; else lo = mid;
        }
        e = Math.max(B.rente, lo);
      }
      track.point(s, sg * (hw + e), p);
      const ponto = [+p.x.toFixed(3), +p.z.toFixed(3)];
      if (atual) {
        const ult = atual.pontos[atual.pontos.length - 1];
        if (Math.hypot(ult[0] - ponto[0], ult[1] - ponto[1]) > 3.5) fecha();
      }
      if (!atual) atual = { tipo: 'pneus', lado: nome, raio: B.raioMuro, pontos: [] };
      atual.pontos.push(ponto);
    }
    fecha();
  }
  // pilhas soltas por dentro das curvas fechadas: um trecho curto de pneus logo depois da faixa azul, no ápice
  const pilhas = [];
  for (let i = 0; i < n; i++) {
    const r = 1 / Math.max(1e-6, Math.abs(line.k[i]));
    if (r > B.pilhaRaio) continue;
    let menor = true;
    for (let o = -6; o <= 6; o++) if (o && Math.abs(line.k[(i + o + n) % n]) > Math.abs(line.k[i])) { menor = false; break; }
    if (!menor) continue;
    const sg = ladoDeDentro(track, i), nome = sg > 0 ? 'direita' : 'esquerda', [z, , a] = bordas[nome][i];
    const d = sg * (hw + z + a + 0.4), s = track.s[i], pts = [];
    for (const ds of [-B.pilhaComp / 2, 0, B.pilhaComp / 2]) { track.point(s + ds, d, p); pts.push([+p.x.toFixed(3), +p.z.toFixed(3)]); }
    pilhas.push({ tipo: 'pneus', lado: nome, raio: B.raioMuro, pontos: pts, pilha: true });
  }
  return { muros: out, pilhas };
}
