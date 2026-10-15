// Servidor de desenvolvimento: serve a pasta do jogo sem cache (Cache-Control: no-store), para o navegador sempre pegar
// os módulos novos. (O python -m http.server não manda cabeçalho de cache e o Chrome guarda os .js por heurística.)
// Uso: node ferramentas/servidor.mjs [porta]   → http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.argv[2]) || 8080;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arquivo = path.join(RAIZ, url.endsWith('/') ? `${url}index.html` : url);
  if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.writeHead(404, { 'Cache-Control': 'no-store' });
    res.end('não achei');
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(arquivo).pipe(res);
}).listen(PORTA, '127.0.0.1', () => console.log(`RCL-Karts em http://localhost:${PORTA}`));
