# Manic Math na Google Play: respostas prontas para os formulários

Rascunho para consultar enquanto preenches a Play Console. Os formulários da Google mudam de tempos a tempos: se uma pergunta for diferente, responde com o que o jogo faz de facto (descrito abaixo) e não com a letra deste ficheiro.

## O que o jogo faz (a base de todas as respostas)

- Sem anúncios, sem compras com dinheiro real, sem contas, sem login.
- Os grãos de café são moeda do jogo, ganha-se a jogar e não se compra.
- Sem conversa por texto nem voz. Os jogos a dois (equipa e duelo) usam um código de 4 dígitos.
- Os jogadores nunca escrevem texto que outros vejam: o nome no ranking é gerado a partir de listas de palavras (por exemplo "Pastel Veloz 7").
- Dados enviados ao servidor (Vercel e Upstash Redis): um identificador aleatório criado no telemóvel, o nome gerado, pontuações, vitórias de duelo, pontos da dupla e a lista dos últimos 50 jogadores com quem jogou (só para o ranking de amigos). Tudo por HTTPS.
- Tudo o resto (progresso, grãos, análise de erros, cromos) fica só no telemóvel.
- Prazos de apagamento: diário 8 dias, semanal 3 semanas, salas 2 horas. Ficam sem prazo: o melhor resultado de sempre e as vitórias de duelo acumuladas.
- Mínimo de dados: não pede localização, contactos, câmara, microfone nem ficheiros.

## Conteúdo da app

- **Anúncios:** Não.
- **Acesso à app:** todas as funções estão disponíveis sem restrições (sem login).
- **Categoria:** Jogos, puzzle.
- **Questionário de classificação de conteúdo:** jogo de puzzle de matemática. Sem violência contra personagens (há bombas de desenho animado que rebentam peças de jogo), sem linguagem imprópria, sem conteúdo sexual, sem drogas, sem jogos de azar, sem conteúdo gerado pelos utilizadores e sem partilha de localização. Em "interação entre utilizadores" responde que existem jogos a dois por código, sem conversa nem troca de conteúdo. Responde com cuidado a cada pergunta, a classificação sai do questionário.
- **Público-alvo:** o jogo é pensado para os 6 aos 12 anos (também serve a adultos). Marca as faixas etárias correspondentes. Ao incluir menores de 13, aplica-se o programa Famílias: sem anúncios, política de privacidade, sem identificador de publicidade, sem pedir dados desnecessários.
- **Funcionalidades para crianças:** o jogo a dois é só com quem tem o código (ecrã com o aviso "joga com quem conheces").

## Segurança dos dados

| Pergunta | Resposta |
| --- | --- |
| Recolhe ou partilha dados? | Recolhe. Não partilha com terceiros (a Vercel e o Upstash só alojam os dados, em nome do jogo). |
| Dados cifrados em trânsito? | Sim (HTTPS). |
| Pode o utilizador pedir o apagamento? | Sim, por email para o contacto da política de privacidade. |
| Tipos de dados | **Identificadores**: ID de utilizador ou de dispositivo (aleatório, criado no telemóvel). **Atividade na app**: outras ações (pontuações, vitórias, jogadores com quem jogou). Nada mais. |
| Finalidade | Funcionalidades da app (rankings e jogos a dois). |
| A recolha é obrigatória? | Não, o jogo funciona sem ligação. |

## Teste fechado (conta pessoal nova)

Precisas de **pelo menos 12 testadores com a conta Google, inscritos durante 14 dias seguidos**, antes de pedires acesso à produção. Todos têm de aceitar o convite (link de inscrição) e instalar a app pela Google Play. A Play conta os que continuam inscritos, por isso convida mais de 12 (15 a 20) para teres margem.

### Mensagem de convite (PT)

> Olá! Estou a lançar na Google Play o Manic Math, um jogo de contas para miúdos e graúdos. Preciso de testadores durante 2 semanas. Se puderes ajudar:
> 1. Diz-me o teu email Google (Gmail).
> 2. Quando eu te adicionar, vais receber um link. Abre-o no telemóvel Android e carrega em "Tornar-me testador".
> 3. Instala a app pelo link da Play Store e joga um bocadinho quando puderes. Não te peço mais nada. Se não gostares de alguma coisa, diz-me.
> Importante: não saias do teste antes de 14 dias, senão deixo de ter os testadores necessários. Obrigado!

### Mensagem de convite (EN)

> Hi! I'm releasing Manic Math on Google Play, a maths puzzle game for kids and grown-ups. I need testers for 2 weeks. If you can help:
> 1. Send me your Google (Gmail) address.
> 2. Once I add you, you will get a link. Open it on an Android phone and tap "Become a tester".
> 3. Install the app from the Play Store link and play a little when you can. That's all. If something bothers you, tell me.
> Please do not leave the test before 14 days, or I lose the testers I need. Thank you!
