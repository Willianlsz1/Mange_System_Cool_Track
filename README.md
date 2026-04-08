# CoolTrack Pro

Aplicação web (SPA) para gestão de manutenção de equipamentos HVAC.

> Escopo atual: front-end em JavaScript com persistência local (offline-first) e sincronização/autenticação via Supabase.

## Visão geral do produto

O sistema cobre fluxos de operação técnica:

- cadastro de equipamentos;
- registro de manutenções preventivas/corretivas;
- visualização de dashboard, histórico, alertas e relatórios.

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

- `deploy.yml` publica no GitHub Pages em `push` para `main`.
- O `vite.config.js` usa `base: '/Mange_System_Cool_Track/'`, portanto o build está acoplado ao path atual do repositório no Pages.

## Limitações atuais

- Projeto em JavaScript sem tipagem estática.
- Sem suíte E2E.
- Sem política de cobertura mínima no CI.
- Base path de deploy fixo no Vite.
- Dependência de configuração correta das env vars para recursos Supabase.

## Roadmap técnico (incremental)

1. Introduzir cobertura E2E para fluxos críticos.
2. Definir gate de cobertura no CI.
3. Reduzir tamanho de bundle com code-splitting orientado por rota/feature.
4. Formalizar contratos de dados e validações de entrada.
5. Melhorar segregação de configuração por ambiente (dev/staging/prod).

## Contribuição

1. Mantenha mudanças focadas e com contexto técnico no PR.
2. Atualize testes quando alterar comportamento.
3. Não introduza credenciais reais em código, commits ou exemplos.
4. Garanta `lint`, `test` e `build` antes de abrir PR.
