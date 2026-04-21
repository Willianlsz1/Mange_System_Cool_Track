# Stripe setup — CoolTrack PRO

Guia de configuração dos produtos, preços e secrets necessários para os 3 tiers
(Free, Plus, Pro) funcionarem em produção.

## 1. Criar os produtos e preços no Stripe

No Stripe Dashboard → **Produtos**, crie dois produtos:

### Produto: CoolTrack Plus

Preços a cadastrar:

| Nome        | Valor     | Ciclo  | Moeda |
| ----------- | --------- | ------ | ----- |
| Plus Mensal | R$ 29,00  | mensal | BRL   |
| Plus Anual  | R$ 290,00 | anual  | BRL   |

Anote os `price_ids` (formato `price_XXXXXXXXXXXXXX`) — eles vão para os secrets
`STRIPE_PRICE_PLUS` e `STRIPE_PRICE_PLUS_ANNUAL`.

### Produto: CoolTrack Pro

| Nome       | Valor     | Ciclo  | Moeda |
| ---------- | --------- | ------ | ----- |
| Pro Mensal | R$ 99,00  | mensal | BRL   |
| Pro Anual  | R$ 990,00 | anual  | BRL   |

Secrets: `STRIPE_PRICE_PRO` e `STRIPE_PRICE_PRO_ANNUAL`.

## 2. Publicar os secrets nas Edge Functions

Há dois caminhos — escolha um.

### 2a. Pelo Dashboard (mais rápido, não exige CLI)

1. Abra https://supabase.com/dashboard → seu projeto.
2. **Project Settings → Edge Functions → Secrets**.
3. Clique "Add new secret" e cadastre um a um:

```
STRIPE_SECRET_KEY              sk_live_xxx  (ou sk_test_xxx)
STRIPE_WEBHOOK_SIGNING_SECRET  whsec_xxx
STRIPE_PRICE_PRO               price_xxx
STRIPE_PRICE_PRO_ANNUAL        price_xxx
STRIPE_PRICE_PLUS              price_xxx
STRIPE_PRICE_PLUS_ANNUAL       price_xxx
APP_URL                        https://app.cooltrack.pro
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SERVICE_ROLE_KEY` costumam já estar
preenchidos pelo Supabase — só confira se existem.

### 2b. Pelo CLI do Supabase

#### macOS / Linux (bash / zsh)

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxx \
  STRIPE_PRICE_PRO=price_xxx \
  STRIPE_PRICE_PRO_ANNUAL=price_xxx \
  STRIPE_PRICE_PLUS=price_xxx \
  STRIPE_PRICE_PLUS_ANNUAL=price_xxx \
  APP_URL=https://app.cooltrack.pro
```

#### Windows (PowerShell)

A continuação de linha em PowerShell é backtick **`` ` ``**, não **`\`**:

```powershell
supabase secrets set `
  STRIPE_SECRET_KEY=sk_live_xxx `
  STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxx `
  STRIPE_PRICE_PRO=price_xxx `
  STRIPE_PRICE_PRO_ANNUAL=price_xxx `
  STRIPE_PRICE_PLUS=price_xxx `
  STRIPE_PRICE_PLUS_ANNUAL=price_xxx `
  APP_URL=https://app.cooltrack.pro
```

Não tem o CLI no Windows? Instale via Scoop (o pacote `supabase` no npm foi
descontinuado):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

supabase login
supabase link --project-ref SEU_PROJECT_REF
```

Secrets **obrigatórios**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`,
`STRIPE_PRICE_PRO`, `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SERVICE_ROLE_KEY`.

Secrets **opcionais** (com fallback gracioso): `STRIPE_PRICE_PRO_ANNUAL`,
`STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PLUS_ANNUAL`. Se um desses não estiver
setado, `create-checkout-session` cai na cadeia de fallback:

- `plus_annual` → `plus` → `pro_annual` → `pro`
- `plus` → `pro`
- `pro_annual` → `pro`

Isso garante que a Edge Function nunca 500 por falta de preço cadastrado, mas o
ideal é cadastrar os 4 price_ids antes de liberar o Plus para o público.

## 3. Configurar o webhook do Stripe

No Dashboard Stripe → **Desenvolvedores → Webhooks**, crie um endpoint
apontando para:

```
https://<project>.supabase.co/functions/v1/stripe-webhook
```

Eventos que a função processa:

- `checkout.session.completed` — grava plan_code + stripe_subscription_id em profiles
- `customer.subscription.updated` — refaz plan_code/status quando o usuário
  troca de tier pelo portal (upgrade Plus → Pro, etc.)
