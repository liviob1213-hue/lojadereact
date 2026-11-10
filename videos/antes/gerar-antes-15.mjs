// Gera a versão ANTES do efeito 15 a partir do arquivo original:
// mesmo HTML, mesmo CSS, mesmos dados e ids; só o comportamento muda.
// Rodar: node antes/gerar-antes-15.mjs   (de dentro de videos/)
import { readFile, writeFile } from 'node:fs/promises';

const ORIGEM = new URL('../../15-carrossel-em-profundidade/index.html', import.meta.url);
const DESTINO = new URL('./15-carrossel-em-profundidade.html', import.meta.url);
let h = await readFile(ORIGEM, 'utf8');

h = h.replace(/<!--[\s\S]*?-->/, `<!--
  ANTES do efeito 15 — o jeito comum de fazer o mesmo carrossel.
  Mesmo conteúdo, mesmo layout, mesmas cores e mesmos ids. A diferença é só o
  comportamento: uma fileira reta que rola, segue o arrasto 1:1 e para seco ao
  soltar. Sem profundidade, sem inércia, sem mola. Só para o vídeo.
-->`);
h = h.replace('<title>Carrossel em profundidade</title>', '<title>Antes · Carrossel</title>');
h = h.replace('</style>', `  /* ---- antes: fileira reta ---- */
  .palco { perspective: none; overflow: hidden; display: flex; align-items: center; gap: 24px; padding: 0 calc(50% - var(--cartao-l) / 2); cursor: default; }
  .palco .cartao { position: relative; left: auto; top: auto; margin: 0; flex: none; }
</style>`);

const ini = h.indexOf("  const palco = document.getElementById('palco');");
const fim = h.indexOf('})();\n</script>');
if (ini < 0 || fim < 0) throw new Error('estrutura do 15 mudou; ajuste o gerador');

const novo = `  const palco = document.getElementById('palco');
  const texto = document.getElementById('texto');
  const pontos = document.getElementById('pontos');
  const total = DESTINOS.length;
  const cartoes = DESTINOS.map(([nome, regiao, noites, , c]) => {
    const el = document.createElement('article');
    el.className = 'cartao';
    el.style.cssText = \`--c1:\${c[0]};--c2:\${c[1]};--sol:\${c[2]};--m1:\${c[3]};--m2:\${c[4]};--sx:\${c[5]};--sy:\${c[6]}\`;
    el.innerHTML = \`<div class="arte"><div class="monte"></div><div class="monte b"></div></div>
      <div class="brilho"></div>
      <div class="rotulo"><small>\${regiao}</small><b>\${nome}</b><span>\${noites}</span></div>\`;
    palco.appendChild(el);
    return el;
  });
  pontos.innerHTML = DESTINOS.map(() => '<i></i>').join('');
  const bolinhas = [...pontos.children];
  const passo = () => cartoes[1].offsetLeft - cartoes[0].offsetLeft;
  function atualizar() {
    const i = Math.max(0, Math.min(total - 1, Math.round(palco.scrollLeft / passo())));
    bolinhas.forEach((b, j) => b.classList.toggle('ativo', j === i));
    texto.textContent = DESTINOS[i][3];
  }
  palco.addEventListener('scroll', atualizar);
  // arrastar move a fileira junto com o mouse e para onde soltar
  let x0 = 0, s0 = 0, segurando = false;
  palco.addEventListener('pointerdown', (e) => { segurando = true; x0 = e.clientX; s0 = palco.scrollLeft; });
  addEventListener('pointermove', (e) => { if (segurando) palco.scrollLeft = s0 - (e.clientX - x0); });
  addEventListener('pointerup', () => { segurando = false; });
  document.getElementById('antes').addEventListener('click', () => { palco.scrollLeft -= passo(); });
  document.getElementById('depois').addEventListener('click', () => { palco.scrollLeft += passo(); });
  palco.scrollLeft = passo() * 3;
  atualizar();
`;
h = h.slice(0, ini) + novo + h.slice(fim);
await writeFile(DESTINO, h);
console.log('ok', DESTINO.pathname);
