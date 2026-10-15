// Conta da primeira carga do jogo (meta: até 40 MB): tudo o que a página serve (index.html, src/, vendor/, assets/) mais
// a arte prevista que ainda não chegou. Os testes e as ferramentas não vão para o servidor.
// Uso: node ferramentas/carga.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const META_MB = 40;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// arte prevista (mensagem 007): kart de 1 a 2 MB; pilotos com o modelo.glb leve (~1,4 MB cada). Com 20 karts, 6 corpos
// diferentes bastam (macacão e capacete tingidos por kart); o piloto.glb (11 MB) só para o jogador, em close.
export const PREVISTO = [
  { nome: 'kart.glb (contrato da 007)', mb: 2 },
  { nome: '6 pilotos modelo.glb (~1,4 MB cada)', mb: 6 * 1.4 },
  { nome: 'piloto.glb do jogador (close)', mb: 11 }
];

function arquivos(dir) {
  const d = path.join(RAIZ, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? arquivos(rel) : [{ arquivo: rel.replace(/\\/g, '/'), bytes: fs.statSync(path.join(RAIZ, rel)).size }];
  });
}

export function cargaInicial() {
  const lista = [{ arquivo: 'index.html', bytes: fs.statSync(path.join(RAIZ, 'index.html')).size }, ...['src', 'vendor', 'assets'].flatMap(arquivos)];
  const bytes = lista.reduce((a, f) => a + f.bytes, 0), mb = bytes / 1024 / 1024;
  const previsto = PREVISTO.reduce((a, p) => a + p.mb, 0);
  return { lista, mb, previsto, total: mb + previsto };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('ferramentas/carga.mjs')) {
  const c = cargaInicial();
  for (const f of [...c.lista].sort((a, b) => b.bytes - a.bytes).slice(0, 8)) console.log(`  ${(f.bytes / 1024).toFixed(0).padStart(6)} KB  ${f.arquivo}`);
  console.log(`hoje: ${c.mb.toFixed(2)} MB em ${c.lista.length} arquivos`);
  for (const p of PREVISTO) console.log(`  + ${p.mb.toFixed(1)} MB  ${p.nome}`);
  console.log(`com a arte prevista: ${c.total.toFixed(1)} MB (meta ${META_MB} MB)`);
}
