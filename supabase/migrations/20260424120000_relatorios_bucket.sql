-- CoolTrack Pro — Bucket `relatorios` + RLS policies.
--
-- Contexto:
--   O share de relatório via WhatsApp (desktop/fallback) faz upload do PDF
--   para `relatorios/<userId>/<YYYY-MM>/relatorio-<id>.pdf` e gera signed
--   URL com TTL longo (7 dias por default). Essa migration cria o bucket
--   e as policies mínimas pra o fluxo funcionar sem expor dados entre
--   usuários.
--
-- Modelo de segurança:
--   - bucket é PRIVADO (public=false). Leitura externa só via signed URL.
--   - INSERT permitido ao authenticated user apenas no prefixo do próprio
--     auth.uid() (primeiro folder do path). Impede user A gravar em
--     `userB/*`.
--   - SELECT permitido ao dono — necessário pra `createSignedUrl` (a API
--     precisa que o chamador tenha SELECT no objeto pra assinar).
--   - UPDATE permitido ao dono — cobre `upsert: true` do client.
--   - DELETE permitido ao dono — housekeeping futuro.
--
-- Signed URL:
--   `supabase.storage.from('relatorios').createSignedUrl(path, ttl)` gera
--   um link temporário que NÃO depende de auth. Qualquer pessoa com o link
--   baixa o PDF até o TTL expirar. É assim que o cliente do técnico recebe
--   o arquivo via WhatsApp — sem precisar login na plataforma.
--
-- Idempotente: `on conflict do nothing` no insert do bucket; `if not exists`
-- nas policies. Pode rodar várias vezes em shadow DB + prod sem efeito.
-- ============================================================

-- 1. Bucket privado (só signed URL dá acesso externo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'relatorios',
  'relatorios',
  false,
  -- 10 MB — mais do que suficiente pra um PDF de relatório (mesmo com
  -- dezenas de fotos o PDF raramente passa de 5 MB no plano Plus/Pro).
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;


-- 2. Policies de acesso. Estrutura de path esperada:
--      `<auth.uid()>/<YYYY-MM>/relatorio-<id>.pdf`
--    `storage.foldername(name)[1]` retorna `<auth.uid()>`.

-- 2.1. INSERT — authenticated user pode gravar só na sua própria pasta.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'relatorios_insert_own'
  ) then
    create policy relatorios_insert_own
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'relatorios'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- 2.2. SELECT — dono lê seus próprios relatórios. REQUERIDO pra que
--      `createSignedUrl` funcione (a API exige SELECT no objeto).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'relatorios_select_own'
  ) then
    create policy relatorios_select_own
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'relatorios'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- 2.3. UPDATE — cobre `upsert: true` do upload client-side. Mesmo escopo.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'relatorios_update_own'
  ) then
    create policy relatorios_update_own
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'relatorios'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'relatorios'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- 2.4. DELETE — housekeeping; o dono remove PDFs antigos.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'relatorios_delete_own'
  ) then
    create policy relatorios_delete_own
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'relatorios'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- 3. RLS em storage.objects já vem habilitado em projetos Supabase —
--    NÃO incluímos `alter table storage.objects enable row level security`
--    porque só `supabase_storage_admin` tem ownership da tabela e o Dashboard
--    SQL Editor roda como `postgres` (erro 42501: must be owner of table).
--    Se por algum motivo estiver desligado no seu projeto, ligar pelo
--    Dashboard → Storage → Configuration, NÃO via SQL.
