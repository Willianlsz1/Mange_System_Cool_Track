-- ============================================================
-- PMOC Fase 3 — Checklist NBR 13971 em registros
-- Date: 2026-04-25
--
-- Contexto:
--   ABNT NBR 13971 e a Lei 13.589/2018 exigem checklist técnico
--   formal em manutenção preventiva PMOC. Cada item do checklist
--   tem um status (conforme/não-conforme/N/A) e observação opcional.
--
--   Em vez de criar uma tabela relacional checklist_items (que
--   gera 2 queries por registro, RLS nova e JOINs), guardamos o
--   checklist completo como JSONB no próprio registro. Trade-off
--   aceito: queries analíticas tipo "% de itens não-conforme no
--   mês" vão precisar de SQL com jsonb_array_elements, mas isso
--   é caso de uso raro e fica viável.
--
-- Shape esperado:
--   {
--     "tipo_template": "split_hi_wall",   -- chave do template
--     "version": 1,                       -- versão do template
--     "items": [
--       { "id": "filtros_limpos", "status": "ok", "obs": "..." },
--       { "id": "drenagem", "status": "fail", "obs": "..." },
--       { "id": "compressor", "status": "na", "obs": "" }
--     ]
--   }
--
--   status pode ser: 'ok' | 'fail' | 'na'
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + DO block para constraint.
-- ============================================================

alter table public.registros
  add column if not exists checklist jsonb;

comment on column public.registros.checklist is
  'Checklist NBR 13971 do servico (PMOC Fase 3). Shape: {tipo_template, version, items:[{id,status,obs}]}. Null quando nao preenchido.';

-- Constraint: se checklist existir, deve ser objeto JSON (não array, não string).
-- Permite null pra registros sem checklist (fluxo padrão Free / serviços não-PMOC).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'registros_checklist_is_object'
      and conrelid = 'public.registros'::regclass
  ) then
    alter table public.registros
      add constraint registros_checklist_is_object
      check (checklist is null or jsonb_typeof(checklist) = 'object');
  end if;
end $$;

-- Índice GIN parcial pra futuras queries analíticas (ex: "registros
-- com checklist" pra dashboards Pro). Parcial pra evitar custo em
-- registros sem checklist (que serão a maioria nos primeiros meses).
create index if not exists idx_registros_checklist
  on public.registros using gin (checklist)
  where checklist is not null;
