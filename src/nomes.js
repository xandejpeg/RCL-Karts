// Nomes fictícios dos pilotos da IA, em MAIÚSCULAS como nas folhas do KGV. Combinações sorteadas de nome e sobrenome
// comuns; conferidas contra os nomes das folhas reais do TrackNight para nenhuma bater com um piloto de verdade.
import { rngK } from '../vendor/rcl-transito/traffic-kart.js';

export const PRENOMES = [
  'ANDRE', 'ARTUR', 'BENTO', 'BRENO', 'CAIO', 'CAUA', 'DAVI', 'DIEGO', 'EDUARDO', 'ENZO', 'FABIO', 'FELIPE', 'GUSTAVO',
  'HEITOR', 'HENRIQUE', 'IAGO', 'IGOR', 'JOAO', 'JULIO', 'LEANDRO', 'LUAN', 'MARCOS', 'MATEUS', 'NICOLAS', 'OTAVIO',
  'PAULO', 'PEDRO', 'RAUL', 'RENAN', 'SAMUEL', 'TIAGO', 'VINICIUS', 'WAGNER', 'YURI', 'ANA', 'BEATRIZ', 'CAMILA',
  'DANIELA', 'ISABELA', 'JULIANA', 'LARISSA', 'MARINA', 'NATALIA', 'PRISCILA', 'RAFAELA', 'TAINA', 'VALERIA'
];
export const SOBRENOMES = [
  'ALMEIDA', 'ARRUDA', 'BARROS', 'BASTOS', 'CAMPOS', 'CARDOSO', 'CASTRO', 'CORREIA', 'COSTA', 'DIAS', 'DUARTE',
  'FARIAS', 'FERRAZ', 'FONSECA', 'FREITAS', 'GALVAO', 'GODOY', 'LACERDA', 'LEMOS', 'MACEDO', 'MARQUES', 'MATOS',
  'MEDEIROS', 'MENDES', 'NOGUEIRA', 'PACHECO', 'PAIVA', 'PEIXOTO', 'PIRES', 'QUEIROZ', 'REZENDE', 'SALES',
  'SAMPAIO', 'TAVARES', 'TEIXEIRA', 'VASCONCELOS', 'VIANA', 'XAVIER'
];

// n nomes diferentes, sorteados pela seed
export function sorteiaNomes(n, seed) {
  const r = rngK(seed ^ 0x6e6f6d65), usados = new Set(), out = [];
  while (out.length < n) {
    const nome = `${PRENOMES[Math.floor(r() * PRENOMES.length)]} ${SOBRENOMES[Math.floor(r() * SOBRENOMES.length)]}`;
    if (!usados.has(nome)) { usados.add(nome); out.push(nome); }
  }
  return out;
}
