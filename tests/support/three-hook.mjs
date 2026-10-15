// RCL-Karts · testes: no Node, o especificador 'three' (e 'three/addons/...') aponta para a cópia do vendor (no navegador
// é o importmap). Uso no teste: register('./support/three-hook.mjs', import.meta.url) e depois import() dinâmico.
const VENDOR = new URL('../../vendor/three/', import.meta.url);
export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'three') return { url: new URL('three.module.js', VENDOR).href, shortCircuit: true };
  if (especificador.startsWith('three/addons/')) return { url: new URL(especificador.slice('three/'.length), VENDOR).href, shortCircuit: true };
  return proximo(especificador, contexto);
}
