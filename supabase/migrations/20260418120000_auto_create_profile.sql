-- Trigger que cria automaticamente um row em public.profiles toda vez que
-- um user é inserido em auth.users. Resolve o bug de profiles "órfãos"
-- (user criado mas sem profile) quando email confirmation tá ligado:
-- nesse fluxo o client-side não consegue inserir via RLS porque a sessão
-- só vira válida depois da confirmação.
--
-- SECURITY DEFINER roda a função com privilégios do owner (postgres),
-- ignorando RLS. Seguro porque a função só insere com id do próprio user.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_nome text;
begin
  -- Tenta pegar o nome do raw_user_meta_data (quando signUp envia data.nome)
  -- ou cai pra prefixo do email como placeholder.
  user_nome := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    split_part(new.email, '@', 1),
    'Usuário'
  );

  insert into public.profiles (id, nome, plan, plan_code, subscription_status, is_dev)
  values (new.id, user_nome, 'free', 'free', 'inactive', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Idempotente: dropa trigger antigo antes de criar
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: cria profile pra qualquer user existente em auth.users que
-- esteja sem row em profiles (ex: a conta +teste@ que já tá lá).
insert into public.profiles (id, nome, plan, plan_code, subscription_status, is_dev)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'nome'), ''),
    split_part(u.email, '@', 1),
    'Usuário'
  ) as nome,
  'free', 'free', 'inactive', false
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
