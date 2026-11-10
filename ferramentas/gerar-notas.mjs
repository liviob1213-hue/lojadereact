/* ============================================================
   FULGOR — gera o documento de bloco de notas (.txt) de cada efeito
   ------------------------------------------------------------
   Para cada pasta de efeito listada abaixo, escreve dentro dela um
   NN-nome.txt que abre no Bloco de Notas com:
     - o que é o efeito e onde ele se aplica;
     - como usar e o que trocar para mudar a cara dele;
     - a ficha técnica (o comentário do topo do index.html);
     - o código completo, pronto para copiar.

   O .txt é gerado a partir do index.html, então nunca fica
   desatualizado: mexeu no efeito, rode de novo.

   Rodar:  node ferramentas/gerar-notas.mjs
   ============================================================ */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRECO = 'R$ 7,90';

const EFEITOS = {
  '15-carrossel-em-profundidade': {
    nome: 'Carrossel em profundidade',
    resumo: 'Cartões em fila 3D: o do centro fica de frente e os outros recuam, giram para dentro e perdem foco. Arrasta com inércia e pousa com mola.',
    exemplo: 'Página de exemplo: "Rotas", um app de viagens escolhendo o próximo destino.',
    usos: 'vitrine de produtos, portfólio, escolha de plano, galeria de capas, onboarding.',
    interacao: 'arrastar com o mouse ou o dedo, roda do mouse, setas do teclado, clicar num cartão vizinho, setas e pontos embaixo.',
  },
  '16-imagem-que-ondula': {
    nome: 'Imagem que ondula',
    resumo: 'A imagem inteira vira água: o rastro do mouse solta ondas pequenas e o clique solta uma onda grande, com anéis que crescem e somem. O título faz parte da imagem e ondula junto.',
    exemplo: 'Página de exemplo: "Maré", hero de um hotel à beira-mar.',
    usos: 'hero de site, capa de campanha, página de evento, landing page de marca.',
    interacao: 'mover o mouse sobre a imagem, clicar para jogar uma "pedra". Sozinha, a página solta uma gota de tempos em tempos.',
  },
  '17-sanfona-de-paineis': {
    nome: 'Sanfona de painéis',
    resumo: 'Painéis lado a lado: o ativo se abre e os outros viram faixas com o título na vertical. O conteúdo é revelado como cortina, sem espremer. Passa sozinho com barra de tempo.',
    exemplo: 'Página de exemplo: "acervo.", coleções da semana de uma plataforma cultural.',
    usos: 'destaques da home, categorias, cases de portfólio, planos, depoimentos.',
    interacao: 'passar o mouse ou clicar numa faixa, setas do teclado, botões ‹ ›. O autoplay pausa com o mouse em cima.',
  },
  '18-persiana-viva': {
    nome: 'Persiana viva',
    resumo: 'Fundo feito de milhares de ripas finas que giram como uma fachada cinética. Uma onda lenta atravessa a grade o tempo todo, o mouse vira as ripas em volta dele e o clique solta um anel.',
    exemplo: 'Página de exemplo: "LÂMINA", estúdio de arquitetura cinética.',
    usos: 'fundo de hero, tela de login, página de lançamento, seção de destaque.',
    interacao: 'mover o mouse sobre o fundo e clicar para soltar uma onda.',
  },
  '19-fragmentadora': {
    nome: 'Fragmentadora',
    resumo: 'Apagar um arquivo passa o documento por uma fragmentadora: acima da boca ele continua inteiro, abaixo já saiu em tiras que balançam e caem.',
    exemplo: 'Página de exemplo: "Cofre", gerenciador de arquivos com uma lista para descartar.',
    usos: 'excluir arquivo, apagar conta, limpar lixeira, descartar rascunho, cancelar pedido.',
    interacao: 'botão "Fragmentar" (ou tecla Delete). Clique num arquivo da lista para trocar o documento.',
  },
  '20-cartao-que-vira': {
    nome: 'Cartão que vira',
    resumo: 'Cartão com frente e verso que gira em 3D com peso: passa um pouco do ponto e volta, levanta da mesa no meio do giro e o brilho corre pela superfície.',
    exemplo: 'Página de exemplo: "pague.bem", checkout em que o cartão vira sozinho ao entrar no campo do código de segurança.',
    usos: 'checkout, cartão de visita, planos com detalhes no verso, quiz, cartas de jogo.',
    interacao: 'clicar no cartão, botão "virar", ou entrar no campo do código de segurança. O mouse inclina o cartão.',
  },
};

const quebra = (s) => s.replace(/\r?\n/g, '\r\n');      // Bloco de Notas antigo só entende CRLF
const linha = '='.repeat(72);
const fina = '-'.repeat(72);

for (const [pasta, e] of Object.entries(EFEITOS)) {
  const html = await readFile(join(RAIZ, pasta, 'index.html'), 'utf8');
  const n = pasta.slice(0, 2);

  // a ficha técnica é o primeiro comentário do arquivo
  const ficha = (html.match(/<!--([\s\S]*?)-->/) || [, ''])[1]
    .split('\n').map((l) => l.replace(/^ {2}/, '')).join('\n').trim();

  // as variáveis do :root são o painel de controle do efeito
  const raiz = (html.match(/:root\s*\{([\s\S]*?)\n\s*\}/) || [, ''])[1]
    .split('\n').map((l) => l.trim()).filter(Boolean).map((l) => '    ' + l).join('\n');

  const texto = `${linha}
  FULGOR · EFEITO ${n} — ${e.nome.toUpperCase()}
  Efeito de interface em HTML, CSS e JavaScript puros · ${PRECO}
${linha}

O QUE É
${e.resumo}

ONDE SE APLICA
${e.exemplo}
Serve também para: ${e.usos}

COMO MEXER NA PÁGINA DE EXEMPLO
${e.interacao}

${fina}
COMO USAR
${fina}
1. Copie a pasta "${pasta}" para o seu projeto
   (ou copie o código completo do fim deste documento para um arquivo .html).
2. Abra o index.html com dois cliques. Não precisa instalar nada,
   não precisa de internet, não tem npm nem build.
3. Para levar só o efeito para a sua página, copie:
   - o bloco <style> (as regras marcadas como parte do efeito),
   - o HTML do componente,
   - o <script> do fim do arquivo.
4. Funciona em qualquer site, em React, Vue, Svelte, Next ou dentro
   de um iframe: não depende de nenhum framework.

Quem ligou "reduzir movimento" no sistema recebe a mesma tela, sem a
animação (prefers-reduced-motion respeitado).

${fina}
TROCAR A CARA DO EFEITO
${fina}
As cores, tamanhos e tempos ficam nas variáveis do :root, no começo do
<style>. Mexer nelas muda o efeito inteiro sem tocar no resto:

${raiz}

${fina}
FICHA TÉCNICA (o que define o efeito e como ele foi feito)
${fina}
${ficha}

${linha}
  CÓDIGO COMPLETO — salve como index.html
${linha}

${html.trim()}

${linha}
  © 2026 FULGOR · Efeitos de interface. Uso liberado nos seus projetos e
  nos projetos dos seus clientes. Não é permitido revender este arquivo.
${linha}
`;

  const destino = join(RAIZ, pasta, `${pasta}.txt`);
  // a marca BOM no início garante que o Bloco de Notas leia os acentos certos
  await writeFile(destino, '﻿' + quebra(texto), 'utf8');
  console.log(`${n}  ${pasta}.txt`);
}
