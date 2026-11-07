# Efeitos de Interface

Catorze efeitos de interface, cada um numa pasta, cada um num arquivo só.

**Para ver:** abra `index.html` (a loja, com a prévia ao vivo de cada efeito dentro do cartão)
com dois cliques, ou entre em qualquer pasta e abra o `index.html` dela. A galeria em formato
de catálogo continua em `catalogo.html`.

**Para usar:** copie a pasta do efeito para o seu projeto e abra o arquivo. Não tem instalação,
não tem `npm install`, não tem build, não tem nada baixado da internet quando roda. É HTML, CSS
e JavaScript puros — funciona abrindo o arquivo direto, dentro de um site, de um Electron ou de
uma extensão de navegador.

## O que tem dentro de cada arquivo

O comentário no topo de cada `index.html` diz quatro coisas:

1. de onde veio o efeito;
2. **o que define o efeito** — a lista numerada do que precisa acontecer para ser aquele efeito
   e não outro parecido;
3. como foi feito, com o nome da técnica;
4. o que costuma sair errado quando se tenta reproduzir de olho.

Os comentários dentro do código explicam as partes que não se adivinha lendo — por que a conta é
aquela, por que a ordem importa, por que não dá para fazer do jeito óbvio.

## Os catorze

| # | efeito | referência | a técnica que importa |
|---|---|---|---|
| 01 | [Arara de roupas](01-arara-de-roupas/index.html) | Clothes Closet Website in 2026 | `rotateY` de 70° → 0 no hover, SVG das peças gerado em JS, troca de cor por cortina (`clip-path: inset`) |
| 02 | [Menisco](02-menisco/index.html) | Meniscus Navigation | caminho SVG recalculado a cada quadro; os filetes do encontro usam a tangente de dois círculos |
| 03 | [Casa inteligente](03-casa-inteligente/index.html) | Smart Home Dashboard | abrir/fechar simétrico: o recorte desce enquanto os itens abaixo escorregam o mesmo tanto |
| 04 | [Rodapé líquido](04-rodape-liquido/index.html) | Glassy Liquid Footer | a máscara leva as duas coisas (onda amortecida + buraco das letras), porque `clip-path` e `mask` não se combinam |
| 05 | [Painel panorâmico](05-painel-panoramico/index.html) | Glassy Dashboard V5 | cenário em CSS puro atrás do vidro; cartões entram com atraso escalonado e rotação |
| 06 | [Cartões em ordem de leitura](06-cartoes-em-ordem-de-leitura/index.html) | Dashboard Animation | ordenação pelo `getBoundingClientRect` (mesma linha se a diferença de topo < 8px), não pela ordem do HTML |
| 07 | [OTP de vidro](07-otp-de-vidro/index.html) | Glassy OTP V4 | `pathLength=1` + `stroke-dashoffset` para desenhar as linhas; partículas em órbita no núcleo |
| 08 | [Lente líquida](08-lente-liquida/index.html) | iOS App Publishing | `feTurbulence` + `feDisplacementMap` sobre um clone da página, recortado por `clip-path: path()` |
| 09 | [Vidro espacial](09-vidro-espacial/index.html) | Glassy Dashboard V18 | o estilo inteiro, com tokens num `.css` e movimento e som num `.js` — ficha em `ESTILO.md` |
| 10 | [Login que vira octógono](10-login-octogono/index.html) | Glassy Login Form v3 | `clip-path: polygon()` sempre com 8 pontos, para o navegador interpolar de um formato ao outro |
| 11 | [Escritório 3D com IA](11-escritorio-3d-com-ia/index.html) | 3D Dashboard With AI | CSS 3D puro: caixas feitas de planos, pessoas como billboards que desfazem a rotação do mundo, câmera = transform |
| 12 | [Lateral de vidro](12-lateral-de-vidro/index.html) | Glassy SideBar V5 | largura com mola e `ResizeObserver` para o indicador seguir enquanto ela se mexe |
| 13 | [Kanban com fantasma](13-kanban-fantasma/index.html) | Admin Dashboard Orders | clone fixo seguindo o ponteiro + `elementFromPoint` para achar a coluna + FLIP no pouso |
| 14 | [Pílula que estica](14-pilula-que-estica/index.html) | Sales CRM | `clip-path: inset()` com cada borda num tempo próprio: a da frente chega antes, a de trás alcança depois |

## O que vale para todos

- **Um arquivo por efeito.** A única exceção é o 09, que é um estilo completo e por isso vem com
  o `.css` e o `.js` separados, do jeito que se usa num projeto de verdade.
- **Sem dependência.** Nenhum pacote, nenhuma fonte baixada, nenhum ícone de CDN. As fontes são
  pilhas do sistema e os ícones são SVG dentro do próprio arquivo.
- **`prefers-reduced-motion` respeitado.** Quem ligou "reduzir movimento" no sistema recebe o
  mesmo resultado, sem a animação.
- **Teclado e leitor de tela** onde o efeito é um controle de verdade: OTP, kanban, abas, login,
  lateral.
- **Nomes, marcas e dados são inventados.** Nada aqui usa marca de ninguém.

## Trocar a cara de um efeito

Em todos, as cores, os raios, os desfoques e os tempos estão em variáveis no `:root`, no começo
do `<style>`. Mexer ali muda a tela inteira sem tocar em componente nenhum. As curvas de
movimento (`cubic-bezier`) também estão ali, com nome.

No 09, que é o estilo completo, isso fica no `vidro-espacial.css` e está documentado em
`ESTILO.md`.
