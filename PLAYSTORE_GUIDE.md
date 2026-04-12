# Guia: Publicar CoolTrack Pro na Play Store (PWA → TWA)

## O que foi feito neste projeto

O projeto agora tem suporte completo a PWA:

| Arquivo                              | Descrição                                                         |
| ------------------------------------ | ----------------------------------------------------------------- |
| `public/manifest.json`               | Identidade do app (nome, ícones, cores, shortcuts)                |
| `public/sw.js`                       | Service Worker (cache offline, fallback)                          |
| `public/offline.html`                | Tela exibida quando não há conexão                                |
| `public/icons/`                      | Ícones em 9 tamanhos + maskable para Android                      |
| `public/.well-known/assetlinks.json` | Vinculação do app Android ao domínio (preencher após gerar o APK) |

---

## Passo a passo para ir à Play Store

### 1. Fazer deploy do site (se ainda não tiver)

Faça o deploy no Netlify (já configurado no projeto):

1. Acesse [app.netlify.com](https://app.netlify.com)
2. Conecte o repositório
3. Configure as env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_AUTH_REDIRECT_URL`
4. Build command: `npm run build` | Publish dir: `dist`

> O site precisa estar em HTTPS. O Netlify já faz isso automaticamente.

---

### 2. Gerar o APK/AAB com PWABuilder

1. Acesse [pwabuilder.com](https://www.pwabuilder.com)
2. Cole a URL do seu site (ex.: `https://seusite.netlify.app`)
3. O PWABuilder vai validar o manifest e o service worker automaticamente
4. Clique em **"Package for stores"** → escolha **Android**
5. Preencha os dados:
   - **Package ID**: algo como `com.cooltrackpro.app`
   - **App version**: `1.0.0`
   - **Version code**: `1`
6. Clique em **"Generate"** → baixe o `.zip` com o `.aab` e o `assetlinks.json`

---

### 3. Preencher o assetlinks.json no seu site

Após gerar o APK no PWABuilder:

1. Abra o `.zip` baixado
2. Encontre o arquivo `assetlinks.json` gerado
3. **Substitua** o conteúdo de `public/.well-known/assetlinks.json` no projeto pelo conteúdo gerado
4. Faça um novo deploy (o Netlify vai atualizar automaticamente)
5. Confirme que o arquivo está acessível em: `https://seusite.com/.well-known/assetlinks.json`

---

### 4. Criar conta de desenvolvedor na Play Store

1. Acesse [play.google.com/console](https://play.google.com/console)
2. Pague a taxa única de **US$ 25** para criar a conta
3. Crie um novo app → **"App Android"** → tipo: **"Aplicativo"**

---

### 5. Submeter o app

1. Vá em **"Versões"** → **"Produção"** → **"Criar nova versão"**
2. Faça upload do arquivo `.aab` gerado pelo PWABuilder
3. Preencha:
   - **Título**: CoolTrack Pro
   - **Descrição curta**: Gestão de manutenção HVAC para técnicos autônomos
   - **Descrição longa**: (detalhe as funcionalidades)
   - **Capturas de tela**: mínimo 2 screenshots do app em funcionamento
   - **Ícone do app**: use o `icon-512x512.png` da pasta `public/icons/`
   - **Classificação de conteúdo**: preencha o questionário (app empresarial)
4. Clique em **"Revisar versão"** → **"Iniciar lançamento para produção"**

---

### 6. Aguardar revisão

- A revisão inicial costuma levar de **3 a 7 dias úteis**
- O Google pode solicitar ajustes (política de privacidade, capturas de tela, etc.)

---

## Itens obrigatórios que você precisará ter

- [ ] URL do site em produção (HTTPS)
- [ ] `assetlinks.json` atualizado com o fingerprint do APK gerado
- [ ] Política de Privacidade publicada (URL pública)
- [ ] Conta de desenvolvedor Google Play (US$ 25 — taxa única)
- [ ] Screenshots do app (mínimo 2, recomendado 4-8)
- [ ] Ícone 512×512 (já gerado em `public/icons/icon-512x512.png`)

---

## Verificar se a PWA está correta antes de enviar

Abra o Chrome DevTools → aba **"Lighthouse"** → rode a auditoria **"PWA"**.
Todos os itens devem estar verdes antes de submeter ao PWABuilder.

Ou use diretamente: [web.dev/measure](https://web.dev/measure)
