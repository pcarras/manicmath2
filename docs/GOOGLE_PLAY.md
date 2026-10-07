# Manic Math na Google Play: o que falta fazer

O que já está pronto no repositório:

- `android/twa-manifest.json`: a app Android (pacote `pt.bicagames.manicmath`) que abre o site em ecrã inteiro.
- `.github/workflows/android.yml`: constrói a app assinada e envia-a para a Play Store.
- `.github/workflows/store-listing.yml`: envia textos, ícone, imagem de destaque e capturas (PT e EN).
- `fastlane/metadata/android/`: a ficha da loja.
- `privacy.html`: política de privacidade, em https://manic-math-2-pwa.vercel.app/privacy.html

Os passos abaixo envolvem a sua identidade, pagamentos ou chaves secretas, por isso são seus.

## 1. Conta de programador (uma vez)

1. Abra https://play.google.com/console/signup com a conta Google que quer usar.
2. Escolha conta **pessoal**, pague a taxa única de 25 dólares e faça a verificação de identidade (pode demorar alguns dias).

## 2. Chave de assinatura e primeira app (PWABuilder)

1. Abra https://www.pwabuilder.com e escreva `https://manic-math-2-pwa.vercel.app`.
2. Carregue em **Package for stores** e depois em **Android** e **Generate Package** (ou **Options**).
3. Preencha:
   - Package ID: `pt.bicagames.manicmath`
   - App name: `Manic Math 2` · Launcher name: `Manic Math`
   - App version: `4.1.0` · Version code: `1`
   - Display mode: `Fullscreen`
   - Signing key: **Create new**. Nome e organização: Bica Games, país PT.
4. Descarregue o ZIP. Lá dentro estão o `.aab` (a app), o `signing.keystore` (a chave) e um ficheiro de texto com as palavras-passe e o alias.
5. **Guarde o ZIP num sítio seguro e com cópia.** Sem esta chave não se pode atualizar a app.

## 3. Segredos no GitHub (uma vez)

No GitHub abra `pcarras/manicmath2`, depois **Settings → Secrets and variables → Actions → New repository secret**, e crie:

| Nome | Valor |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | o ficheiro `signing.keystore` convertido em texto (ver abaixo) |
| `ANDROID_KEYSTORE_PASSWORD` | "Key store password" do ficheiro de texto |
| `ANDROID_KEY_PASSWORD` | "Key password" do ficheiro de texto |
| `ANDROID_KEY_ALIAS` | "Key alias" do ficheiro de texto |

Converter a chave em texto e copiar:

- Windows (PowerShell, na pasta do ZIP): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("signing.keystore")) | Set-Clipboard`
- Mac (Terminal, na pasta do ZIP): `base64 -i signing.keystore | pbcopy`

Depois é colar no valor do segredo.

## 4. Criar a app na Play Console

1. **Criar app**: **Jogo**, **Gratuito**. Idioma predefinido: **Inglês (Estados Unidos)**, nome `Manic Math: Fast Maths`. É o que a Google mostra a quem tem o telemóvel noutros idiomas, por isso convém ser inglês. Depois, em **Presença na loja → Ficha principal → Gerir traduções**, acrescenta **Português (Portugal)** com o nome `Manic Math: Contas Rápidas`. Os textos e as capturas dos dois idiomas estão em `fastlane/metadata/android/en-US` e `pt-PT`. Se uma tradução não tiver imagens próprias, a Google usa as do idioma predefinido, por isso as capturas em português só aparecem a quem tem o telemóvel em português se as carregares na tradução.
2. Em **Conteúdo da app**, preencha:
   - Política de privacidade: `https://manic-math-2-pwa.vercel.app/privacy.html`
   - Anúncios: **Não**
   - Classificação de conteúdo: questionário (jogo de puzzle, sem violência)
   - Público-alvo: o jogo é pensado para os 6 aos 12 anos, por isso aplica-se o programa **Famílias** da Google. Escolha as faixas etárias reais e confirme que não há anúncios, que não há conversa por texto e que não há texto escrito pelos jogadores (os nomes são sempre gerados). Se escolher só 13+ o caminho é mais simples, mas deixa de ser um jogo para crianças.
   - Segurança dos dados: recolhe **Identificadores do dispositivo ou outros** (um identificador aleatório) e **Atividade na app** (pontuações, vitórias de duelo e lista dos últimos 50 jogadores com quem jogou, para o ranking de amigos), para funcionalidade da app, não partilhados, encriptados em trânsito. Os prazos de apagamento estão em `privacy.html`.
   - Funcionalidades sociais: os jogos a dois usam um código de 4 dígitos e não têm conversa. O ecrã mostra o aviso "joga com quem conheces".
3. Em **Teste → Teste fechado**, crie uma faixa, carregue o `.aab` do PWABuilder (o primeiro envio tem de ser manual), adicione os testadores pelo email e publique. Em contas pessoais criadas depois de novembro de 2023, o teste fechado é obrigatório antes da produção.
4. **Regra da conta pessoal**: são precisos **pelo menos 12 testadores inscritos durante 14 dias seguidos** antes de pedir acesso à produção.
5. **Teste aberto (opcional, depois do fechado)**: em **Teste → Teste aberto** qualquer pessoa com o link ou na loja pode instalar a versão de teste. Serve para apanhar problemas com mais gente antes da produção. Não substitui o teste fechado.
6. **Antes de enviar a versão final**: confirme que o MODO GOD está desligado (já vem desligado de origem e só aparece no menu de programador).

## 5. Conta de serviço para envios automáticos (uma vez)

1. Em https://console.cloud.google.com crie um projeto (por exemplo `bica-games-play`).
2. Em **APIs e serviços → Biblioteca**, ative **Google Play Android Developer API**.
3. Em **IAM e administração → Contas de serviço**, crie uma conta (por exemplo `github-play`), abra-a, vá a **Chaves → Adicionar chave → JSON** e descarregue o ficheiro.
4. Na Play Console, em **Utilizadores e autorizações → Convidar novos utilizadores**, use o email da conta de serviço. Dê acesso à app Manic Math com as permissões de **lançar apps em faixas de teste**, **lançar apps em produção** e **gerir a presença na loja**.
5. No GitHub crie o segredo `PLAY_SERVICE_ACCOUNT_JSON` com o conteúdo completo do ficheiro JSON.

## 6. Enviar-me a impressão digital da chave

Na Play Console, em **Teste e lançamento → Configuração → Integridade da app → Assinatura de apps**, copie o **certificado SHA-256 da chave de assinatura da app**. Não é secreto. Com ele crio o ficheiro `.well-known/assetlinks.json`, que faz a app abrir em ecrã inteiro sem a barra do browser.

## Depois disto, tudo é automático

- **Nova versão da app**: o código vai para o ramo `play-release`, o GitHub constrói e envia para a faixa escolhida (por omissão `internal`).
- **Ficha da loja**: o código vai para o ramo `play-listing`, o GitHub envia textos e imagens.
- O site continua a atualizar sozinho na Vercel a cada envio para `main`. A app instalada abre o site, por isso **as mudanças no jogo chegam à app sem nova versão na loja**. Só é preciso nova versão quando muda o ícone, o nome ou a configuração Android.
