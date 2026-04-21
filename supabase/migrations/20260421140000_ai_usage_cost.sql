-- CoolTrack Pro — Telemetria de custo por chamada de IA.
--
-- Cada análise de placa (e futuramente outros recursos de IA) consome tokens
-- na API da Anthropic, faturados em USD. O app cobra em BRL. Sem telemetria
-- de custo a gente fica cego pra margem real por tier e por usuário — o que é
-- justamente o problema que a decisão de cota mensal (Plus 30/mês, Pro 200/mês)
-- veio mitigar.
--
-- Esta tabela registra 1 linha por chamada à IA (bem-sucedida ou não), com:
--   - input_tokens / output_tokens crus (vindos da response do provider)
--   - cost_usd calculado na edge function a partir da pricing table do modelo
--   - model (ex: 'claude-sonnet-4-6') pra futura comparação entre modelos
--   - resource (ex: 'nameplate_analysis') pra agrupar por feature
--   - success — distinguir chamadas úteis de falhas (tokens ainda gastos em
--     falhas do nosso lado, mas não no upstream)
--
-- RLS:
--   - insert só via service_role (a edge function usa service_role).
--   - select: usuário vê só as próprias linhas (útil pra futuro dashboard de
--     uso pessoal). Dashboard admin global sai via service_role no servidor.

create table if not exists public.ai_usage_cost (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  resource text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  success boolean not null default true,

  constraint ai_usage_cost_resource_check
    check (resource in ('nameplate_analysis')),
  constraint ai_usage_cost_tokens_nonneg
    check (input_tokens >= 0 and output_tokens >= 0),
  constraint ai_usage_cost_cost_nonneg
    check (cost_usd >= 0)
);

create index if not exists ai_usage_cost_user_id_created_at_idx
  on public.ai_usage_cost (user_id, created_at desc);

create index if not exists ai_usage_cost_resource_created_at_idx
  on public.ai_usage_cost (resource, created_at desc);

alter table public.ai_usage_cost enable row level security;

-- Usuários veem só o próprio histórico de custo.
drop policy if exists ai_usage_cost_select_own on public.ai_usage_cost;
create policy ai_usage_cost_select_own
  on public.ai_usage_cost
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Insert vem exclusivamente do service_role (edge function). Não criamos
-- policy pra authenticated — o default (deny) é o comportamento desejado.

comment on table public.ai_usage_cost is
  'Uma linha por chamada a um provider de IA. Usada pra medir margem real por usuário/tier e detectar cauda longa de custo.';
comment on column public.ai_usage_cost.cost_usd is
  'Custo em USD calculado a partir de input_tokens/output_tokens × pricing do modelo no momento da chamada.';
comment on column public.ai_usage_cost.success is
  'false quando a análise falhou mesmo tendo consumido tokens upstream (raro).';
