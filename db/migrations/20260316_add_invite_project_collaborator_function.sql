create table if not exists public.project_collaborator_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('viewer', 'editor')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists idx_project_collaborator_invites_project_email_ci
  on public.project_collaborator_invites (project_id, email);

create index if not exists idx_project_collaborator_invites_email_ci
  on public.project_collaborator_invites (email);

drop trigger if exists trg_project_collaborator_invites_touch_updated_at on public.project_collaborator_invites;
create trigger trg_project_collaborator_invites_touch_updated_at
before update on public.project_collaborator_invites
for each row execute function public.touch_updated_at();

drop function if exists public.accept_pending_project_invites();
create or replace function public.accept_pending_project_invites()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_email text;
  v_accepted_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select lower(trim(coalesce(u.email, '')))
  into v_normalized_email
  from auth.users u
  where u.id = v_user_id
  limit 1;

  if v_normalized_email is null or v_normalized_email = '' then
    return 0;
  end if;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  insert into public.project_members (project_id, user_id, role)
  select
    pci.project_id,
    v_user_id,
    pci.role
  from public.project_collaborator_invites pci
  where pci.email = v_normalized_email
    and pci.accepted_at is null
  on conflict (project_id, user_id) do update
    set role = excluded.role
    where public.project_members.role <> 'owner';

  update public.project_collaborator_invites pci
  set accepted_at = now(),
      updated_at = now()
  where pci.email = v_normalized_email
    and pci.accepted_at is null;

  get diagnostics v_accepted_count = row_count;
  return v_accepted_count;
end;
$$;

revoke all on function public.accept_pending_project_invites() from public;
grant execute on function public.accept_pending_project_invites() to authenticated;
grant execute on function public.accept_pending_project_invites() to service_role;

drop function if exists public.invite_project_collaborator(uuid, text);
drop function if exists public.invite_project_collaborator(uuid, text, text);

create or replace function public.invite_project_collaborator(
  p_project_id uuid,
  p_email text,
  p_role text default 'viewer'
)
returns public.project_members
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_normalized_email text := lower(trim(coalesce(p_email, '')));
  v_normalized_role text := lower(trim(coalesce(p_role, 'viewer')));
  v_invited_user_id uuid;
  v_existing_role text;
  v_member public.project_members;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_project_id is null then
    raise exception 'Project id is required.';
  end if;

  if v_normalized_email = '' then
    raise exception 'Collaborator email is required.';
  end if;

  if v_normalized_role not in ('viewer', 'editor') then
    raise exception 'Role must be viewer or editor.';
  end if;

  if not exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_actor_user_id
      and pm.role in ('owner', 'editor')
  ) then
    raise exception 'You do not have permission to invite collaborators to this project.';
  end if;

  select u.id
  into v_invited_user_id
  from auth.users u
  where lower(u.email) = v_normalized_email
  limit 1;

  if v_invited_user_id is null then
    insert into public.project_collaborator_invites (project_id, email, role, invited_by)
    values (p_project_id, v_normalized_email, v_normalized_role, v_actor_user_id)
    on conflict (project_id, email) do update
      set role = excluded.role,
          invited_by = excluded.invited_by,
          accepted_at = null,
          updated_at = now();
    return null;
  end if;

  if v_invited_user_id = v_actor_user_id then
    raise exception 'You are already a member of this project.';
  end if;

  select pm.role
  into v_existing_role
  from public.project_members pm
  where pm.project_id = p_project_id
    and pm.user_id = v_invited_user_id
  limit 1;

  if v_existing_role = 'owner' then
    raise exception 'Project owner role cannot be changed via invite.';
  end if;

  insert into public.profiles (id)
  values (v_invited_user_id)
  on conflict (id) do nothing;

  insert into public.project_members (project_id, user_id, role)
  values (p_project_id, v_invited_user_id, v_normalized_role)
  on conflict (project_id, user_id) do update
    set role = excluded.role
    where public.project_members.role <> 'owner'
  returning *
  into v_member;

  if v_member.project_id is null then
    select *
    into v_member
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = v_invited_user_id
    limit 1;
  end if;

  delete from public.project_collaborator_invites pci
  where pci.project_id = p_project_id
    and pci.email = v_normalized_email;

  return v_member;
end;
$$;

revoke all on function public.invite_project_collaborator(uuid, text, text) from public;
grant execute on function public.invite_project_collaborator(uuid, text, text) to authenticated;
grant execute on function public.invite_project_collaborator(uuid, text, text) to service_role;
