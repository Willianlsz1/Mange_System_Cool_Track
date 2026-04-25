-- ============================================================
-- PMOC Fase 1 — Clientes + Empresa responsável
-- Date: 2026-04-25
--
-- Contexto:
--   Pra gerar relatório PMOC (Lei 13.589/2018, NBR 13971) precisamos de:
--     1. Empresa do prestador com razao social, CNPJ, IE, IM
--     2. Cliente como entidade própria (multi-cliente por técnico)
--     3. Equipamento vinculado a cliente (opcional — equip antigo
--        não exige migração obrigatória; vincula sob demanda)
--
--   Esta migration cria a base SEM gate de plano. Gate Pro será
--   aplicado na geração do PDF PMOC (Fase 4), permitindo Free/Plus
--   organizarem por cliente desde já — vira upsell natural depois
--   ("você tem 5 clientes, gere relatórios PMOC com Pro").
--
-- Escopo:
--   - public.profiles: 4 campos novos (razao_social, cnpj, ie, im)
--   - public.clientes: tabela nova multi-tenant com RLS
--   - public.equipamentos: cliente_id FK opcional
--
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- e DO blocks pra policies.
-- ============================================================

-- ─── 1. PROFILES ────────────────────────────────────────────
-- Empresa responsável (PMOC §3º exige identificação jurídica
-- de quem assina a manutenção).
alter table public.profiles
  add column if not exists razao_social text,
  add column if not exists cnpj text,
  add column if not exists inscricao_estadual text,
  add column if not exists inscricao_municipal text;

-- Índice em CNPJ não é necessário (1 user = 1 profile).


-- ─── 2. CLIENTES ────────────────────────────────────────────
-- Multi-cliente por técnico. Padrão multi-tenant: user_id FK +
-- RLS com auth.uid() = user_id em todas as policies.
create table if not exists public.clientes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  -- Nome de fantasia (pra exibir na UI). Obrigatório.
  nome                  text not null,
  -- Razão social (pra documento legal). Opcional — técnico pode
  -- ter cliente PF (família, condomínio sem CNPJ).
  razao_social          text,
  -- CNPJ ou CPF (texto livre — validação no frontend pra não
  -- bloquear edge cases tipo cliente PJ no exterior).
  cnpj                  text,
  inscricao_estadual    text,
  inscricao_municipal   text,
  -- Endereço único (não estruturado no MVP; PMOC exige só constar).
  endereco              text,
  -- Contato: telefone, e-mail ou WhatsApp — campo livre.
  contato               text,
  -- URL pra abertura de chamados (link que vai no PDF PMOC).
  url_chamados          text,
  -- Observação / notas internas do técnico sobre o cliente.
  observacoes           text,
  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now())
);

-- Índice em user_id pra listagem rápida do tenant.
create index if not exists idx_clientes_user_id on public.clientes(user_id);

-- Updated_at trigger (mesma função usada em outros arquivos).
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'set_updated_at_clientes') then
    create or replace function public.set_updated_at_clientes()
    returns trigger language plpgsql as $fn$
    begin
      new.updated_at = timezone('utc', now());
      return new;
    end;
    $fn$;
  end if;
end $$;

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at_clientes();


-- ─── 3. RLS clientes ────────────────────────────────────────
alter table public.clientes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='clientes' and policyname='clientes_select_own'
  ) then
    create policy clientes_select_own on public.clientes
      for select to authenticated using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='clientes' and policyname='clientes_insert_own'
  ) then
    create policy clientes_insert_own on public.clientes
      for insert to authenticated with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='clientes' and policyname='clientes_update_own'
  ) then
    create policy clientes_update_own on public.clientes
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='clientes' and policyname='clientes_delete_own'
  ) then
    create policy clientes_delete_own on public.clientes
      for delete to authenticated using (auth.uid() = user_id);
  end if;
end $$;


-- ─── 4. EQUIPAMENTOS — FK cliente_id ────────────────────────
-- ON DELETE SET NULL: se o técnico deletar um cliente, equipamentos
-- ficam órfãos (cliente_id=null) em vez de cascatear delete dos
-- equipamentos junto. Comportamento esperado: técnico pode reorganizar
-- carteira de clientes sem perder dados de manutenção dos ativos.
alter table public.equipamentos
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  -- Patrimônio: identificação interna do cliente (Nº de patrimônio,
  -- código de inventário). Diferente do nº de série do equipamento
  -- (que é da fábrica). Vai na coluna "Patrimônio" da tabela PMOC.
  add column if not exists patrimonio text;

create index if not exists idx_equipamentos_cliente_id
  on public.equipamentos(cliente_id);


-- ─── 5. Comentários pra documentação inline ─────────────────
comment on table public.clientes is
  'Carteira de clientes do técnico (multi-tenant). Usado por PMOC e share de PDF.';
comment on column public.clientes.cnpj is
  'CNPJ ou CPF (campo livre). Validação no frontend.';
comment on column public.clientes.url_chamados is
  'URL pra abertura de chamados — vai no header do PDF PMOC.';
comment on column public.equipamentos.cliente_id is
  'FK opcional pra clientes. Equipamento sem cliente = não classificado.';
comment on column public.equipamentos.patrimonio is
  'Código de patrimônio interno do cliente (diferente de Nº série da fábrica).';
