# Tier Restrictions Audit — 2026-04-21

Auditoria feita em cima do caso reportado ("cadastro por foto IA como Free,
consegui cadastrar 2 vezes"), expandida pra todas as funcionalidades com
restrição de plano do CoolTrack.

## TL;DR — Root cause do "Free 2x na placa"

**Você não era Free no servidor.** Quase certo que o bypass experimentado foi
um artefato de dev, não uma falha real. Duas causas prováveis, provavelmente
as duas combinadas:

1. **Seu perfil tem `is_dev=true`** (ou o override local em
   `cooltrack-dev-plan-override=free` está ligado). O `DevPlanOverride` só
   afeta o client — a edge function `analyze-nameplate` e os triggers do
   Postgres leem o `plan_code` **real** do `profiles`. Se o real é `pro` ou
   `plus`, o servidor libera, não importa o que o toggle do F12 diz.
2. **A migration `20260421130000_nameplate_analysis_quota.sql` é untracked**
   (`git status` confirma). Se ela nunca foi aplicada no DB, a RPC
   `increment_monthly_usage` rejeita `nameplate_analysis` com
   `invalid resource`, a edge function engole o erro (`return null`), e o
   counter nunca sobe. Mesmo com meu código C4 rodando, o loop é:
   `loadMonthlyUsed=0 → quota passa → incrementa (falha silent) → próximo
pedido acha 0 de novo`. Free vira de fato **ilimitado**.

Os dois precisam ser endereçados antes do deploy — detalhes no Fix Plan.

---

## Inventário completo de gates por feature

| Feature                          | Quem é restrito                        | Tipo de limite         | Gate cliente                                                               | Gate servidor                                                 | Gate no DB                                                                                                                      | Risco                                                                          |
| -------------------------------- | -------------------------------------- | ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Análise de placa (IA)**        | Free 1/mês · Plus 30/mês · Pro 200/mês | Cota mensal            | `applyNameplateCtaGate` em `nameplateCapture.js`                           | Edge function `analyze-nameplate/index.ts` (C4 — uncommitted) | RPC `increment_monthly_usage` (migration `20260421130000` — **UNTRACKED**)                                                      | 🔴 Alto — migration não deployada                                              |
| **Exportar PDF**                 | Free 2/mês · Plus 30/mês · Pro ∞       | Cota mensal            | `ensureReportBudget` em `reportExportHandlers.js:85-144`                   | Nenhum (PDF é gerado 100% no browser)                         | RPC `increment_monthly_usage` chamada **depois** da geração                                                                     | 🟡 Médio — bypass via F12 possível, mas não custa USD                          |
| **Compartilhar WhatsApp**        | Free 3/mês · Plus 20/mês · Pro ∞       | Cota mensal            | `bindWhatsAppExport` em `reportExportHandlers.js:194-294`                  | Nenhum (abre `wa.me` no navegador)                            | RPC `increment_monthly_usage` depois do confirm                                                                                 | 🟡 Médio — bypass só diminui pressão de upsell                                 |
| **Fotos de equipamento**         | Só Plus+ (binário)                     | On/off                 | `applyEquipPhotosGate` + `applyEquipPhotosEditorGate`                      | Nenhuma edge function                                         | **Trigger** `enforce_photo_plan_gate` + **Storage policy** `equipamento_fotos_require_plus_insert` (migration `20260420130000`) | 🟢 Baixo — defesa em profundidade                                              |
| **Setores (agrupamento)**        | Só Pro (binário)                       | On/off                 | `hasProAccess()` esconde UI                                                | Nenhuma edge function                                         | **Trigger** `enforce_setores_pro_gate` em INSERT/UPDATE (migration `20260420140000`)                                            | 🟢 Baixo                                                                       |
| **Assinatura digital no PDF**    | Só Plus+                               | Flag de feature        | `hasFeature(profile, FEATURE_DIGITAL_SIGNATURE)` em `subscriptionPlans.js` | Nenhum (PDF local)                                            | Nenhuma constraint                                                                                                              | 🟡 Médio — flag só no cliente, mas é rendering local (não cria risco de dados) |
| **Contagem de equipamentos**     | Free 3 · Plus 15 · Pro ∞               | Limite duro            | `canCreateEquipment()` em `subscriptionPlans.js:215-223`                   | —                                                             | **Trigger** `enforce_equipamentos_limit` (migration `20260420150000`). `is_dev=true` **bypassa**                                | 🟢 Baixo — mas `is_dev` fura no DB                                             |
| **Registros mensais (Free)**     | Free 5/mês · Plus/Pro ∞                | Limite duro mensal     | `countRegistrosThisMonth` em `guestLimits.js:22-30`                        | —                                                             | **Trigger** `enforce_registros_monthly_limit` (migration `20260420150000`). `is_dev=true` **bypassa**                           | 🟢 Baixo — mesma nota do `is_dev`                                              |
| **Histórico filtrado por dias**  | Free 15 dias · Plus/Pro ∞              | Janela de visualização | Filtro em `historico.js` no render                                         | —                                                             | Nenhuma RLS que bloqueie fetch de registros antigos                                                                             | 🔴 Alto — filtro 100% cliente, user com F12 vê tudo                            |
| **Histórico completo (feature)** | Só Plus+ (binário)                     | Flag de feature        | `hasFeature()` em `subscriptionPlans.js`                                   | —                                                             | Nenhum                                                                                                                          | 🟡 Médio — SDK direto ignora o gate                                            |

---

## Falhas por severidade

### 🔴 Críticas (tem que arrumar antes do rollout)

#### 1. Migration `nameplate_analysis_quota` nunca foi commitada nem aplicada

- **Arquivo**: `supabase/migrations/20260421130000_nameplate_analysis_quota.sql`
  (untracked em `git status`).
- **Sintoma**: com o C4 deployado **sem** essa migration, a RPC
  `increment_monthly_usage` rejeita `nameplate_analysis` com
  `invalid resource`. O edge function engole o erro (`return null` em
  `incrementMonthlyUsage`) e continua respondendo `ok: true` pro client.
  Counter nunca sobe → cota Free=1/mês é de fato ∞.
- **Por que passou despercebido**: o handler de erro em
  `analyze-nameplate/index.ts` é "best effort — não queremos quebrar a resposta
  principal por falha de telemetria". Em produção isso é certo, mas aqui o
  increment **não é telemetria**: é parte do gate. Se falha, o gate vaza.
- **Fix**:
  1. `git add supabase/migrations/20260421130000_nameplate_analysis_quota.sql supabase/migrations/20260421140000_ai_usage_cost.sql`
  2. `supabase db push` (ou via Dashboard SQL editor) no ambiente alvo.
  3. Commit + push pro repo pra não ficar divergente.
  4. **Só depois**: `supabase functions deploy analyze-nameplate`.
- **Sugestão adicional de hardening**: trocar o `return null` do
  `incrementMonthlyUsage` por uma resposta de erro explícita que o client
  trata (ex: `QUOTA_TRACKING_FAILED`) — ou pelo menos adicionar um
  `console.error` nível `alert` pra você notar no log se alguma vez
  acontecer em prod.

#### 2. Histórico: filtro de "15 dias" é 100% cliente

- **Arquivo**: `src/ui/views/historico.js` (e o render da timeline).
- **Sintoma**: Free só enxerga 15 dias no UI, mas o fetch do Supabase
  devolve **todos** os registros (RLS só filtra por owner). Um user
  entendendo do produto só precisa abrir F12 e ler o `state.registros`
  que tem o histórico completo.
- **Impacto**: baixo risco técnico (não custa dinheiro), mas alto risco
  comercial — o funil Plus perde um diferencial chave.
- **Fix** (sem migration nova):
  - Filtrar por `created_at` na **query** do fetch quando o plano é Free:
    `.gte('created_at', cutoffIso)`. Nada de puxar tudo e filtrar depois.
  - Redundar com uma view ou RLS policy (`historico_full_access`) se
    quisermos defesa em profundidade — mas a query-side filter já fecha
    o caso prático.

### 🟡 Altas (endereçar em seguida)

#### 3. Dev mode é UI-only, causa falsos positivos no seu próprio teste

- **Sintoma**: `DevPlanOverride` troca o plano no client, mas o servidor vê o
  `plan_code` real (o seu perfil é provavelmente `pro` + `is_dev=true` em prod).
  Resultado: você testa "como Free" mas o server trata como Pro. Gate nunca
  bate, não porque está quebrado, mas porque não era pra bater.
- **Fix** (pragmático, sem inventar coisa nova):
  - Passa um header `X-Dev-Plan-Override: free` da `analyzeNameplate` quando
    `DevPlanOverride.get()` está setado. A edge function só respeita esse
    header se o perfil do caller tem `is_dev=true`. Então em prod ninguém
    consegue forçar plano, mas o seu teste passa a simular Free de ponta a
    ponta.
  - Alternativa barata: documentar no README que pra testar gates como Free,
    é preciso um **segundo usuário** sem `is_dev=true`, não o override local.

#### 4. Gates PDF/WhatsApp: incremento é `post-action` e dá pra burlar no cliente

- **Sintoma**: `ensureReportBudget` chama `hasReachedMonthlyLimit` **antes** de
  gerar o PDF. Um user com F12 consegue:
  1. Setar `usedCount=0` no objeto do snapshot antes da checagem.
  2. Gerar PDFs/WhatsApps ilimitados.
  3. O increment RPC roda normalmente, mas como o check era cliente, o
     próximo check também vai ser cliente, e a chave está no patch do F12.
- **Mitigação atual aceitável**: PDF e WhatsApp são grátis de servir (geração
  no browser, `wa.me` abre o app). O dano é zero em custo, médio em funil.
- **Fix opcional** (defesa em profundidade): criar uma função
  `check_monthly_quota(resource)` em SQL `security definer` que retorna
  `{used, limit, exhausted}` baseado no `plan_code` real do caller. Chamar do
  client ANTES de gerar. O bypass F12 pararia de funcionar.

### 🟢 Médias / baixas (conhecidos, aceitos)

- **`is_dev=true` bypassa triggers `equipamentos_limit` e
  `registros_monthly_limit`**: intencional (migration comenta explicitamente
  "coerente com getEffectivePlan"). Mantém comportamento, só não esquecer
  de desligar `is_dev` em qualquer conta não-pessoal antes de demonstrar.
- **Assinatura digital no PDF é só flag cliente**: PDF roda 100% local, o
  pior que acontece é o user usar recurso sem assinar o plano — não há
  custo nem vazamento. Suficiente por enquanto.
- **Histórico completo (feature)**: fetch puxa tudo, flag esconde.
  Mesmo risco do item 2, mas menor escopo. Fix junto com o item 2
  (query-side filter por `created_at`).

---

## Fix plan priorizado

| #   | O que                                                                                                           | Esforço | Urgência                               |
| --- | --------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------- |
| 1   | Commitar as duas migrations untracked + `supabase db push`                                                      | 5 min   | 🔴 antes de qualquer deploy            |
| 2   | Deploy do `analyze-nameplate` (edge function)                                                                   | 2 min   | 🔴 depois do item 1                    |
| 3   | Tornar `incrementMonthlyUsage` da edge function "loud" em falha (log `console.error` e/ou fail-closed pra Free) | 15 min  | 🟠 antes do próximo rollout            |
| 4   | Histórico Free: filtrar `created_at >= cutoff` na query, não no render                                          | 30 min  | 🟠 mesmo ciclo                         |
| 5   | Header `X-Dev-Plan-Override` respeitado quando `is_dev=true` no profile                                         | 30 min  | 🟡 opcional, melhora workflow de teste |
| 6   | `check_monthly_quota` RPC (defesa em profundidade pra PDF/WhatsApp)                                             | 1-2 h   | 🟡 nice-to-have                        |

---

## Como reproduzir o caso do nameplate pra validar o fix

1. Crie um **segundo** Supabase user com `plan_code='free'`,
   `subscription_status='inactive'`, `is_dev=false`. Isso é crucial — sua
   conta principal provavelmente tem `is_dev=true` e não serve.
2. Aplique a migration `20260421130000` no ambiente-alvo (staging ou dev).
3. Deploy do `analyze-nameplate`.
4. Com o user Free, faça uma análise. Deveria funcionar (consome o trial
   de 1/mês).
5. Segunda tentativa **deve bater** `PLAN_GATE_FREE` com
   `quota_exhausted=true, monthly_limit=1, used=1`.
6. Inspect o `usage_monthly` em SQL: deve ter 1 linha
   `(user_id, '2026-04-01', 'nameplate_analysis', 1)`.

Se a segunda tentativa passar, é sinal de que o increment falhou silent
(voltamos pro item 3 do fix plan).
