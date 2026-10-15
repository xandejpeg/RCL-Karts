// RCL-Karts · testes: no Node, o especificador 'three' aponta para a cópia do vendor (no navegador é o importmap).
// Uso no teste: register('./support/three-hook.mjs', import.meta.url) e depois import() dinâmico dos módulos com three.
const THREE = new URL('../../vendor/three/three.module.js', import.meta.url).href;
export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'three') return { url: THREE, shortCircuit: true };
  return proximo(especificador, contexto);
}
