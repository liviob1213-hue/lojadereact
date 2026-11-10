/* ============================================================
   FULGOR — renderizador de Reels
   ------------------------------------------------------------
   Lê videos/config.json e renderiza cada vídeo QUADRO A QUADRO a partir
   dos efeitos reais, com o tempo da página controlado:

     - page.clock (Playwright) congela Date, performance.now, setTimeout e
       requestAnimationFrame; cada quadro avança exatamente 1/30 s;
     - animações e transições CSS (document.getAnimations) ficam pausadas
       e recebem currentTime do mesmo relógio a cada quadro;
     - canvas e WebGL leem performance.now / o tempo do rAF, então seguem
       o mesmo relógio sem nada extra;
     - Math.random tem semente fixa: renderizar duas vezes dá o mesmo vídeo.

   O cursor é um roteiro (curvas bezier com aceleração suave) que dispara
   eventos reais de mouse na página, então o efeito reage de verdade.
   Cada quadro dos efeitos vira imagem, o compositor.html monta o quadro
   final (textos, selos, cursor, câmera) e o ffmpeg codifica.

   Uso (de dentro de videos/):
     npm run video -- 03-CARROSSEL      um vídeo
     npm run video -- 01-loop 03-CARROSSEL
     npm run videos                     todos
   ============================================================ */

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const SAIDA = path.join(AQUI, 'out');
const TMP = path.join(AQUI, '.tmp');
const config = JSON.parse(await readFile(path.join(AQUI, 'config.json'), 'utf8'));
const FPS = config.fps;

/* ------------------------------------------------------------------
   Script injetado em toda página de efeito, antes de qualquer outro
   ------------------------------------------------------------------ */
const INIT = `(() => {
  // acaso com semente: o mesmo vídeo toda vez
  let s = 1234567;
  Math.random = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // animações CSS/WAAPI andam pelo relógio controlado, não pelo relógio real
  const nascimento = new WeakMap();
  window.__sincronizar = () => {
    const agora = performance.now();
    for (const a of document.getAnimations()) {
      if (!nascimento.has(a)) { nascimento.set(a, agora); a.pause(); }
      a.currentTime = agora - nascimento.get(a);
    }
  };
  addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '*{cursor:none!important} ::-webkit-scrollbar{display:none}';
    document.head.appendChild(st);
  });
})();`;

/* ------------------------------------------------------------------
   Roteiro do cursor
   ------------------------------------------------------------------ */
const CURVAS = {
  suave: (u) => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  acelera: (u) => Math.pow(u, 2.3),                 // chega rápido no fim: bom para "soltar com força"
  freia: (u) => 1 - Math.pow(1 - u, 2.3),
};

function compilar(passos, resolver) {
  let atual = passos[0].pos;
  const trechos = [], eventos = [];
  let lado = 1;
  for (const p of passos) {
    if (p.pos) atual = p.pos;
    if (p.ir) {
      const ate = typeof p.ir === 'string' ? resolver(p.ir) : p.ir;
      trechos.push({ t: p.t, dur: p.dur, de: atual, ate, curva: CURVAS[p.curva || 'suave'], arco: (p.arco ?? .16) * lado });
      lado = -lado;                                   // alterna o lado da curva: nunca reta, nunca repetitiva
      atual = ate;
    }
    if (p.apertar) eventos.push({ t: p.t, tipo: 'down' });
    if (p.soltar) eventos.push({ t: p.t, tipo: 'up' });
    if (p.clicar) eventos.push({ t: p.t, tipo: 'down' }, { t: p.t + .08, tipo: 'up' });
    // digitar: uma tecla por vez, no ritmo de quem digita (intervalo em segundos)
    if (p.digitar) [...p.digitar].forEach((ch, i) => eventos.push({ t: p.t + i * (p.intervalo || .09), tipo: 'tecla', ch }));
  }
  eventos.sort((a, b) => a.t - b.t);
  const inicio = passos[0].pos;

  function pos(t) {
    let p = inicio;
    for (const s of trechos) {
      if (t < s.t) break;
      if (t < s.t + s.dur) return bezier(s, s.curva((t - s.t) / s.dur));
      p = s.ate;
    }
    return p;
  }
  function apertado(t) {
    let a = false;
    for (const e of eventos) { if (e.t > t) break; if (e.tipo !== 'tecla') a = e.tipo === 'down'; }
    return a;
  }
  return { pos, eventos, apertado };
}

