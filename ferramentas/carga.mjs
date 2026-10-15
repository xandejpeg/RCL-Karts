// Conta da primeira carga do jogo (meta: até 40 MB): o que o repositório serve (index.html, src/, vendor/, assets/),
// os pilotos da frente Personagens (assets/personagens/, fora do git: tamanho real se estiverem no disco, senão a
// previsão) e a arte que ainda não chegou. Os testes e as ferramentas não vão para o servidor.
// Uso: node ferramentas/carga.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const META_MB = 40;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PERSONAGENS = 'assets/personagens';
// previsões (mensagem 007): 7 corpos modelo.glb de ~1,4 MB; kart de 1 a 2 MB; piloto.glb (11 MB) só para o jogador
export const PREVISTO = {
  personagens: { nome: '7 pilotos modelo.glb (~1,4 MB cada)', mb: 7 * 1.4 },
  kart: { nome: 'kart.glb (contrato da 007)', mb: 2 },
  close: { nome: 'piloto.glb do jogador (close, ainda não usado)', mb: 11 }
};

function arquivos(dir) {
  const d = path.join(RAIZ, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name).replace(/\\/g, '/');
    return e.isDirectory() ? arquivos(rel) : [{ arquivo: rel, bytes: fs.statSync(path.join(RAIZ, rel)).size }];
  });
}
const mb = (lista) => lista.reduce((a, f) => a + f.bytes, 0) / 1024 / 1024;

export function cargaInicial() {
  const todos = [{ arquivo: 'index.html', bytes: fs.statSync(path.join(RAIZ, 'index.html')).size }, ...['src', 'vendor', 'assets'].flatMap(arquivos)];
  const repo = todos.filter((f) => !f.arquivo.startsWith(PERSONAGENS)), pers = todos.filter((f) => f.arquivo.startsWith(PERSONAGENS));
  const arte = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets/arte.json'), 'utf8'));
  const partes = [
    { nome: 'repositório (código, three.js, pista)', mb: mb(repo), real: true },
    pers.length ? { nome: `pilotos em ${PERSONAGENS}/ (${pers.length} arquivos)`, mb: mb(pers), real: true } : { ...PREVISTO.personagens, real: false },
    arte.kart ? { nome: 'kart.glb', mb: 0, real: true } : { ...PREVISTO.kart, real: false }
  ];
  const hoje = partes.filter((p) => p.real).reduce((a, p) => a + p.mb, 0), total = partes.reduce((a, p) => a + p.mb, 0);
  return { lista: todos, partes, hoje, total, comClose: total + PREVISTO.close.mb, mb: mb(repo) };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('ferramentas/carga.mjs')) {
  const c = cargaInicial();
  for (const p of c.partes) console.log(`  ${p.mb.toFixed(2).padStart(6)} MB  ${p.real ? '' : '(previsto) '}${p.nome}`);
  console.log(`primeira carga hoje: ${c.hoje.toFixed(2)} MB · com a arte prevista: ${c.total.toFixed(1)} MB · com o piloto.glb do jogador: ${c.comClose.toFixed(1)} MB (meta ${META_MB} MB)`);
}
