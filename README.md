# CoolTrack Pro

Aplicação web (SPA) para gestão de manutenção de equipamentos HVAC, pensada para técnicos em campo.

> Escopo atual: front-end em JavaScript com persistência local (offline-first), sincronização/autenticação via Supabase, checkout Stripe e telemetria própria.

## Visão geral do produto

O sistema cobre o dia a dia operacional de quem presta serviço de climatização:

- **Cadastro de equipamentos** por cliente e setor (splits, chillers, câmaras frias, VRFs), com marca, modelo, NS, periodicidade preventiva e histórico completo.
- **Registro de serviços** (corretivas, preventivas e visitas técnicas) com fotos, peças, assinatura do cliente e geração de PDF pronto pra WhatsApp.
- **Score de risco (0–100)** por equipamento, com fatores visíveis, bônus de histórico bom (até −18 pts) e tendência de 30 dias (↓ melhorando, → estável, ↑ piorando).
- **Painel de alertas** com preventivas vencendo, falhas recentes e clientes sem atendimento, com sugestão da próxima ação.
- **Dashboard, histórico e relatórios** agregados por equipamento, setor e cliente.
- **Planos Free / Plus / Pro** com checkout via Stripe e limites progressivos (equipamentos, PDFs, técnicos).
- **Landing page** institucional com SEO (OG/Twitter Cards + JSON-LD) e páginas legais (Termos, Privacidade, LGPD).
- **Tour de onboarding** em 6 slides explicando os recursos principais.
- **Modo convidado** com limites, pra o técnico experimentar sem conta.
- **Telemetria** via sink próprio (batching + IndexedDB) gravando no Supabase.

## Stack

- **Runtime**: Node.js 20+ / npm 10+.
- **Build e dev server**: Vite 5.
- **Front-end**: JavaScript ES Modules + HTML + CSS.
- **Backend BaaS**: Supabase (`@supabase/supabase-js`).
- **Relatórios**: jsPDF + jsPDF-AutoTable.
- **Gráficos**: Chart.js.
- **Qualidade**: ESLint + Prettier.
- **Testes**: Vitest + jsdom.

## Decisões arquiteturais

- **SPA sem framework de UI**: menor camada de abstração e menos dependências de runtime.
- **Offline-first**: dados são persistidos localmente e sincronizados com backend quando aplicável.
- **Supabase como backend**: autenticação, banco e storage integrados via SDK único.
- **Separação por responsabilidades**:
  - `core`: infraestrutura e serviços transversais;
  - `domain`: regras de negócio;
  - `ui`: interface e orquestração de tela;
  - `features`: módulos de funcionalidade.

## Arquitetura resumida

Fluxo principal:

1. `src/app.js` inicializa sessão, roteamento e controller.
2. `ui` aciona operações de `core`.
3. `core/storage` salva localmente e tenta sincronizar com Supabase.
4. `domain` concentra regras e montagem de relatórios (ex.: PDF).

## Estrutura real de pastas

```text
.github/
  workflows/
    ci.yml
    deploy.yml
src/
  __tests__/
  assets/
    styles/
  core/
  domain/
    pdf/
      sections/
  features/
  ui/
    components/
    controller/
      handlers/
      helpers/
    shell/
      templates/
    views/
  app.js
index.html
vite.config.js
```

## Setup local

### Pré-requisitos

- Node.js **20+**
- npm **10+**

### Instalação

```bash
npm ci
```

### Rodar em desenvolvimento

```bash
npm run dev
```

### Build local

```bash
npm run build
npm run preview
```

## Variáveis de ambiente

Use `.env.example` como base:

```bash
cp .env.example .env
```

### Obrigatórias

- `VITE_SUPABASE_URL`: URL do projeto Supabase.
- `VITE_SUPABASE_KEY`: **chave pública anon** do Supabase (uso client-side).
- `VITE_AUTH_REDIRECT_URL`: URL pública da aplicação para callbacks de auth (ex.: `https://seudominio.com.br`).

### Opcionais

- `VITE_SUPABASE_PHOTOS_BUCKET` (padrão: `registro-fotos`).
- `VITE_SUPABASE_PHOTO_URL_TTL` em segundos (padrão em código: `86400`).

### Segurança (obrigatório ler)

- **Nunca** use `service_role` no frontend.
- A `service_role` ignora políticas de acesso (RLS) e, se exposta no cliente, compromete o projeto inteiro.
- Neste repositório, o frontend deve usar somente a **anon public key**.

## Secrets esperados no GitHub Actions

### Workflow de CI (`.github/workflows/ci.yml`)

- Nenhum secret obrigatório (roda lint/test/build sem injeção de credenciais).

### Workflow de Deploy (`.github/workflows/deploy.yml`)

