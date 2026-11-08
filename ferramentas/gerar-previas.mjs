/* ============================================================
   FULGOR — gerador das prévias públicas
   ------------------------------------------------------------
   Lê cada pasta de efeito (a fonte, que NÃO vai para o deploy) e
   escreve em /previas um pacote por efeito, pronto para a loja:

     1. junta tudo num arquivo só (inline do .css e do .js locais);
     2. tira os comentários — é neles que está metade do valor do
        que se vende, então eles não saem de casa;
     3. injeta a marca d'água e a trava de teclado/menu;
     4. embaralha os bytes e grava em base64 (.dat).

   O embaralhamento é ofuscação, não criptografia: a chave viaja
   junto, no visor. O que ele resolve é o acesso fácil — abrir a
   URL, ver o fonte, salvar a página, raspar com script. Quem abre
   o inspetor ainda alcança o DOM renderizado; isso vale para
   qualquer página da web.

   Rodar:  node ferramentas/gerar-previas.mjs
   ============================================================ */

import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'previas');
const CHAVE = 'fulgor-previa-2026';

/* ------------------------------------------------------------------
   Remoção de comentários
   Os três passam por um varredor que conhece aspas, template e regex,
   porque um `//` dentro de "https://..." não é comentário e um corte
   ingênuo quebraria o efeito em silêncio.
   ------------------------------------------------------------------ */

function tirarComentariosJS(src) {
  let fora = '';
  let i = 0;
  // último caractere significativo: decide se `/` abre regex ou é divisão
  let ultimo = '';
  const pilhaTemplate = []; // profundidade de ${ } dentro de template literal

  const ehInicioRegex = () => {
    if (!ultimo) return true;
    if (/[)\]}]/.test(ultimo)) return false;
    if (/[A-Za-z0-9_$]/.test(ultimo)) {
      // palavra-chave antes da barra ainda permite regex (return /x/)
      const m = fora.match(/([A-Za-z_$][A-Za-z0-9_$]*)\s*$/);
      return !!m && ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else', 'yield', 'await'].includes(m[1]);
    }
    return true;
  };

  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];

    // comentário de linha
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    // comentário de bloco
    if (c === '/' && d === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // string simples ou dupla
    if (c === '"' || c === "'") {
      const aspa = c;
      fora += c; i++;
      while (i < src.length) {
        if (src[i] === '\\') { fora += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        fora += src[i];
        if (src[i] === aspa) { i++; break; }
        i++;
      }
      ultimo = aspa;
      continue;
    }
    // template literal (com ${ } aninhado)
    if (c === '`') {
      fora += c; i++;
      let dentro = true;
      while (i < src.length && dentro) {
        if (src[i] === '\\') { fora += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          pilhaTemplate.push(1);
          fora += '${'; i += 2;
          // o miolo da interpolação volta ao varredor normal
          let nivel = 1;
          while (i < src.length && nivel > 0) {
            if (src[i] === '{') nivel++;
            else if (src[i] === '}') { nivel--; if (nivel === 0) break; }
            else if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
              const aspa = src[i];
              fora += src[i]; i++;
              while (i < src.length) {
                if (src[i] === '\\') { fora += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
                fora += src[i];
                if (src[i] === aspa) { i++; break; }
                i++;
              }
              continue;
            }
            fora += src[i]; i++;
          }
          fora += '}'; i++;
          pilhaTemplate.pop();
          continue;
        }
        fora += src[i];
        if (src[i] === '`') { dentro = false; }
        i++;
      }
      ultimo = '`';
      continue;
    }
    // regex literal
    if (c === '/' && ehInicioRegex()) {
      fora += c; i++;
      let classe = false;
      while (i < src.length) {
        if (src[i] === '\\') { fora += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        if (src[i] === '[') classe = true;
        else if (src[i] === ']') classe = false;
        else if (src[i] === '/' && !classe) { fora += src[i]; i++; break; }
        fora += src[i]; i++;
      }
      while (i < src.length && /[dgimsuvy]/.test(src[i])) { fora += src[i]; i++; }
      ultimo = '/';
      continue;
    }

    fora += c;
    if (!/\s/.test(c)) ultimo = c;
    i++;
  }

  // enxuga: tira recuo e linhas vazias, mas mantém as quebras (ASI)
  return fora
    .split('\n')
    .map(l => l.replace(/[ \t]+$/, ''))
    .filter(l => l.trim() !== '')
    .map(l => l.replace(/^[ \t]+/, ''))
    .join('\n');
}

function tirarComentariosCSS(src) {
  let fora = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const aspa = c;
      fora += c; i++;
      while (i < src.length) {
        if (src[i] === '\\') { fora += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        fora += src[i];
        if (src[i] === aspa) { i++; break; }
        i++;
      }
      continue;
    }
    fora += c; i++;
  }
  return fora
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');
}

/* ------------------------------------------------------------------
   Monta o arquivo único: inline do que for local, comentários fora
   ------------------------------------------------------------------ */

