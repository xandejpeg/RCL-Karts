// Contrato da arte do kart (mensagem 007): nomes dos nós, pontos extras e conversão de eixos. Sem three: funciona com
// qualquer árvore { name, children, userData }, inclusive a do GLTFLoader (os "extras" do glTF viram userData).
//
// Eixos do RCL no GLB: metros, +X para a frente, +Y para cima, +Z para a direita, origem no chão no meio dos eixos.
// O jogo (KartView do RCL-Trânsito) usa no kart: x para a esquerda, y para cima, z para a frente.

export const NOS = {
  raiz: 'kart',
  fixos: ['chassi', 'banco', 'motor'],
  carenagem: 'carenagem',
  esterco: ['esterco_E', 'esterco_D'],
  rodasFrente: ['roda_dianteira_E', 'roda_dianteira_D'],
  rodasTras: ['roda_traseira_E', 'roda_traseira_D'],
  volante: 'volante',
  numeros: ['numero_frente', 'numero_E', 'numero_D']
};
export const MATERIAL_PINTURA = 'kart_pintura';
export const OBRIGATORIOS = [NOS.raiz, NOS.carenagem, ...NOS.esterco, ...NOS.rodasFrente, ...NOS.rodasTras, NOS.volante];
export const OPCIONAIS = [...NOS.fixos, ...NOS.numeros];

// Valores de reserva, no quadro do RCL, se o GLB não trouxer `kartPontos` (medidas da referência Birel N35).
export const PONTOS_PADRAO = {
  banco: [-0.28, 0.2, 0],
  volante: { centro: [0.18, 0.55, 0], direcao: [-0.6, 0.8, 0] },
  pedais: { acelerador: [0.7, 0.12, 0.1], freio: [0.7, 0.12, -0.1] },
  raioRodas: { frente: 0.13, tras: 0.14 }
};
// Olho do piloto (medido no Cláudio v3, mensagem 007): 0,025 + 0,69 m acima do banco e ~0,10 m à frente do ísquio,
// com o tronco ~25° para trás, até a pose de kart chegar.
export const OLHO = { acima: 0.025 + 0.69, frente: 0.1 };
// Volante de kart: ~2 voltas de volante por radiano de roda (batente 0,36 rad ≈ 40° de volante para cada lado).
export const RAZAO_VOLANTE = 2;

export function achaNos(raiz) {
  const nos = {}, pilha = [raiz];
  while (pilha.length) {
    const n = pilha.pop();
    if (n.name && !(n.name in nos)) nos[n.name] = n;
    for (const c of n.children || []) pilha.push(c);
  }
  return nos;
}

const vet = (v, padrao) => (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v : padrao);

// Lê os pontos extras do nó `kart` (userData.kartPontos), completando o que faltar.
export function lePontos(kart) {
  const p = kart?.userData?.kartPontos || {}, P = PONTOS_PADRAO, avisos = [];
  const pega = (v, padrao, nome) => { const r = vet(v, null); if (!r) avisos.push(`kartPontos.${nome} ausente: usando o padrão`); return r || padrao; };
  const raio = (v, padrao, nome) => (Number.isFinite(v) && v > 0.05 && v < 0.5 ? v : (avisos.push(`kartPontos.raioRodas.${nome} ausente: usando ${padrao}`), padrao));
  return {
    pontos: {
      banco: pega(p.banco, P.banco, 'banco'),
      volante: { centro: pega(p.volante?.centro, P.volante.centro, 'volante.centro'), direcao: pega(p.volante?.direcao, P.volante.direcao, 'volante.direcao') },
      pedais: { acelerador: pega(p.pedais?.acelerador, P.pedais.acelerador, 'pedais.acelerador'), freio: pega(p.pedais?.freio, P.pedais.freio, 'pedais.freio') },
      raioRodas: { frente: raio(p.raioRodas?.frente, P.raioRodas.frente, 'frente'), tras: raio(p.raioRodas?.tras, P.raioRodas.tras, 'tras') }
    },
    avisos
  };
}

// Confere o contrato: nós obrigatórios, material de pintura e pontos. ok = dá para usar o modelo.
export function confere(raiz) {
  const nos = achaNos(raiz), faltam = OBRIGATORIOS.filter((n) => !nos[n]);
  const { pontos, avisos } = lePontos(nos[NOS.raiz]);
  for (const n of OPCIONAIS) if (!nos[n]) avisos.push(`nó opcional ${n} ausente`);
  let temPintura = false;
  const pilha = nos[NOS.carenagem] ? [nos[NOS.carenagem]] : [];
  while (pilha.length) {
    const n = pilha.pop();
    const mats = [].concat(n.material || []);
    if (mats.some((m) => m?.name === MATERIAL_PINTURA)) temPintura = true;
    for (const c of n.children || []) pilha.push(c);
  }
  if (!temPintura) avisos.push(`material ${MATERIAL_PINTURA} não achado na carenagem: a cor do piloto não entra`);
  const frenteFilhas = NOS.rodasFrente.every((r, i) => !nos[r] || pai(nos, r) === NOS.esterco[i]);
  if (!frenteFilhas) avisos.push('rodas da frente não são filhas de esterco_E/esterco_D: não vão esterçar');
  return { ok: faltam.length === 0, faltam, avisos, nos, pontos, temPintura };
}

function pai(nos, nome) {
  for (const [k, n] of Object.entries(nos)) if ((n.children || []).includes(nos[nome])) return k;
  return null;
}

// Quadro do RCL (+X frente, +Y cima, +Z direita) → quadro do kart no jogo (x esquerda, y cima, z frente).
export const rclParaJogo = ([x, y, z]) => [-z, y, x];
// O giro do nó raiz que faz essa conversão: −90° em Y leva +X a +Z (frente) e +Z a −X (direita).
export const GIRO_RAIZ_Y = -Math.PI / 2;

// Giro das rodas (rad, em torno de Z do RCL) para a distância andada: rodando para a frente, o giro é negativo em Z.
export const giroRoda = (odo, raio) => -odo / raio;

// Olho do piloto no quadro do jogo (x esquerda, y cima, z frente), a partir do banco.
export function olhoCockpit(pontos) {
  const [x, y, z] = pontos.banco;
  return rclParaJogo([x + OLHO.frente, y + OLHO.acima, z]);
}
