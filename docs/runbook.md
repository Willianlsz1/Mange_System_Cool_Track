# CoolTrack Pro — Runbook Operacional

Guia rápido para o operador solo (Willian) resolver incidentes, monitorar o app
e configurar infraestrutura que precisa de passos manuais fora do repositório.

## Deploy (Cloudflare Pages)

O deploy de produção é feito automaticamente pela **Cloudflare Pages**, via
integração direta com este repositório. Cada `push` para `main` dispara um
build na Cloudflare; não há workflow do GitHub Actions publicando nada.

URL de produção: https://cool-track-pro.pages.dev

### Setup obrigatório no painel Cloudflare (Willian)

Painel Cloudflare → Workers & Pages → `cool-track-pro` → Settings.

- [ ] **Environment variables** (Production): `VITE_SUPABASE_URL`,
      `VITE_SUPABASE_KEY`, `VITE_AUTH_REDIRECT_URL`. Sem elas o build passa
      mas o app quebra em runtime com "Missing required environment variable".
- [ ] **Build settings**: Build command `npm run build`; Build output `dist`;
      Root directory em branco; Framework preset `None`.
- [ ] **Preview deployments**: decide se PRs viram preview público (default) ou
      exigem senha (Settings → General → Access policy).

### Rollback rápido (Cloudflare guarda os últimos 20 deploys)

1. Painel Cloudflare → `cool-track-pro` → **Deployments**.
2. Encontrar o deploy anterior que funcionava.
3. Menu `...` → **Rollback to this deployment**.
4. Cloudflare promove aquele build pro production alias. Leva ~15s.

Se o problema estiver em env var e não no código, rollback não resolve —
precisa corrigir a env var em Settings e re-deployar (Deployments →
**Retry deployment** no último commit).

### CI (GitHub Actions)

`.github/workflows/ci.yml` roda lint + format + test + build no push/PR
contra `main` como gate de qualidade. **Não faz deploy.** Serve pra falhar
antes da Cloudflare gastar build time com código quebrado.

## Uptime monitoring

### URLs a monitorar (check a cada 5min)

- **Produção (frontend, Cloudflare Pages)**: https://cool-track-pro.pages.dev/
- **Supabase Auth health**: `<VITE_SUPABASE_URL>/auth/v1/health` — retorna 200 OK
  com JSON do GoTrue quando o projeto aceita health sem apikey.
- **Supabase REST (fallback)**: `<VITE_SUPABASE_URL>/rest/v1/` — retorna 401 sem
  apikey. Use esta URL com "Expected 401" se o `/auth/v1/health` exigir header
  `apikey` (plano Free do UptimeRobot não suporta custom headers).

### Setup pendente (Willian executa manualmente)

1. Criar conta grátis em https://uptimerobot.com (50 monitores, 5min interval
   no plano Free).
2. Adicionar os monitores acima:
   - Type: HTTP(s)
   - Interval: 5 minutes
   - Aceitar status 200 (frontend + auth health) ou 401 (REST fallback).
3. Configurar canal de alerta:
   - **Telegram (grátis, recomendado)**: criar bot via
     [@BotFather](https://t.me/BotFather), pegar o token, adicionar em
     UptimeRobot → My Settings → Alert Contacts → Telegram.
   - **WhatsApp (alternativa)**: usar
     [Callmebot](https://www.callmebot.com/blog/free-api-whatsapp-messages/).
4. Testar: pausar manualmente um monitor em UptimeRobot, alterar a URL pra
   algo inválido, confirmar que chega notificação em ≤ 6min.

### Próximos passos (pós-beta, backlog)

- Integrar alertas do UptimeRobot com Sentry como breadcrumbs.
- Aumentar intervalo pra 1min se migrar pro plano pago.

## Secrets/envs em uso

### Cloudflare Pages (Production) — CRÍTICO

Fonte de verdade do deploy real. Sem estas env vars, o build compila mas o
app falha em runtime.

- `VITE_SUPABASE_URL` — URL do projeto Supabase.
- `VITE_SUPABASE_KEY` — chave anon/public (NUNCA service_role).
- `VITE_AUTH_REDIRECT_URL` — URL absoluta de produção (para OAuth + password
  reset). Deve bater com as Redirect URLs configuradas no Supabase Auth.

Envs opcionais:

- `VITE_SENTRY_DSN` — DSN do projeto Sentry (observabilidade).
- `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`,
  `VITE_EMAILJS_PUBLIC_KEY` — notificação de feedback por e-mail.

### GitHub Actions (CI only)

Precisam estar em Settings → Secrets and variables → Actions, mas **só são
usados pra rodar `npm run check` e `npm run build` como gate de CI** — não
afetam o que vai pro ar.

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`.

Ver `.env.example` pra referência completa.
