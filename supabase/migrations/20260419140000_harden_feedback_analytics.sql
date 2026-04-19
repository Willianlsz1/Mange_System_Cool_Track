-- ============================================================
-- Hardening: feedback + analytics_events
-- Date: 2026-04-19
--
-- Problema (MÉDIO): as policies `feedback_insert_any` e
-- `analytics_events_insert_any` usam `with check (true)` — qualquer
-- visitante anônimo pode gravar rows ilimitados. Vetor de DoS por volume
-- (esgota storage / infla bill do Supabase).
--
-- Fix aplicado:
--   1. Limites de tamanho por row (CHECK constraints).
--   2. Mensagem de feedback obrigatória (evita spam de rows vazios).
--   3. (opcional futuro) rate-limit na camada de edge (Cloudflare Rules)
--      — não dá pra fazer server-side sem bloquear visitantes legítimos
--      do landing que ainda não se autenticaram.
-- ============================================================

-- ------------------------------------------------------------------
-- feedback: message obrigatório + limite de tamanho
-- ------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_message_length_check'
      and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_message_length_check
      check (
        message is null or
        (length(message) between 1 and 2000)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_user_email_length_check'
      and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_user_email_length_check
      check (user_email is null or length(user_email) <= 320);
  end if;
end $$;

-- ------------------------------------------------------------------
-- analytics_events: payload com limite razoável (4KB serialized)
-- ------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'analytics_events_payload_size_check'
      and conrelid = 'public.analytics_events'::regclass
  ) then
    alter table public.analytics_events
      add constraint analytics_events_payload_size_check
      check (octet_length(payload::text) <= 4096);
  end if;
end $$;

-- feedback_created_at_idx já existe da migration 20260414 — basta usá-lo.
