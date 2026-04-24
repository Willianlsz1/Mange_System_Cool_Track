-- ============================================================
-- Hardening: ownership check nas policies Plus do bucket `registro-fotos`
-- Date: 2026-04-24
--
-- CONTEXTO DO BUG (reportado por auditoria externa):
--
-- As policies `equipamento_fotos_require_plus_insert` e
-- `equipamento_fotos_require_plus_update` (migration 20260420130000)
-- checavam apenas subpath='equipamentos' + plano Plus/Pro, SEM verificar
-- ownership do caminho. Como policies PERMISSIVE combinam com OR no
-- Postgres, o comportamento era:
--
--   user A (Plus) faz upload em `<UUID_de_B>/equipamentos/xxx/foto.jpg`
--   - `own photos upload` bloqueia (ownership: auth.uid() != B_UUID)
--   - `equipamento_fotos_require_plus_insert` aprova (subpath + Plus)
--   - OR → upload passa → A escreve no bucket de B
--
-- Escopo do dano: corrupção/substituição de fotos de equipamentos de
-- outros usuários. SELECT/DELETE não afetados (só têm policies de
-- ownership — não há contrapartida Plus para essas ações).
--
-- FIX: adiciona ownership check `(storage.foldername(name))[1] = auth.uid()::text`
-- nas 2 policies Plus. Com isso, mesmo que a Plus "aprove", a condição de
-- ownership é verificada pelo próprio predicado — não depende mais da
-- combinação PERMISSIVE/OR.
--
-- Idempotente: usa IF EXISTS nos ALTER POLICY.
-- ============================================================

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'equipamento_fotos_require_plus_insert'
  ) then
    alter policy equipamento_fotos_require_plus_insert
      on storage.objects
      with check (
        bucket_id = 'registro-fotos'
        and (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] = 'equipamentos'
        and public.user_has_plus_plan(auth.uid())
      );
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'equipamento_fotos_require_plus_update'
  ) then
    alter policy equipamento_fotos_require_plus_update
      on storage.objects
      using (
        bucket_id = 'registro-fotos'
        and (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] = 'equipamentos'
      )
      with check (
        bucket_id = 'registro-fotos'
        and (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] = 'equipamentos'
        and public.user_has_plus_plan(auth.uid())
      );
  end if;
end $$;