// bezier cúbica com as alças deslocadas para o lado: o caminho sempre curva
function bezier(s, u) {
  const [x0, y0] = s.de, [x3, y3] = s.ate;
  const dx = x3 - x0, dy = y3 - y0, d = Math.hypot(dx, dy) || 1;
  const nx = -dy / d, ny = dx / d, o = s.arco * d;
  const x1 = x0 + dx / 3 + nx * o, y1 = y0 + dy / 3 + ny * o;
  const x2 = x0 + 2 * dx / 3 + nx * o, y2 = y0 + 2 * dy / 3 + ny * o;
  const m = 1 - u;
  return [
    m * m * m * x0 + 3 * m * m * u * x1 + 3 * m * u * u * x2 + u * u * u * x3,
    m * m * m * y0 + 3 * m * m * u * y1 + 3 * m * u * u * y2 + u * u * u * y3,
  ];
}

// órbita em oito (Lissajous): fecha exatamente no fim do loop
function orbita(o, T) {
  const w = (Math.PI * 2) / T;
  return (t) => [o.centro[0] + o.raio[0] * Math.sin(w * t), o.centro[1] + o.raio[1] * .5 * Math.sin(2 * w * t)];
}

/* ------------------------------------------------------------------
   Páginas
   ------------------------------------------------------------------ */
async function prepararArquivo(v, arquivoRel, sufixo, varianteSo = v.variante) {
  const origem = path.join(arquivoRel.startsWith('antes/') ? AQUI : RAIZ, arquivoRel);
  // "ambos": ajuste de layout aplicado às DUAS páginas do antes/depois (comparação justa)
  const a = v.tipo === 'antes-depois' ? v.ambos : null;
  const variante = (a || varianteSo) ? {
    substituir: [...(a?.substituir || []), ...(varianteSo?.substituir || [])],
    css: [a?.css, varianteSo?.css].filter(Boolean).join(' '),
  } : null;
  if (!variante) return origem;
  // variante só para o vídeo: o arquivo original não é tocado
  let html = await readFile(origem, 'utf8');
  for (const [de, para] of variante.substituir || []) {
    if (!html.includes(de)) throw new Error(`[${v.id}] variante: não achei "${de}"`);
    html = html.split(de).join(para);
  }
  if (variante.css) html = html.replace('</head>', `<style>${variante.css}</style>\n</head>`);
  await mkdir(TMP, { recursive: true });
  const destino = path.join(TMP, `${v.id}-${sufixo}.html`);
  await writeFile(destino, html);
  return destino;
}

const T0 = Date.parse('2026-01-01T12:00:00Z');

