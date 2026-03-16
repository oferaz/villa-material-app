drop policy if exists "profiles_self_insert" on public.profiles;

create policy "profiles_self_insert"
on public.profiles
for insert
with check (auth.uid() = id);