- `customer.subscription.deleted` — volta para Free + status 'canceled'
- `invoice.paid` — reafirma status 'active'
- `invoice.payment_failed` — marca status 'past_due'

O webhook determina o `plan_code` em ordem de precedência:

1. `session.metadata.resolved_plan` (gravado pela `create-checkout-session`)
2. `session.metadata.requested_plan`
3. price*id dos items da subscription (map construído a partir dos envs
   `STRIPE_PRICE*\*`)
4. fallback defensivo: `'pro'`

### Event ordering

Retries atrasados de `customer.subscription.updated` podem chegar **depois** de
um evento mais recente ter sido processado. O payload do event é um snapshot
do estado da subscription no momento em que o evento foi criado, então usar
o snapshot de um event velho causaria downgrade silencioso (ex: retry atrasado
de "plan_code=plus" sobrescrevendo um "plan_code=pro" já gravado).

Fix: o handler re-busca a subscription via `stripe.subscriptions.retrieve()`
antes de aplicar mudanças, usando o estado live. Se a API do Stripe falhar,
caímos no payload do event como fallback e logamos `subscription_refetch_failed`
para audit. Eventos `customer.subscription.deleted` não precisam do re-fetch
porque o próprio evento é autoritativo — Stripe não "undelete" subscriptions.

### Idempotência

Stripe pode reenviar o mesmo `event.id` várias vezes — quando o endpoint demora

> 10s, retorna 5xx, ou quando a Edge Function é redeployada durante um retry em
> vôo. O handler guarda cada evento processado na tabela
> `public.stripe_webhook_events` (migration `20260420160000`) e usa o `event_id`
> como PK. Antes de qualquer UPDATE em `profiles`:

1. `INSERT INTO stripe_webhook_events (event_id, event_type)` — PK
   serializa retries concorrentes.
2. Se o INSERT falha com `23505` (unique violation), é retry → responde
   `200 OK` com `{ "received": true, "duplicate": true }` sem reprocessar.
3. Se o INSERT falha com qualquer outro erro de DB, responde `500` pro Stripe
   reagendar.
4. Se o INSERT passa, processa o evento; ao sucesso, popula `processed_at`
   e metadata (`user_id`, `customer_id`, `subscription_id`) na linha.
5. Se o processamento joga exceção, `error_message` é gravado e o status
   HTTP volta 500. A linha **não** é removida — retries futuros do mesmo
   event.id vão bater no `23505` e responder 200, mas o campo
   `error_message` fica lá pra audit e pode ser investigado manualmente.

Para consultar eventos falhados:

```sql
select event_id, event_type, received_at, error_message
from public.stripe_webhook_events
where error_message is not null
order by received_at desc
limit 20;
```

Para confirmar que duplicates estão sendo descartados (depois de fazer algum
retry manual):

```sql
-- Quantos eventos foram recebidos mas ainda não processaram?
-- (Esperado: 0 em operação normal.)
select count(*) from public.stripe_webhook_events
where processed_at is null and error_message is null
  and received_at < now() - interval '5 minutes';
```

## 4. Deploy das funções

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

## 5. Smoke test

1. Abra a tela de Planos no app (logado).
2. No card Plus, com toggle em "Mensal", clique "Assinar Plus →" e complete o
   checkout em modo Stripe Test.
3. Confirme no Supabase SQL Editor:
   ```sql
   select id, plan_code, subscription_status, stripe_subscription_id
   from profiles where id = auth.uid();
   ```
   Deve retornar `plan_code='plus'`, `subscription_status='active'`.
4. Repita com toggle em "Anual" — o checkout deve redirecionar para o preço
   anual e o resultado final no banco é o mesmo (`plus`), só muda o ciclo do
   Stripe.
5. Abra o portal de cobrança, troque o plano para Pro Mensal, e confirme que
   `plan_code` virou `'pro'` via o evento `customer.subscription.updated`.
6. **Teste idempotência**: no Stripe Dashboard → Webhooks → clique num evento
   já entregue e use "Resend". Depois confira:
   ```sql
   select event_id, event_type, processed_at, customer_id, user_id
   from public.stripe_webhook_events
   where event_id = 'evt_XXX'; -- id do evento reenviado
   ```
   Deve existir **uma única linha** com `processed_at` preenchido. O resend não
   cria duplicata (PK bloqueia) nem atualiza o profile de novo (o handler
   responde 200 com `{"duplicate": true}` antes de tocar em `profiles`).
