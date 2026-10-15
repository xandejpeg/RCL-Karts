// Gancho de resolução para os testes no Node: "three" e "three/addons/..." apontam para vendor/three (como o importmap do
// index.html faz no navegador). Uso: register('./apoio/three-gancho.mjs', import.meta.url) antes de importar o módulo.
const VENDOR = new URL('../../vendor/three/', import.meta.url);

export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'three') return { url: new URL('three.module.js', VENDOR).href, shortCircuit: true };
  if (especificador.startsWith('three/addons/')) return { url: new URL(especificador.slice('three/'.length), VENDOR).href, shortCircuit: true };
  return proximo(especificador, contexto);
}
