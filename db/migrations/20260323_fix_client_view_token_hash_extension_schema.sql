create extension if not exists pgcrypto;

drop function if exists public.client_view_token_hash(text);
create or replace function public.client_view_token_hash(p_token text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;
