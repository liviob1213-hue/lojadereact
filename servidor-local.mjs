// Servidor estático só para desenvolvimento. Não vai para o deploy.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const RAIZ = process.argv[2] ?? process.cwd();
const PORTA = 4173;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';
    const alvo = join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
    let arquivo = alvo;
    try {
      if ((await stat(alvo)).isDirectory()) arquivo = join(alvo, 'index.html');
    } catch {
      arquivo = join(RAIZ, 'index.html'); // espelha o rewrite da Vercel
    }
    const corpo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
    res.end(corpo);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}).listen(PORTA, () => console.log(`pronto em http://localhost:${PORTA}`));
