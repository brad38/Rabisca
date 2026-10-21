# Rabisca — minigame de desenho no navegador

Uma interface web em português para partidas privadas com até 10 jogadores. A cada rodada todos recebem **o mesmo tema sorteado automaticamente** de `temas_desenho_ptbr.json` (2.576 temas), desenham com duração definida ou sem limite, esperam todos terminarem e votam no favorito com um prazo de 30 segundos.

## Rodar localmente

Não precisa instalar pacotes npm. Sirva a pasta por HTTP:

```bash
python -m http.server 8080
```

Acesse http://localhost:8080. O catálogo de temas também pode ser carregado em `file://` por meio de `temas_embutidos.js`; a comunicação online entre jogadores ainda deve ser testada por HTTP/HTTPS.

## Publicar na Vercel

Importe esta pasta como projeto estático na Vercel, sem framework e sem build. `index.html` é a página de entrada. Compartilhe a URL gerada para que os amigos abram no celular ou no computador.

## Como funciona a conexão

- **PeerJS/WebRTC em estrela:** uma pessoa hospeda; cada amigo se conecta diretamente a ela. Não é uma malha completa entre os 10 jogadores.
- O serviço público padrão de sinalização do PeerJS é usado para encontrar os participantes; portanto, não é uma solução totalmente autônoma nem com disponibilidade garantida.
- O anfitrião é a fonte de verdade para temas, rodadas, votações e placar; todos devem manter a aba aberta durante a partida.
- Os traços são desenhados localmente e **apenas a imagem final é enviada** via WebRTC ao anfitrião, que distribui a galeria.
- Este é um MVP experimental. NAT/firewalls restritos podem bloquear conexões WebRTC sem TURN; não há reconexão automática, armazenamento permanente, sistema de denúncia ou proteção contra trapaças. Para serviço público, recomendamos substituir a camada de rede por servidor de sala (por exemplo, Cloudflare Durable Objects/PartyServer).
- A interface contém um **modo demonstração** que funciona sem entrar em sala e simula os demais jogadores, para conferir design, desenho e votação.

## Interface

Fluxo: tela inicial, sala de espera, **contagem regressiva animada de 3 segundos**, desenho, galeria/resultado. A contagem acontece tanto ao começar a partida quanto depois de clicar em **Próxima rodada**, para todos os participantes, usando um prazo definido pelo anfitrião.

- O botão **?** no cabeçalho abre um modal **Como jogar**; fecha por ×, **Entendi!**, Esc ou clique no fundo.
- No lobby: card de código alinhado, cabeçalho **Sala de [apelido do anfitrião]**, seletores de tempo/rodadas e **seleção de categorias de temas** (16 categorias, todas por padrão), além de até 30 temas personalizados separados por vírgulas. O anfitrião configura; os convidados recebem as opções sincronizadas.
- **Tempo indeterminado** (`Sem limite`) é representado internamente por `duration: 0`. A rodada só passa à galeria quando todos os participantes conectados entregarem seus desenhos. Com tempo definido, o cliente envia automaticamente no encerramento; o anfitrião aguarda os envios pendentes em vez de abrir a galeria após um atraso arbitrário. Se um participante mantiver conexão ativa, mas nunca enviar, os demais continuarão aguardando.
- A **galeria abre somente após todos os desenhos dos jogadores conectados terem sido recebidos**. A votação dura 30 segundos e oferece **Gostei e Dislike**. Cada jogador tem uma avaliação ativa: pode trocar o desenho, mudar de reação ou cancelar clicando de novo. O placar usa **curtidas menos dislikes**; só há vencedor da rodada com saldo positivo. O resultado é divulgado após o prazo, mesmo quando todos já avaliaram. Não se pode avaliar o próprio desenho.
- Botão **Início** nas telas de partida e **Tela inicial** nos resultados, com confirmação ao sair durante uma rodada. Sem o texto de rodapé redundante.
- No desenho: barra lateral com **Lápis, Borracha, Tamanho, Desfazer, Refazer, Preencher, Formas, Cores e Limpar tudo**. As formas disponíveis são retângulo, círculo e linha. O preenchimento atua em áreas contíguas de cor igual. Todas as ações entram no histórico de desfazer/refazer.
- Em desktop com pelo menos 900 px de largura e 610 px de altura, a tela de desenho se ajusta à janela sem scroll vertical do documento. Em telas menores, a barra de ferramentas se adapta e pode rolar horizontalmente.

O fundo usa gradiente colorido e elementos minimalistas, sem setas de navegação, botões redundantes ou pontos usados como separadores textuais.

## Arquivos

- `index.html`: HTML e metadados.
- `styles.css`: sistema visual responsivo, gradientes e componentes.
- `app.js`: jogo, canvas, cronômetro, PeerJS e votação.
- `temas_desenho_ptbr.json`: catálogo de temas sorteados automaticamente (incluindo Valorant).
- `temas_embutidos.js`: cópia gerada do JSON, carregada antes de `app.js` para evitar falhas de leitura do arquivo por `fetch` no navegador.
- `favicon.svg`: ícone do jogo.

## Atualização v4 — interface

