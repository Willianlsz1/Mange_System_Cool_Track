# Contribuindo com o CoolTrack Pro

Obrigado pelo interesse em contribuir. Este guia cobre o setup local, o fluxo de desenvolvimento e as convenções que mantemos no repositório.

> **Licença**: o CoolTrack Pro é software proprietário. Contribuições externas são aceitas sob as condições descritas na seção 5 do arquivo [LICENSE](./LICENSE) — ao abrir um PR você concorda em transferir os direitos daquele trecho ao detentor do copyright.

## Setup local

**Pré-requisitos**

- Node.js **20+**
- npm **10+**

**Instalação**

```bash
git clone https://github.com/Willianlsz1/Cool_Track_Pro.git
cd Cool_Track_Pro
npm ci
cp .env.example .env.local
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_KEY (anon key)
npm run dev
```

### Desenvolvimento cross-platform (Windows, macOS, Linux)

O Vite usa `rollup`, que tem binários nativos diferentes por plataforma (`win32-x64`, `linux-x64`, `darwin-arm64`, `darwin-x64`). Pra evitar o bug [npm/cli#4828](https://github.com/npm/cli/issues/4828) — onde um `package-lock.json` gerado numa plataforma não baixa os binários das outras — o `package.json` declara as quatro plataformas principais em `optionalDependencies`. Cada ambiente baixa só o binário compatível com o seu OS/arch.

Se você tiver que trocar de máquina (ex.: dev em Windows, CI/sandbox em Linux) e der erro do tipo `Cannot find module @rollup/rollup-<plataforma>`, faça reset limpo do `node_modules`:

```bash
rm -rf node_modules package-lock.json
npm install
```

Não commite um `package-lock.json` gerado com `npm install --no-save` ou instalações pontuais de binários de outra plataforma — isso suja o lockfile e quebra o time.

## Fluxo de branches

- `main` — branch de produção. Só recebe merge via Pull Request vindo de `staging`.
- `staging` — integração contínua. Recebe PRs de branches de feature.
- `feature/*`, `fix/*`, `chore/*`, `refactor/*` — branches curtas por tarefa, sempre a partir de `staging`.

```text
feature/minha-tarefa  →  staging  →  main
```

**Nunca** commite direto em `main` ou `staging`. Abra PR.

## Convenção de commits

Seguimos Conventional Commits com escopo opcional:

```
<tipo>(<escopo opcional>): <descrição curta em minúsculas>
```

**Tipos aceitos:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`.

Exemplos:

```
feat(tour): tour de 6 slides com score de risco dedicado
fix(auth): accountModal lê plano do Supabase em vez do Profile local
chore: pre-demo polish
refactor(charts): encapsular Chart.defaults em factory scoped
```

Dicas:

- Mensagem curta na primeira linha (≤ 72 caracteres). Detalhes no corpo.
- Um commit por mudança coerente. Commits gigantes e misturados são difíceis de revisar e reverter.
- Nunca commite `.env.local`, chaves, keystores ou segredos. A `.gitignore` protege os casos comuns, mas revise com `git status` antes de commitar.

## Gate de qualidade

Antes de abrir PR, rode localmente:

```bash
npm run check
```

Esse comando equivale a `format:check + lint + test + build`. Tudo precisa passar. Se o Prettier reclamar, corrija com `npm run format`.

Scripts individuais:

| Comando                 | O que faz                                          |
| ----------------------- | -------------------------------------------------- |
| `npm run dev`           | Sobe o Vite dev server em `http://localhost:5173`. |
| `npm run build`         | Gera o bundle de produção em `dist/`.              |
| `npm run preview`       | Serve o bundle de produção localmente.             |
| `npm run lint`          | ESLint em `src/`.                                  |
| `npm run lint:fix`      | ESLint com autofix.                                |
| `npm run format`        | Prettier `--write` em tudo.                        |
| `npm run format:check`  | Prettier em modo verificação (o que o CI roda).    |
| `npm run test`          | Vitest em modo CI (247 testes no baseline atual).  |
| `npm run test:watch`    | Vitest em watch.                                   |
| `npm run test:coverage` | Cobertura com provider V8.                         |
| `npm run check`         | Gate completo: format:check + lint + test + build. |

## Testes

- Testes ficam em `src/__tests__/` (Vitest + jsdom).
- Novos comportamentos exigem teste correspondente — se você mudou a lógica de score, tour ou auth sem tocar num `*.test.js`, é quase certo que está faltando cobertura.
- Mocks ficam inline em cada arquivo de teste via `vi.mock()`. Evite mutar `globalThis` sem limpar depois.
- Snapshots estáveis vêm do `describe('X > ...')` — use `beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); })` em testes de UI.

## Estrutura de pastas (o que vai onde)

```text
src/
  __tests__/         # Testes Vitest
  assets/styles/     # CSS (globais + componentes tokenizados)
  core/              # Infra transversal (auth, storage, telemetry, router, etc.)
  domain/            # Regras de negócio puras (maintenance, priorityEngine, pdf)
  features/          # Módulos isolados
  ui/
    components/      # Modais, toasts, tour, landing, etc.
    controller/      # Handlers e helpers que orquestram as views
    shell/           # Templates de shell (header, nav, modais globais)
    views/           # Telas (dashboard, equipamentos, historico, etc.)
  app.js             # Boot: sessão, router, controller
```

**Regra prática:**

- Lógica de negócio pura (sem DOM, sem Supabase) → `domain/`.
- Serviço que fala com mundo externo (fetch, localStorage, Chart.js) → `core/`.
- Render/interação → `ui/`.

## Abrindo Pull Request

1. Crie a branch a partir de `staging`:
   ```bash
   git checkout staging && git pull
   git checkout -b feature/minha-tarefa
   ```
2. Commite em passos pequenos seguindo a convenção acima.
3. Rode `npm run check` e corrija o que falhar.
4. Push e abra PR **contra `staging`**:
   ```bash
   git push -u origin feature/minha-tarefa
   gh pr create --base staging
   ```
5. No corpo do PR explique: **o que mudou**, **por que**, e **como testar**. Screenshots para mudanças de UI ajudam muito.
6. Aguarde o CI (lint + test + build). Se o CI falhar, corrija antes de pedir review.

O merge `staging → main` é feito pelo mantenedor em janelas de release.

## Segurança

- **Nunca** use a chave `service_role` do Supabase no frontend. Só a `anon` vai em `VITE_SUPABASE_KEY`.
- Credenciais ficam em `.env.local` (gitignored) em dev, e nos **GitHub Actions Secrets** em produção.
- Reportou uma vulnerabilidade? Abra issue com label `security` **ou** mande email direto pra `willianloopes123@gmail.com` se for sensível.

## Dúvidas

Abra issue com label `question` ou mande mensagem direto pro mantenedor.
