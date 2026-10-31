-- PEMIRA secret-ballot migration.
-- Run after supabase/schema.sql. Safe to re-run if a previous attempt partially completed.
begin;

drop view if exists public.vote_counts;
drop function if exists public.cast_vote(text, uuid);
drop function if exists public.check_voter_code(text);
drop function if exists public.submit_re_registration(int, uuid, text);

-- Replace the legacy voter-linked ballot table with anonymous ballots.
-- If votes already has no voter_id, it is already in the anonymous format and
-- is kept as-is so rerunning this migration cannot duplicate its totals.
create table if not exists public.anonymous_ballots (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete restrict
);

do $$
declare
  votes_exists boolean := to_regclass('public.votes') is not null;
  anonymous_exists boolean := to_regclass('public.anonymous_ballots') is not null;
  has_voter_id boolean := false;
begin
  if votes_exists then
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'votes'
        and column_name = 'voter_id'
    ) into has_voter_id;
  end if;

  if not votes_exists and anonymous_exists then
    alter table public.anonymous_ballots rename to votes;
  elsif votes_exists and has_voter_id then
    truncate table public.anonymous_ballots;
    insert into public.anonymous_ballots(candidate_id)
      select candidate_id from public.votes;
    drop table public.votes cascade;
    alter table public.anonymous_ballots rename to votes;
  elsif votes_exists then
    -- Existing votes is already anonymous; preserve it and remove any leftover staging table.
    drop table if exists public.anonymous_ballots;
  else
    raise exception 'Neither legacy votes nor anonymous ballots table exists.';
  end if;
end $$;

-- Preserve old participation flags before removing legacy voter records.
create table if not exists public.voter_participation (
  student_id uuid primary key references public.students(id) on delete cascade,
  status text not null default 'unvoted'
    check (status in ('unvoted', 'voted')),
  voted_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.voter_participation(student_id, status, voted_at)
  select id, 'unvoted', null
  from public.students
  where is_active
on conflict (student_id) do nothing;

-- Import status only when the legacy tables and columns are present.
do $$
begin
  if to_regclass('public.voters') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'voters' and column_name = 'student_id'
     )
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'voters' and column_name = 'has_voted'
     )
  then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'voters' and column_name = 'voted_at'
    ) then
      execute $sql$
        update public.voter_participation p
        set status = 'voted', voted_at = coalesce(v.voted_at, now())
        from public.voters v
        where v.student_id = p.student_id and v.has_voted
      $sql$;
    else
      execute $sql$
        update public.voter_participation p
        set status = 'voted', voted_at = now()
        from public.voters v
        where v.student_id = p.student_id and v.has_voted
      $sql$;
    end if;
  end if;
end $$;

drop table if exists public.re_registrations cascade;
drop table if exists public.voters cascade;
alter table public.election_settings
  drop column if exists reregistration_open,
  drop column if exists reregistration_start,
  drop column if exists reregistration_end;

alter table public.voter_participation enable row level security;
revoke all on public.voter_participation from public, anon, authenticated;

-- Prevent deletion from clearing the one-vote-per-student record.
create or replace function public.prevent_deleting_voted_student()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.voter_participation
    where student_id = old.id and status = 'voted'
  ) then
    raise exception 'A student who has voted cannot be deleted.' using errcode = '23503';
  end if;
  return old;
end $$;
drop trigger if exists protect_voted_student_delete on public.students;
create trigger protect_voted_student_delete before delete on public.students
  for each row execute function public.prevent_deleting_voted_student();

-- Add a separate participation row for newly added active students.
create or replace function public.ensure_student_participation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active then
    insert into public.voter_participation(student_id) values (new.id)
      on conflict (student_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists students_participation_insert on public.students;
create trigger students_participation_insert after insert or update of is_active on public.students
  for each row execute function public.ensure_student_participation();

create or replace view public.student_directory as
  select id, class_name, full_name from public.students where is_active = true;
grant select on public.student_directory to anon, authenticated;

drop view if exists public.voter_status;
create view public.voter_status as
  select s.id as student_id, s.full_name, s.class_name,
    coalesce(p.status, 'unvoted') as status
  from public.students s
  left join public.voter_participation p on p.student_id = s.id
  where s.is_active = true or p.status = 'voted';
revoke all on public.voter_status from public, anon;
grant select on public.voter_status to authenticated;

create or replace function public.check_student_vote(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.students%rowtype; p public.voter_participation%rowtype;
begin
  select * into s from public.students where id = p_student_id and is_active;
  if not found then return jsonb_build_object('valid', false); end if;
  insert into public.voter_participation(student_id) values (s.id) on conflict do nothing;
  select * into p from public.voter_participation where student_id = s.id;
  return jsonb_build_object('valid', true, 'name', s.full_name, 'status', p.status);
end $$;
revoke all on function public.check_student_vote(uuid) from public;
grant execute on function public.check_student_vote(uuid) to anon, authenticated;

-- Lock the student's participation row so concurrent devices cannot submit twice.
create or replace function public.cast_student_vote(p_student_id uuid, p_candidate_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.voter_participation%rowtype; e public.election_settings%rowtype;
begin
  select * into e from public.election_settings where id = 1;
  if e.is_active is not true
     or (e.start_time is not null and now() < e.start_time)
     or (e.end_time is not null and now() > e.end_time) then
    return jsonb_build_object('success', false, 'reason', 'not_active');
  end if;
  if not exists (select 1 from public.students where id = p_student_id and is_active) then
    return jsonb_build_object('success', false, 'reason', 'invalid_student');
  end if;
  if not exists (select 1 from public.candidates where id = p_candidate_id) then
    return jsonb_build_object('success', false, 'reason', 'invalid_candidate');
  end if;

  insert into public.voter_participation(student_id) values (p_student_id)
    on conflict (student_id) do nothing;
  select * into p from public.voter_participation
    where student_id = p_student_id for update;
  if p.status = 'voted' then
    return jsonb_build_object('success', false, 'reason', 'already_voted');
  end if;

  -- The ballot has no student ID, voter ID, token, or timestamp.
  insert into public.votes(candidate_id) values (p_candidate_id);
  update public.voter_participation
    set status = 'voted', voted_at = now()
    where student_id = p_student_id;
  return jsonb_build_object('success', true);
end $$;
revoke all on function public.cast_student_vote(uuid, uuid) from public;
grant execute on function public.cast_student_vote(uuid, uuid) to anon, authenticated;

-- Hide individual ballots through the API; expose only the aggregate view.
alter table public.votes enable row level security;
revoke all on public.votes from public, anon, authenticated;
drop policy if exists "votes readable by admin" on public.votes;

create view public.vote_counts as
  select c.id as candidate_id, c.number, c.name, c.running_mate,
    count(v.id) as total_votes
  from public.candidates c
  left join public.votes v on v.candidate_id = c.id
  group by c.id, c.number, c.name, c.running_mate;
revoke all on public.vote_counts from public, anon;
grant select on public.vote_counts to authenticated;

commit;