Secrets obrigatórios no repositório:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY` (**anon public key**, nunca `service_role`)

## Scripts disponíveis

- `npm run dev`: servidor local de desenvolvimento.
- `npm run build`: build de produção em `dist/`.
- `npm run preview`: serve a build local.
- `npm run lint`: lint com ESLint.
- `npm run lint:fix`: aplica correções automáticas de lint.
- `npm run format`: formata com Prettier.
- `npm run format:check`: valida formatação.
- `npm run test`: roda testes uma vez (modo CI).
- `npm run test:watch`: modo watch.
- `npm run test:coverage`: cobertura com provider V8.
- `npm run check`: `lint + format:check + test + build`.

## Fluxo de desenvolvimento

1. Criar branch curta por tarefa.
2. Implementar alteração com commits pequenos.
3. Validar localmente (`npm run lint`, `npm run test`, `npm run build`).
4. Abrir Pull Request.
5. Aguardar CI validar `install/lint/test/build`.
6. Merge em `main` aciona deploy para GitHub Pages.

## Testes (estado atual)

Cobertura atual é focada em **testes unitários/integrados de módulos** (principalmente `core` e `domain`) com mocks de dependências externas.

- Há testes para auth, storage/sync, router, regras de dashboard, utils e bootstrap de controller.
- Não há suíte end-to-end (E2E) no estado atual.
- Não há gate de cobertura mínima no CI atualmente.
- Alguns cenários de erro aparecem no output dos testes por desenho dos casos de teste; isso não implica falha quando a suíte passa.

Comandos:

```bash
npm run test
npm run test:coverage
```

## Deploy

Os headers de segurança e o redirect SPA ficam em `public/_headers` e `public/_redirects` — formato compatível com Netlify e Cloudflare Pages, então o mesmo repositório roda nas duas plataformas sem alteração.

- **Cloudflare Pages (recomendado — build ilimitado + banda ilimitada no Free)**:
  1. Em `dash.cloudflare.com` → Workers & Pages → Create → Pages → Connect to Git.
  2. Selecionar o repositório. Framework preset: `None`.
  3. Build command: `npm run build`. Build output directory: `dist`.
  4. Em Environment variables, definir: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_AUTH_REDIRECT_URL`, e (opcional) `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`.
  5. Salvar e fazer o primeiro deploy. Cloudflare lê automaticamente `_redirects` e `_headers` do `dist/`.
  6. Configurar domínio custom em Custom domains (ou usar `*.pages.dev`). Atualizar `VITE_AUTH_REDIRECT_URL` e adicionar a nova URL nas Redirect URLs do Supabase Auth.
- **Netlify**:
  1. Conectar o repositório em `app.netlify.com`.
  2. Definir as env vars (mesmas da lista acima).
  3. `Build command`: `npm run build`. `Publish directory`: `dist`. O `netlify.toml` já traz esses valores.
- **GitHub Pages (fallback)**:
  - `deploy.yml` continua publicando em `push` para `main`.
- `vite.config.js` está com `base: '/'` para deploy em domínio customizado.

## Limitações atuais

- Projeto em JavaScript sem tipagem estática.
- Sem suíte E2E.
- Sem política de cobertura mínima no CI.
- Dependência de configuração correta das env vars para recursos Supabase.

## Roadmap técnico (incremental)

1. Introduzir cobertura E2E para fluxos críticos.
2. Definir gate de cobertura no CI.
3. Reduzir tamanho de bundle com code-splitting orientado por rota/feature.
4. Formalizar contratos de dados e validações de entrada.
5. Melhorar segregação de configuração por ambiente (dev/staging/prod).

## Contribuição

Fluxo completo de contribuição (setup, convenções de commit, branches, testes e abertura de PR) está documentado em [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Resumo:

1. Branch a partir de `staging` (`feature/*`, `fix/*`, `chore/*`, `refactor/*`).
2. Commits no padrão Conventional Commits.
3. Rode `npm run check` (format + lint + test + build) antes de abrir PR.
4. PR sempre contra `staging`. Merge `staging → main` é feito pelo mantenedor.
5. Não introduza credenciais reais em código, commits ou exemplos.

## Assets de marca

Logos, lockups e wordmarks oficiais ficam em [`brand/`](./brand) (SVG + PNG, versões horizontal, vertical e monocromática). Consulte antes de usar a identidade do CoolTrack em qualquer material.

## Licença

O CoolTrack Pro é software proprietário. Copyright © 2026 Willian Lopes. Todos os direitos reservados.

Os termos completos — incluindo o que é permitido, o que é proibido, a cláusula de contribuição e o foro aplicável — estão no arquivo [`LICENSE`](./LICENSE). Para uso comercial, licenciamento ou permissões especiais, entre em contato pelo e-mail indicado no arquivo.
