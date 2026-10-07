# Manic Math: arte a gerar (mascote, cromos, capas, ícones)

Instruções para o agente que gera as imagens (Antigravity ou Codex).

## Regras gerais

- **Não alterar código.** Só criar imagens nas pastas indicadas. O código é ligado depois.
- **Formato:** PNG.
- **Fundo:** a mascote, os retratos e os ícones precisam de fundo removível. Usar fundo verde liso **#00FF00**, sem sombras nem gradiente no verde e sem verde na própria figura. Se o modelo souber fazer PNG transparente a sério, também serve.
- **Estilo comum:** desenho animado 2D para crianças dos 6 aos 12 anos, contorno escuro grosso (#1b0f2e), cores vivas mas não fluorescentes, sombreado suave em duas tonalidades, olhos grandes e expressivos. Tem de ficar coerente com os cenários noturnos do jogo (docs/CENARIOS_PROMPTS.md).
- **Sem texto, letras nem logótipos dentro das imagens**, exceto os símbolos matemáticos pedidos.
- **Consistência:** gerar primeiro a folha de personagem da mascote e usá-la como imagem de referência em todas as poses seguintes.
- No fim, fazer commit só dos ficheiros novos, com a mensagem `Add art: <grupo>`, e push para `main`.

Texto de estilo para juntar a cada pedido:

> Style: 2D cartoon illustration for a kids' math mobile game (ages 6-12), thick dark outline (#1b0f2e), bright friendly colours, soft two-tone cel shading, big expressive eyes, clean shapes that read well at small sizes, centred subject, plain solid #00FF00 background with no shadow on the background, no text, no logos.

## Fase 1: mascote Bica (prioridade máxima)

**Pasta:** `assets/mascot/`, imagens quadradas de 1024 x 1024.

**A personagem:** a Bica é uma chávena de café expresso portuguesa, branca, com um pires. Tem cara na frente da chávena, dois bracinhos finos e luvas brancas tipo desenho animado. Por cima tem uma camada de café com espuma (crema) que parece cabelo, e um fio de vapor que muda de forma com a emoção. É simpática, curiosa e um pouco traquina.

| Ficheiro | Pose |
|---|---|
| `bica-sheet.png` | Folha de personagem: frente, três quartos e lado, em pé, neutra (1536 x 1024) |
| `bica-happy.png` | Contente, a sorrir e a acenar |
| `bica-think.png` | A pensar, com a mão no queixo e um ponto de interrogação feito de vapor |
| `bica-cheer.png` | A festejar com os dois braços no ar, saltinho e estrelinhas à volta |
| `bica-sad.png` | Triste mas fofa, vapor caído, uma lágrima pequena |
| `bica-point.png` | A apontar para a direita, com ar de quem explica |
| `bica-sleep.png` | A dormir, de olhos fechados e "zzz" feito de vapor (para a pausa) |
| `bica-wow.png` | Surpreendida, de boca aberta, quando ganha um recorde |

**Acessórios para a loja:** cada um num ficheiro separado, só o acessório, 512 x 512, desenhado para encaixar no topo da chávena da folha de personagem.

| Ficheiro | Acessório |
|---|---|
| `acc-cap.png` | Boné de pala |
| `acc-crown.png` | Coroa dourada pequena |
| `acc-glasses.png` | Óculos redondos de "génio" |
| `acc-scarf.png` | Cachecol às riscas |
| `acc-party.png` | Chapéu de festa |
| `acc-headphones.png` | Auscultadores |

## Fase 2: retratos da caderneta (20 matemáticos)

**Pasta:** `assets/stickers/`, 768 x 768 cada.

Retrato em desenho animado do peito para cima, sorridente e simpático, com roupa da época e do país. Fundo **#00FF00**. O mesmo enquadramento em todos: cabeça no terço de cima e ombros a tocar a parte de baixo. Pode incluir um pequeno objeto ligado à curiosidade de cada um (indicado entre parênteses).

1. `pythagoras.png`: Pitágoras, Grécia antiga (um triângulo retângulo)
2. `euclid.png`: Euclides, Alexandria antiga (um compasso e um pergaminho)
3. `archimedes.png`: Arquimedes, Siracusa antiga (um círculo com o símbolo π)
4. `hypatia.png`: Hipátia de Alexandria, professora (um astrolábio)
5. `brahmagupta.png`: Brahmagupta, Índia do século VII (um grande 0)
6. `khwarizmi.png`: Al-Khwarizmi, Bagdade do século IX (um livro aberto)
7. `fibonacci.png`: Fibonacci, Itália medieval (um coelho e uma espiral)
8. `nunes.png`: Pedro Nunes, Portugal do século XVI (um instrumento de navegação, um quadrante)
9. `descartes.png`: René Descartes, França do século XVII (uma folha quadriculada com eixos)
10. `pascal.png`: Blaise Pascal, França do século XVII (uma calculadora mecânica de rodas)
11. `newton.png`: Isaac Newton, Inglaterra do século XVII (uma maçã)
12. `euler.png`: Leonhard Euler, Suíça do século XVIII (uma pena e muitos papéis)
13. `gauss.png`: Carl Friedrich Gauss, menino de 10 anos na Alemanha (uma ardósia)
14. `germain.png`: Sophie Germain, França por volta de 1800 (uma carta)
15. `lovelace.png`: Ada Lovelace, Inglaterra do século XIX (folhas com engrenagens)
16. `ramanujan.png`: Srinivasa Ramanujan, Índia por volta de 1910 (um táxi antigo de brinquedo)
17. `noether.png`: Emmy Noether, Alemanha por volta de 1920 (um padrão simétrico)
18. `turing.png`: Alan Turing, Inglaterra por volta de 1940 (uma máquina de rodas)
19. `johnson.png`: Katherine Johnson, NASA por volta de 1960 (um foguetão pequeno)
20. `mirzakhani.png`: Maryam Mirzakhani, por volta de 2014 (uma superfície em forma de donut)

Retratos respeitosos e simpáticos, sem caricaturar traços étnicos.

## Fase 3: capas dos mini jogos e ícones da interface

**Capas dos mini jogos:** pasta `assets/drills/`, 512 x 512, com fundo de cor e sem verde. A mascote Bica pode aparecer.

| Ficheiro | Capa |
|---|---|
| `friends10.png` | Amigos do 10: dois blocos de números que se abraçam (3 e 7) |
| `doubles.png` | Dobros e metades: um espelho a duplicar uma maçã |
| `times.png` | Tabuada relâmpago: um quadro de giz com um raio |
| `multiples.png` | Múltiplos: uma escada de doces de 3 em 3 |
| `pizza.png` | Frações em pizza: uma pizza cortada em quartos |
| `primes.png` | Caça aos primos: um mergulhador com uma lupa no fundo do mar |

**Ícones da interface:** pasta `assets/ui/`, 256 x 256, fundo #00FF00, estilo plano e grosso, todos com a mesma espessura de traço.

Os ficheiros são: `pause.png`, `play.png`, `settings.png`, `shop.png`, `ranking.png`, `training.png`, `sound-on.png`, `sound-off.png`, `music.png`, `vibration.png`, `home.png`, `restart.png`, `album.png`, `star.png` e `bean.png` (um grão de café).
