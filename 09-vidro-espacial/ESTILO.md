# Vidro espacial

**Origem:** série "Glassy" do perfil [code.xr](https://www.instagram.com/code.xr/) no Instagram —
Glassy Dashboard V18 (a referência principal), Glassy Sidebar V5, Glassy Navigation Tabs V5,
Admin Dashboard V2 e Glassy Payment Checkout V2. Extraído em novembro de 2026, quadro a quadro.

**Em uma frase:** a interface flutua em placas de vidro fosco sobre um ambiente quente e
desfocado, com títulos em serifada e um único bloco de cor por tela; tudo entra em cena saindo
do desfoque.

## O que faz este estilo ser este estilo

1. **Placas separadas, nunca coladas na borda.** Lateral, conteúdo e coluna de widgets são
   três pedaços de vidro com um vão de ~16 px entre eles. É o vão que dá a sensação de
   "flutuar".
2. **Ambiente atrás.** O vidro só parece vidro se houver algo para desfocar. No original é
   uma foto de sala (madeira, abajur, TV). Sem foto, três manchas de luz quente resolvem.
3. **Fio de luz na borda de cima** de toda placa, tile, pílula e botão. É o reflexo — não o
   desfoque — que faz o olho ler "vidro".
4. **Serifada nos títulos e nos números grandes**, sans limpa no resto. Sem a serifada, o mesmo
   layout volta a parecer template de SaaS.
5. **Um herói de cor por tela.** No original, o tile "Contacts" em vidro azul saturado. O resto
   é vidro neutro. Dois blocos coloridos = nenhum destaque.
6. **Botão redondo branco** para a ação principal de um tile ("+", "→").
7. **Pílulas** para tudo que é estado ou variação ("↗ 12%", "4 ativas", "Este mês").

## Tokens

| token | valor | por quê |
|---|---|---|
| placa | `rgba(52,45,40,.38)` + `blur(36px) saturate(165%)` | vidro quente, puxa a cor do ambiente |
| tile | `rgba(255,255,255,.055)` | um degrau mais claro que a placa |
| item ativo | `rgba(255,255,255,.13)` | a pílula da lateral |
| reflexo | `inset 0 1px 0 rgba(255,255,255,.2)` | o fio de luz |
| raio | placa 30 · tile 20 · item 14 · pílula 999 | cantos grandes = objeto, não página |
| texto | `#f5f0ea` / 72% / 46% | creme, nunca branco puro no texto corrido |
| acento | `#4c8df6` (azul do original) | troque pela cor da marca |
| brilho | `#7ff0d4` | luz de indicador (abas "lâmpada") |
| serifada | `ui-serif, "Sitka Display", "Iowan Old Style", Charter, Georgia` | sem download |

## Movimento

| momento | o que acontece | tempo |
|---|---|---|
| entrada | placas aparecem vazias, o conteúdo **sai do desfoque** (`blur 14px → 0`, `scale .985 → 1`), em sequência da esquerda-cima para a direita-baixo | 640 ms cada, 70 ms entre um e outro |
| números | **contam** de zero até o valor, desacelerando no fim | 1,1 s |
| barras | **crescem** de baixo para cima com mola, uma depois da outra | 640 ms, 40 ms entre barras |
| linhas | **se desenham** da esquerda para a direita | 1,2 s |
| troca de tela | o conteúdo velho **vira vidro fosco** (200 ms), o novo entra em foco | 200 + 640 ms |
| item ativo | a pílula **escorrega** até o item novo, passando um pouquinho e voltando | 640 ms, `cubic-bezier(.34,1.45,.64,1)` |
| clique | `scale(.95)` no aperto, volta com mola | 60 ms / 140 ms |

Com `prefers-reduced-motion`, fica só o fade — sem desfoque, sem escala, sem mola.

## Som

Os vídeos não têm o som da interface (só música). O som deste modelo foi desenhado para
combinar com o vidro: um "tique" curto e agudo, quase de cristal, sintetizado na hora (Web
Audio, sem arquivo). Tipos: `tique` (botão), `aba` (navegação), `abrir`/`fechar` (menu),
`ligar`/`desligar` (chave), `ok`, `erro`. Volume baixo de propósito: se dá para reparar no som
enquanto se trabalha, ele está alto demais.

## Variações vistas na série

- **Lateral recolhível** (Sidebar V5): vira um trilho de ícones com dica flutuante no hover,
  e abre na lateral completa com busca, seções e chave de "modo noturno".
- **Abas com lâmpada** (Navigation Tabs V5): uma luz verde-água acende em cima da aba ativa e
  escorrega junto. Outras variantes: a borda brilhante que "sobe" em volta da aba ativa, e a aba
  ativa que salta para fora da barra num círculo, com um entalhe na barra embaixo dela.
- **Claro e azulado** (Admin Dashboard V2): o mesmo vidro sobre fundo azul-petróleo claro.
- **Cartão que vira** (Checkout V2): o cartão de crédito gira em 3D e muda de cor no sucesso.

## Arquivos

- `vidro-espacial.css` — tokens e componentes (`.ve-placa`, `.ve-tile`, `.ve-nav`, `.ve-pilula`…)
- `vidro-espacial.js` — entrada em foco, números que contam, troca de tela, indicador, sons
- `index.html` — a demonstração: réplica do Glassy Dashboard em português
