# Cenários do Manic Math: imagens a gerar

## Regras para todas as imagens

- **Formato:** vertical, 1170 x 2400 píxeis (proporção 9:18,5). Se o modelo só fizer 9:16, também serve.
- **Ficheiro:** PNG ou WebP, com o nome indicado em cada cenário (por exemplo `porto.png`).
- **Pasta:** `assets/scenes/` no repositório pcarras/manicmath2, ramo `main`. No GitHub: abrir a pasta, **Add file**, depois **Upload files**. Também podes enviá-las aqui na conversa.
- **Composição:**
  - os 20% de cima do ecrã ficam tapados pelo painel de pontos, por isso a lua ou o elemento principal deve ficar abaixo disso;
  - as peças do jogo enchem o ecrã de baixo para cima, por isso o monumento principal deve ficar entre os 35% e os 65% da altura;
  - nada de texto, letras, logótipos nem pessoas em grande plano.
- **Ambiente:** noturno e calmo, iluminação quente nas janelas e nos monumentos, céu azul-escuro e violeta, sem cores muito saturadas no centro (as peças coloridas têm de se ler bem por cima).

### Texto de estilo comum (juntar no fim de cada descrição)

> Style: detailed 2D digital illustration for a mobile game background, painterly with soft lighting, depth through atmospheric perspective (distant layers hazier and bluer), calm night mood, deep navy and violet sky with stars, warm golden window lights, gentle bloom on lights, slightly desaturated mid-tones, no text, no logos, no people in the foreground, vertical 9:18 composition, main subject in the middle third, empty sky in the top fifth.

## Os cenários

1. **`lisbon.png`, Lisboa à noite.** Já fiz uma versão (docs/lisboa-nova.png). Só é preciso se quiseres uma melhor.
   > Lisbon at night seen from the Tagus river: the Alfama hill covered with old houses with terracotta roofs and warm lit windows, São Jorge castle floodlit on top, the twin towers of the Sé cathedral, the white dome of the National Pantheon, a yellow tram on a steep street, the red 25 de Abril suspension bridge and the Cristo Rei statue on the far bank, city lights reflected in the calm river, full moon.

2. **`porto.png`, Porto e o Douro.**
   > Porto at night seen from the Douro river: the colourful narrow tall houses of Ribeira stacked up the hill, the Clérigos tower on the skyline, the iron double-deck arch of the Dom Luís I bridge lit up, traditional rabelo boats with square sails moored on the river, Vila Nova de Gaia wine cellars on the other bank, warm reflections on the water.

3. **`sintra.png`, Sintra e o Palácio da Pena.**
   > Sintra at night: the colourful Pena Palace (yellow and red walls, towers, a dome) on top of a hill covered with a dense misty forest, the Moorish Castle walls on a nearby ridge, soft fog between the trees, moonlight, a few warm lights in the palace windows.

4. **`algarve.png`, Falésias do Algarve.**
   > Algarve coast at dusk turning into night: golden limestone cliffs with natural arches and sea stacks like Ponta da Piedade, a calm turquoise sea, a small fishing boat with a lantern, the last orange glow on the horizon, first stars, gentle waves with foam at the foot of the rocks.

5. **`coimbra.png`, Coimbra.**
   > Coimbra at night seen from across the Mondego river: the old university on top of the hill with its clock tower lit up, old houses stepping down the hill to the river, the Santa Clara bridge, warm reflections on the water, moon.

6. **`obidos.png`, Óbidos.**
   > The medieval walled village of Óbidos at night: white houses with yellow and blue stripes, red tiled roofs, the castle and crenellated walls lit by warm lights, bougainvillea flowers, a narrow cobbled street, lanterns, starry sky.

7. **`evora.png`, Évora.**
   > The Roman Temple of Évora at night: granite Corinthian columns on a high base, softly floodlit, the cathedral towers behind, white houses around a quiet square, olive trees, a clear starry Alentejo sky.

8. **`madeira.png`, Madeira.**
   > Funchal, Madeira at night: houses and lights climbing steep green mountains around the bay, the marina with a few boats, a cruise ship lit in the harbour, low clouds on the mountain tops, the moon reflected in the Atlantic.

9. **`acores.png`, Açores.**
   > Sete Cidades in the Azores at night: twin crater lakes, one blue and one green, surrounded by green volcanic hills, a small village with white houses and warm lights by the lake, blue hydrangeas in the foreground, mist, starry sky.

10. **`ocean.png`, Fundo do mar.**
    > Deep underwater scene at night: moonlight rays coming through the surface, kelp forest swaying, colourful coral and rocks on the sea floor, small glowing fish, bubbles, a calm deep blue palette.

11. **`beach.png`, Praia ao pôr do sol.**
    > A calm Portuguese beach just after sunset: the last orange and pink light on the horizon, silhouettes of palm trees and fishing boats on the sand, gentle waves, the first stars and a thin crescent moon.

## Estado

Todas as imagens estão na loja. Para uma imagem nova ou substituída: pôr `nome.png` (768 x 1376 ou maior, vertical) em `assets/scenes/`, acrescentar o cenário em `tools/scenes/process.py` (onde ficam a lua, o céu, a água, as luzes) e correr `python3 tools/scenes/process.py nome`. Isso cria `assets/scenes/web/nome.webp` (a imagem do jogo, com o centro ligeiramente mais calmo), `assets/scenes/thumb/nome.webp` (a miniatura da loja) e `assets/scenes/web/nome.json` (as animações). Depois é só juntar o cenário a `SCENES` em `js/progress.js` e a `PICTURES` em `js/backdrops.js`.
