-- Run once in Supabase SQL Editor for an existing PEMIRA database.
begin;

alter table public.voters
  add column if not exists voter_type text not null default 'student';

alter table public.voters
  drop constraint if exists voters_voter_type_check;
alter table public.voters
  add constraint voters_voter_type_check
  check (voter_type in ('student', 'alumni'));

-- Remove the identity link from existing ballots. The ballot candidate remains
-- unchanged; after this migration no ballot can be joined to a voter record.
alter table public.votes drop constraint if exists votes_voter_id_fkey;
alter table public.votes drop constraint if exists votes_voter_id_key;
alter table public.votes drop column if exists voter_id;

-- Keep voter status durable after a ballot is cast; identities with votes cannot
-- be deleted by the admin interface or through the authenticated database role.
drop policy if exists "voters managed by admin" on public.voters;
drop policy if exists "admin can view voters" on public.voters;
drop policy if exists "admin can add voters" on public.voters;
drop policy if exists "admin can update voters" on public.voters;
drop policy if exists "admin can delete unvoted voters" on public.voters;

create policy "admin can view voters"
  on public.voters for select
  using (auth.role() = 'authenticated');
create policy "admin can add voters"
  on public.voters for insert
  with check (auth.role() = 'authenticated');
create policy "admin can update voters"
  on public.voters for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
create policy "admin can delete unvoted voters"
  on public.voters for delete
  using (auth.role() = 'authenticated' and has_voted = false);

create or replace function public.cast_vote(p_code text, p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter public.voters%rowtype;
  v_settings public.election_settings%rowtype;
begin
  select * into v_settings from public.election_settings where id = 1;

  if v_settings.is_active is not true then
    return jsonb_build_object('success', false, 'reason', 'not_active');
  end if;
  if v_settings.start_time is not null and now() < v_settings.start_time then
    return jsonb_build_object('success', false, 'reason', 'not_started');
  end if;
  if v_settings.end_time is not null and now() > v_settings.end_time then
    return jsonb_build_object('success', false, 'reason', 'ended');
  end if;

  select * into v_voter from public.voters where code = p_code for update;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'invalid_code');
  end if;
  if v_voter.has_voted then
    return jsonb_build_object('success', false, 'reason', 'already_voted');
  end if;
  if not exists (select 1 from public.candidates where id = p_candidate_id) then
    return jsonb_build_object('success', false, 'reason', 'invalid_candidate');
  end if;

  -- Deliberately store no voter id in the ballot table.
  insert into public.votes (candidate_id) values (p_candidate_id);
  update public.voters set has_voted = true, voted_at = now() where id = v_voter.id;
  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'reason', 'already_voted');
end;
$$;

revoke all on function public.cast_vote(text, uuid) from public;
grant execute on function public.cast_vote(text, uuid) to anon, authenticated;

commit;