async function montar(pasta) {
  const dir = join(RAIZ, pasta);
  let html = await readFile(join(dir, 'index.html'), 'utf8');

  // <link rel="stylesheet" href="algo.css"> → <style>…</style>
  for (const m of [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)]) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || /^(https?:)?\/\//i.test(href)) continue;
    const alvo = join(dir, href);
    if (!existsSync(alvo)) continue;
    html = html.replace(m[0], `<style>\n${await readFile(alvo, 'utf8')}\n</style>`);
  }

  // <script src="algo.js"></script> → <script>…</script>
  for (const m of [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi)]) {
    const src = m[1];
    if (/^(https?:)?\/\//i.test(src)) continue;
    const alvo = join(dir, src);
    if (!existsSync(alvo)) continue;
    const tipo = /type=["']module["']/i.test(m[0]) ? ' type="module"' : '';
    html = html.replace(m[0], `<script${tipo}>\n${await readFile(alvo, 'utf8')}\n</script>`);
  }

  // processa <style> e <script> separadamente do resto do HTML
  const guardados = [];
  html = html.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (_t, tag, attrs, miolo) => {
    const limpo = tag.toLowerCase() === 'style' ? tirarComentariosCSS(miolo) : tirarComentariosJS(miolo);
    guardados.push(`<${tag}${attrs}>\n${limpo}\n</${tag}>`);
    return `\u0000BLOCO${guardados.length - 1}\u0000`;
  });

  html = html
    .replace(/<!--[\s\S]*?-->/g, '')   // comentários de HTML
    .replace(/\n\s*\n+/g, '\n')        // linhas vazias
    .replace(/>\s+</g, '><');          // espaço entre tags

  html = html.replace(/\u0000BLOCO(\d+)\u0000/g, (_t, n) => guardados[+n]);

  return html;
}

/* ------------------------------------------------------------------
   Marca d'água + trava, injetadas no fim do <body>
   ------------------------------------------------------------------ */

const SELO = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='190'%3E%3Ctext x='150' y='100' fill='%23ffffff' fill-opacity='0.055' font-family='system-ui,sans-serif' font-size='21' font-weight='700' letter-spacing='5' text-anchor='middle' transform='rotate(-28 150 100)'%3EFULGOR %C2%B7 DEMO%3C/text%3E%3C/svg%3E`;

const EXTRA = `
<div data-fg-marca aria-hidden="true"></div>
<style>
[data-fg-marca]{position:fixed;inset:0;z-index:2147483647;pointer-events:none;background-image:url("${SELO}");background-repeat:repeat}
html,body{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}
</style>
<script>
(function(){
  if (window.self === window.top) { location.replace('../index.html'); return; }
  var bloquear = function(e){ e.preventDefault(); return false; };
  document.addEventListener('contextmenu', bloquear);
  document.addEventListener('dragstart', bloquear);
  document.addEventListener('selectstart', function(e){
    var a = e.target;
    if (a && a.closest && a.closest('input,textarea,[contenteditable]')) return;
    e.preventDefault();
  });
  document.addEventListener('keydown', function(e){
    var k = (e.key || '').toLowerCase();
    if (k === 'f12') return bloquear(e);
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && ['u','s','p'].indexOf(k) > -1) return bloquear(e);
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i','j','c'].indexOf(k) > -1) return bloquear(e);
  });
})();
</script>`;

/* ------------------------------------------------------------------
   Embaralha e grava
   ------------------------------------------------------------------ */

function embaralhar(texto) {
  const bytes = Buffer.from(texto, 'utf8');
  const chave = Buffer.from(CHAVE, 'utf8');
  const saida = Buffer.allocUnsafe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    saida[i] = bytes[i] ^ chave[i % chave.length] ^ (i & 0xff);
  }
  return saida.toString('base64');
}

/* ------------------------------------------------------------------ */

const pastas = (await readdir(RAIZ, { withFileTypes: true }))
  .filter(d => d.isDirectory() && /^\d{2}-/.test(d.name))
  .map(d => d.name)
  .sort();

if (!pastas.length) {
  console.error('Nenhuma pasta de efeito encontrada na raiz.');
  process.exit(1);
}

// limpa só os pacotes antigos — o visor.html mora aqui e fica
await mkdir(SAIDA, { recursive: true });
for (const f of await readdir(SAIDA)) {
  if (f.endsWith('.dat')) await rm(join(SAIDA, f), { force: true });
}

for (const pasta of pastas) {
  const n = pasta.slice(0, 2);
  const html = await montar(pasta);
  const comExtra = html.replace(/<\/body>/i, EXTRA + '\n</body>');
  await writeFile(join(SAIDA, n + '.dat'), embaralhar(comExtra), 'utf8');
  const kb = (Buffer.byteLength(comExtra, 'utf8') / 1024).toFixed(1);
  console.log(`${n}  ${pasta.padEnd(32)} ${kb} KB`);
}

console.log(`\n${pastas.length} prévias geradas em /previas`);