async function abrirEfeito(browser, arquivo, v) {
  const ctx = await browser.newContext({ viewport: { width: v.viewport[0], height: v.viewport[1] }, deviceScaleFactor: v.escala || 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  erro na página ${path.basename(arquivo)}: ${e.message}`));
  await page.addInitScript(INIT);
  await page.clock.install({ time: T0 });
  await page.goto(pathToFileURL(arquivo).href);
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(T0 + 8000);               // daqui em diante o tempo só anda quando mandamos
  await page.evaluate(() => window.__sincronizar());
  page.__ms = 0;
  page.__cdp = await ctx.newCDPSession(page);
  return page;
}

// avança o relógio da página até o tempo t (segundos), em passos inteiros de ms
async function avancarAte(page, t) {
  const alvo = Math.round(t * 1000);
  if (alvo > page.__ms) { await page.clock.runFor(alvo - page.__ms); page.__ms = alvo; }
  await page.evaluate(() => window.__sincronizar());
}

async function abrirCompositor(browser, v) {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`  erro no compositor: ${e.message}`));
  await page.goto(pathToFileURL(path.join(AQUI, 'compositor.html')).href);
  const fontes = await page.evaluate((c) => window.montar(c), v);
  if (!fontes.some((f) => f.startsWith('Inter Tight'))) throw new Error('Inter Tight não carregou no compositor');
  return page;
}

function abrirFfmpeg(saida) {
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    // os quadros chegam em JPEG (faixa de cor cheia); converte para a faixa de vídeo padrão
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-movflags', '+faststart', '-an', saida,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  return {
    async quadro(buf) { if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain'); },
    async fechar() { ff.stdin.end(); const [codigo] = await once(ff, 'close'); if (codigo) throw new Error('ffmpeg falhou: ' + codigo); },
  };
}

// screenshot direto pelo protocolo do Chrome: o page.screenshot do Playwright
// espera dois requestAnimationFrame, e aqui o rAF está congelado de propósito
async function capturar(page, clip) {
  const r = await page.__cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, fromSurface: true, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  return Buffer.from(r.data, 'base64');
}

const dataUrl = (buf) => 'data:image/jpeg;base64,' + buf.toString('base64');

async function gravarQuadro(comp, ff, v, f) {
  const buf = await comp.screenshot({ type: 'jpeg', quality: 95 });
  await ff.quadro(buf);
  if (f === Math.round(v.capa * FPS)) await comp.screenshot({ type: 'png', path: path.join(SAIDA, `${v.id}-capa.png`) });
}

/* ------------------------------------------------------------------
   ANTES / DEPOIS
   ------------------------------------------------------------------ */
async function renderAntesDepois(browser, v) {
  const arqAntes = typeof v.antes === 'string'
    ? await prepararArquivo(v, v.antes, 'antes', null)
    : await prepararArquivo(v, `${v.efeito}/index.html`, 'antes', v.antes);
  const antes = await abrirEfeito(browser, arqAntes, v);
  const depois = await abrirEfeito(browser, await prepararArquivo(v, `${v.efeito}/index.html`, 'depois', null), v);

  // seletores do roteiro são resolvidos na página DEPOIS (as duas têm o mesmo layout)
  const alvos = {};
  for (const p of v.roteiro) if (typeof p.ir === 'string' && !alvos[p.ir]) {
    alvos[p.ir] = await depois.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, p.ir);
  }
  const rot = compilar(v.roteiro, (s) => alvos[s]);

  // aquecimento: as duas páginas saem da animação de entrada antes do quadro 0
  for (const pg of [antes, depois]) {
    await pg.mouse.move(...rot.pos(0));
    await avancarAte(pg, v.aquecer);
  }
  const base = v.aquecer;

  const [rx, ry, rw, rh] = v.recorte;
  const clip = { x: rx, y: ry, width: rw, height: rh };
  const k = 1080 / rw;
  const comp = await abrirCompositor(browser, v);
  const ff = abrirFfmpeg(path.join(SAIDA, `${v.id}.mp4`));
  const total = Math.min(Math.round(v.duracao * FPS), Number(process.env.QUADROS) || Infinity);   // QUADROS=n: teste rápido
  let tAnt = -1;

  for (let f = 0; f < total; f++) {
    const t = f / FPS;
    const imgs = [];
    for (const pg of [antes, depois]) {
      // mesmos eventos, nos mesmos tempos e posições, nas duas páginas
      for (const e of rot.eventos) if (e.t > tAnt && e.t <= t) {
        if (e.tipo === 'tecla') { await pg.keyboard.type(e.ch); continue; }
        await pg.mouse.move(...rot.pos(e.t));
        await (e.tipo === 'down' ? pg.mouse.down() : pg.mouse.up());
      }
      await pg.mouse.move(...rot.pos(t));
      await avancarAte(pg, base + t + 1 / FPS);
      imgs.push(await capturar(pg, clip));
    }
    tAnt = t;
    const [x, y] = rot.pos(t);
    await comp.evaluate((e) => window.quadro(e), {
      t, antes: dataUrl(imgs[0]), depois: dataUrl(imgs[1]),
      cursor: { x: (x - rx) * k, y: (y - ry) * k, apertado: rot.apertado(t), visivel: true },
    });
    await gravarQuadro(comp, ff, v, f);
    if (f % FPS === 0) process.stdout.write(`  ${v.id} ${(t).toFixed(0)}s/${v.duracao}s\r`);
  }
  await ff.fechar();
}

/* ------------------------------------------------------------------
   LOOP
   ------------------------------------------------------------------ */
async function renderLoop(browser, v) {
  const pg = await abrirEfeito(browser, await prepararArquivo(v, `${v.efeito}/index.html`, 'loop'), v);
  const T = v.duracao;
  const pos = orbita(v.roteiro.orbita, T);
  const cliques = v.roteiro.cliques || [];
  const comp = await abrirCompositor(browser, v);
  const ff = abrirFfmpeg(path.join(SAIDA, `${v.id}.mp4`));

  // o loop só fecha se o estado do quadro 0 for o mesmo do quadro T: por isso
  // um ciclo inteiro roda antes (aquecer = T) com o mesmo cursor e os mesmos cliques
  const passo = 1 / FPS;
  const aquecer = Math.round((v.aquecer ?? T) * FPS);
  const total = Math.min(Math.round(T * FPS), Number(process.env.QUADROS) || Infinity);
  for (let f = -aquecer; f < total; f++) {
    const t = f * passo;                                   // t negativo = aquecimento
    const fase = ((t % T) + T) % T, faseAnt = (((t - passo) % T) + T) % T;
    for (const c of cliques) {
      const cruzou = faseAnt < fase ? (c > faseAnt && c <= fase) : (c > faseAnt || c <= fase);
      if (cruzou) { await pg.mouse.move(...pos(t)); await pg.mouse.down(); await pg.mouse.up(); }
    }
    await pg.mouse.move(...pos(t));
    await avancarAte(pg, (f + aquecer + 1) * passo);
    if (f < 0) continue;
    const img = await capturar(pg);
    const [x, y] = pos(t);
    const perto = cliques.some((c) => Math.abs(fase - c) < .12);
    await comp.evaluate((e) => window.quadro(e), {
      t, frame: f, quadro: dataUrl(img),
      cursor: { x: x * (v.escala || 1), y: y * (v.escala || 1), apertado: perto },
    });
    await gravarQuadro(comp, ff, v, f);
    if (f % FPS === 0) process.stdout.write(`  ${v.id} ${(t).toFixed(0)}s/${T}s\r`);
  }
  await ff.fechar();
}

/* ------------------------------------------------------------------
   MANIFESTO: um efeito, vários planos com corte seco
   A página roda contínua; cada plano muda o enquadramento da câmera e o
   rótulo no compositor. O cursor segue um roteiro único, com cliques.
   ------------------------------------------------------------------ */
async function renderManifesto(browser, v) {
  const pg = await abrirEfeito(browser, await prepararArquivo(v, `${v.efeito}/index.html`, 'manifesto'), v);
  const rot = compilar(v.roteiro, () => { throw new Error('manifesto não usa seletores'); });
  await pg.mouse.move(...rot.pos(0));
  await avancarAte(pg, v.aquecer || 0);
  const base = v.aquecer || 0;
  const comp = await abrirCompositor(browser, v);
  const ff = abrirFfmpeg(path.join(SAIDA, `${v.id}.mp4`));
  const total = Math.min(Math.round(v.duracao * FPS), Number(process.env.QUADROS) || Infinity);
  const k = v.escala || 1;
  let tAnt = -1;
  for (let f = 0; f < total; f++) {
    const t = f / FPS;
    for (const e of rot.eventos) if (e.t > tAnt && e.t <= t) {
      await pg.mouse.move(...rot.pos(e.t));
      await (e.tipo === 'down' ? pg.mouse.down() : pg.mouse.up());
    }
    await pg.mouse.move(...rot.pos(t));
    await avancarAte(pg, base + t + 1 / FPS);
    tAnt = t;
    const img = await capturar(pg);
    const [x, y] = rot.pos(t);
    await comp.evaluate((e) => window.quadro(e), { t, frame: f, quadro: dataUrl(img), cursor: { x: x * k, y: y * k, apertado: rot.apertado(t) } });
    await gravarQuadro(comp, ff, v, f);
    if (f % FPS === 0) process.stdout.write(`  ${v.id} ${t.toFixed(0)}s/${v.duracao}s`);
  }
  await ff.fechar();
}

/* ------------------------------------------------------------------ */
const pedidos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const lista = process.argv.includes('--todos') ? config.videos : config.videos.filter((v) => pedidos.includes(v.id));
if (!lista.length) {
  console.log('Diga qual vídeo: npm run video -- <id>   (ou npm run videos)\nIds: ' + config.videos.map((v) => v.id).join(', '));
  process.exit(1);
}

await mkdir(SAIDA, { recursive: true });
const browser = await chromium.launch({
  // sem flags de SwiftShader: elas deixam cada captura 15x mais lenta, e o WebGL já funciona sem elas
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
});
try {
  for (const v of lista) {
    const inicio = Date.now();
    console.log(`> ${v.id} (${v.tipo}, ${v.duracao}s)`);
    if (v.tipo === 'loop') await renderLoop(browser, v);
    else if (v.tipo === 'manifesto') await renderManifesto(browser, v);
    else await renderAntesDepois(browser, v);
    console.log(`  ${v.id}.mp4 pronto em ${((Date.now() - inicio) / 1000).toFixed(0)}s          `);
  }
} finally {
  await browser.close();
}
