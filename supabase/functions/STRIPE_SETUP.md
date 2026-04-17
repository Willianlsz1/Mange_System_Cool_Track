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
