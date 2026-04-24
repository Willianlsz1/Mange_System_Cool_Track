# CoolTrack Pro — Runbook Operacional

Guia rápido para o operador solo (Willian) resolver incidentes, monitorar o app
e configurar infraestrutura que precisa de passos manuais fora do repositório.

## Uptime monitoring

### URLs a monitorar (check a cada 5min)

- **Produção (frontend, GitHub Pages)**: https://willianlsz1.github.io/Cool_Track_Pro/
- **Supabase REST API**: `<VITE_SUPABASE_URL>/rest/v1/` — GET retorna 401 OK (basta não ser 5xx)

### Setup pendente (Willian executa manualmente)

1. Criar conta grátis em https://uptimerobot.com (50 monitores, 5min interval no plano Free).
2. Adicionar os 2 monitores acima:
   - Type: HTTP(s)
   - Interval: 5 minutes
   - Aceitar status 200 (frontend) e 401 (Supabase REST, significa auth ativo).
3. Configurar canal de alerta:
   - **Telegram (grátis, recomendado)**: criar bot via [@BotFather](https://t.me/BotFather), pegar o token, adicionar em UptimeRobot → My Settings → Alert Contacts → Telegram.
   - **WhatsApp (alternativa)**: usar [Callmebot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) — precisa integrar via webhook custom no UptimeRobot.
4. Testar: pausar manualmente um monitor em UptimeRobot, alterar a URL pra algo inválido, confirmar que chega notificação em ≤ 6min.

### Próximos passos (pós-beta, backlog)

- Adicionar monitor no endpoint `/auth/v1/health` do Supabase (responde 200 OK).
- Integrar alertas do UptimeRobot com Sentry como breadcrumbs (webhook → Sentry event).
- Aumentar intervalo pra 1min se migrar pro plano pago.

## Deploy / GitHub Actions

### Environment gate `production`

O workflow `.github/workflows/deploy.yml` agora usa `environment: production` no
job de deploy. **Sozinho isso não bloqueia nada** — é só um rótulo. Pra ativar
o gate manual, o Willian precisa configurar no painel do GitHub:

1. Repo → Settings → Environments.
2. Se não existir, clicar **New environment** → nome `production`.
3. Marcar **Required reviewers** → adicionar o próprio Willian como reviewer.
4. Salvar.

A partir disso, todo deploy no `main` fica pendente na aba Actions esperando
aprovação manual antes de publicar.

### Rollback rápido (quando tiver, fica em ROLLBACK.md)

(Conteúdo a escrever no Dia 6 do plano de auditoria.)

## Secrets/envs em uso

Os seguintes secrets precisam estar configurados em GitHub → Settings →
Secrets and variables → Actions:

- `VITE_SUPABASE_URL` — URL do projeto Supabase.
- `VITE_SUPABASE_KEY` — chave anon/public (NUNCA service_role).

Envs opcionais (se usar Sentry / EmailJS):

- `VITE_SENTRY_DSN` — DSN do projeto Sentry.
- `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`.

Ver `.env.example` pra referência completa.