- Alinhamento e altura padronizada dos três elementos do cabeçalho.
- Separação visual de opções de menu com espaçamento e fundos de estados distintos, sem marcadores de bolinha.
- Botão `+` na paleta de desenho abre o seletor RGB nativo do navegador.
- Atalhos: `Ctrl+Z` desfaz, `Ctrl+R` refaz. `Ctrl+Y` e `Ctrl+Shift+Z` também refazem no canvas. Esses atalhos só são interceptados durante o desenho, sem foco em campos de texto.
- Canvas preenche toda a região branca do painel, inclusive quando a proporção de tela muda.
- Galeria compacta adaptada para até dez desenhos com todos visíveis no viewport. Em telas estreitas a barra de ferramentas é horizontal.
- Tela de ajuda maior, com quatro ilustrações vetoriais e instruções concisas.
- Durante rodadas com tempo ilimitado, a região do cronômetro de desenho permanece vazia (a opção continua identificada como "Sem limite" no lobby).

Testes funcionais automatizados: Chromium headless 1366x768, 1280x720 e 390x844, incluindo desenho, atalhos, seleção de cor, galeria com dez itens e voto removível. A comunicação P2P real ainda depende de testes entre dispositivos.

## Ajuste visual v5 — Sala de espera

- O lobby usa melhor a largura da janela (até 1660 px) e se estende pela altura disponível no desktop.
- Configurações e seleção de temas ficam maiores, sem recorte em 1280 × 720 ou 1366 × 768.
- A lista exibe os 10 lugares previstos em um painel de duas colunas (os lugares vagos adicionais aparecem apenas no desktop).
- O código da sala foi alinhado no canto superior direito do painel.
- Na visualização mobile, a estrutura compacta anterior foi preservada.

### Ajustes da versão 6

- Tela de contagem regressiva expandida para usar a área disponível, com contador centralizado e círculo com animação leve.
- Os desenhos simulados no modo de demonstração não incluem mais a assinatura `por Nome` dentro da imagem: o autor já aparece no rodapé do card da galeria. O título do tema também fica apenas na interface.
- CSS e JavaScript com versão 6 nos links para evitar cache de versões anteriores.

## Correção de categorias e catálogo (v7)

As 15 categorias já tinham temas no JSON. O erro vinha do fallback anterior: quando `fetch` falhava, o jogo utilizava 10 palavras sem `categoria`, deixando o sorteio vazio ao selecionar categorias específicas. Agora `temas_embutidos.js` carrega o catálogo completo antes do jogo e o código valida os IDs das categorias. Para adicionar temas no futuro, atualize `temas_desenho_ptbr.json` e gere novamente `temas_embutidos.js` a partir do JSON. O tema "Valorant" já existia; foram adicionados agentes, armas, itens e mapas relacionados.


## v8 — Categoria Valorant atualizada (20/10/2026)

- Categoria independente **Valorant**: a interface agora oferece 16 categorias ao todo.
- Lista de **29 agentes jogáveis** conforme o site oficial (incluindo Miks, Veto, Waylay e Tejo), **13 mapas**, **21 armas** (incluindo Warden e Bandit), **116 habilidades** (4 por agente) e 8 itens/cenas.
- Os temas Valorant antigos foram retirados de "Personagens" e "Jogos, filmes e séries" para impedir duplicidade entre categorias.
- Campos opcionais `subcategoria` nos temas de Valorant (`agentes`, `mapas`, `armas`, `habilidades`, `elementos`, `geral`). A interface continua oferecendo um único botão Valorant.
- O arquivo `temas_embutidos.js` foi regenerado a partir de `temas_desenho_ptbr.json`; referências do HTML têm versão 12 para atualizar o cache.
- Fontes: https://playvalorant.com/pt-br/agents/ , https://playvalorant.com/pt-br/maps/ , https://playvalorant.com/pt-br/arsenal/ , https://playvalorant.com/pt-br/news/game-updates/valorant-patch-notes-13-06/ , https://valorant.gs/agents/ .

## v9 — Efeitos sonoros (sem música de fundo)

- Efeitos curtos criados com a Web Audio API em `sfx.js`: cliques, entrada de jogador, contagem regressiva, início de rodada, últimos cinco segundos do desenho e da votação, entrega, galeria, voto, cancelamento de voto e resultados.
- Botão de alto-falante no cabeçalho ativa/desativa os efeitos; a preferência é lembrada pelo navegador usando `localStorage` quando disponível.
- O som só é desbloqueado após interação do jogador (exigência do navegador). Não toca em abas ocultas.
- Não usa música, arquivos externos de áudio, bibliotecas extras nem backend. Funciona com hospedagem estática na Vercel.
- Para alterações, ajuste a síntese dos sons em `sfx.js`. Mantenha a inclusão desse arquivo antes de `app.js` no `index.html`.

## Ajustes de categorias e Valorant

- Os botões de categorias marcam e desmarcam imediatamente sem reconstruir a tela ou reiniciar suas animações. Nos convidados as mudanças também sincronizam sem recriar o lobby.
- A categoria Valorant contém **72 temas**: agentes (29), mapas (13), armas (21), elementos do jogo (8) e o tema geral Valorant (1). **Nenhuma habilidade é sorteada.**
- O catálogo JSON e sua cópia `temas_embutidos.js` foram atualizados em conjunto (2.576 temas, 16 categorias).
