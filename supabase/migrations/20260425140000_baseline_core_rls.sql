-- ============================================================
-- Baseline RLS: equipamentos, registros, tecnicos
-- Date: 2026-04-25
--
-- Contexto:
--   Estas três tabelas core foram criadas out-of-band no SQL Editor
--   antes de existirem migrations versionadas (vide comentário em
--   20260417_equipamentos_manutencao_fields.sql:9-14). Em prod, RLS
--   está ativa com policies de ownership por user_id — mas isso vive
--   só no DB do projeto e não é reproduzível em CI/staging/clones do
--   repo. Auditoria SOC2 também exige policies versionadas.
--
--   Esta migration declara o estado-alvo: ENABLE RLS + 4 policies
--   (select/insert/update/delete) por tabela, todas com
--   `auth.uid() = user_id`. Padrão idêntico ao já versionado em
--   20260411_security_subscription_usage.sql para profiles e
--   usage_monthly.
--
-- Risco operacional:
--   Se as policies em prod já existirem com NOMES DIFERENTES, esta
--   migration ADICIONA as canônicas em paralelo sem derrubar as
--   antigas. Resultado: policies duplicadas (ambas permissive, OR'd)
--   → comportamento idêntico mas poluição no catálogo. Limpeza das
--   antigas via Dashboard depois de validar paridade.
--
--   Se policies em prod já existirem com OS MESMOS NOMES (ex: já
--   foram criadas via SQL Editor seguindo este padrão), o bloco
--   `if not exists` no pg_policies torna o INSERT no-op — seguro.
--
-- Idempotente:
--   - Guarda contra information_schema.tables (CI shadow DB sem
--     a tabela vira no-op).
--   - ENABLE RLS é no-op se já estiver habilitado.
--   - CREATE POLICY guardada por if-not-exists em pg_policies.
-- ============================================================

do $$
declare
  t text;
  tables text[] := array['equipamentos', 'registros', 'tecnicos'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice 'Tabela public.% não existe — pulando RLS (esperado em shadow DB do CI).', t;
      continue;
    end if;

    -- ENABLE RLS é idempotente: no-op se já habilitado.
    execute format('alter table public.%I enable row level security', t);

    -- select_own
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_select_own'
    ) then
      execute format(
        'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
        t || '_select_own', t
      );
    end if;

    -- insert_own
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_insert_own'
    ) then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
        t || '_insert_own', t
      );
    end if;

    -- update_own
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_update_own'
    ) then
      execute format(
        'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        t || '_update_own', t
      );
    end if;

    -- delete_own
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_delete_own'
    ) then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
        t || '_delete_own', t
      );
    end if;
  end loop;
end $$;
