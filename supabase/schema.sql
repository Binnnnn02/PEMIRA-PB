-- ============================================================
-- PEMIRA — Skema Database Supabase (PostgreSQL)
-- Jalankan seluruh file ini di Supabase Studio -> SQL Editor
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Tabel: election_settings (satu baris konfigurasi pemilu)
-- ------------------------------------------------------------
create table if not exists election_settings (
  id int primary key default 1,
  title text not null default 'PEMIRA',
  organization text not null default 'Organisasi',
  tagline text,
  start_time timestamptz,
  end_time timestamptz,
  is_active boolean not null default false,
  results_public boolean not null default false,
  registration_open boolean not null default false,
  registration_start timestamptz,
  registration_end timestamptz,
  constraint single_row check (id = 1)
);

-- Kolom tambahan untuk instalasi yang sudah pernah menjalankan versi awal skema ini.
alter table election_settings add column if not exists tagline text;
alter table election_settings add column if not exists registration_open boolean not null default false;
alter table election_settings add column if not exists registration_start timestamptz;
alter table election_settings add column if not exists registration_end timestamptz;

insert into election_settings (id, title, organization)
values (1, 'PEMIRA 2026', 'Nama Organisasi')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. Tabel: candidates (paslon)
-- ------------------------------------------------------------
create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  name text not null,
  running_mate text,
  vision text,
  mission text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2b. Tabel: candidate_applications (pendaftaran calon oleh siswa)
-- ------------------------------------------------------------
create table if not exists candidate_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  class_or_id text,
  position text not null default 'Ketua & Wakil Ketua',
  running_mate text,
  vision text,
  mission text,
  photo_url text,
  contact text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table candidate_applications enable row level security;

-- Siapa saja boleh mendaftar (insert), tapi tidak boleh membaca daftar
-- pendaftar lain (mencegah kebocoran data kontak antar siswa).
create policy "anyone can submit an application"
  on candidate_applications for insert
  with check (status = 'pending');

-- Hanya admin yang boleh melihat, memverifikasi, atau menghapus pendaftaran.
create policy "admin can view applications"
  on candidate_applications for select
  using (auth.role() = 'authenticated');

create policy "admin can update applications"
  on candidate_applications for update
  using (auth.role() = 'authenticated');

create policy "admin can delete applications"
  on candidate_applications for delete
  using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 3. Tabel: voters (daftar pemilih tetap / DPT, diidentifikasi via kode unik)
-- ------------------------------------------------------------
create table if not exists voters (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  has_voted boolean not null default false,
  voted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists voters_code_idx on voters (code);

-- ------------------------------------------------------------
-- 4. Tabel: votes (suara masuk — satu baris per voter)
-- ------------------------------------------------------------
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates (id) on delete restrict,
  voter_id uuid not null unique references voters (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table election_settings enable row level security;
alter table candidates enable row level security;
alter table voters enable row level security;
alter table votes enable row level security;

-- election_settings: semua orang boleh baca (untuk halaman voting publik),
-- hanya user login (admin) yang boleh ubah.
create policy "settings readable by everyone"
  on election_settings for select
  using (true);

create policy "settings editable by admin"
  on election_settings for update
  using (auth.role() = 'authenticated');

-- candidates: publik boleh baca daftar kandidat, hanya admin yang kelola.
create policy "candidates readable by everyone"
  on candidates for select
  using (true);

create policy "candidates managed by admin"
  on candidates for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- voters: TIDAK ada policy select publik (agar kode tidak bisa di-enumerate).
-- Admin (login) boleh kelola penuh. Publik hanya boleh mengakses lewat
-- fungsi security-definer di bawah (check_voter_code / cast_vote).
create policy "voters managed by admin"
  on voters for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- votes: publik TIDAK boleh insert langsung (harus lewat cast_vote()).
-- Admin boleh baca untuk rekap hasil.
create policy "votes readable by admin"
  on votes for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- FUNGSI: check_voter_code
-- Dipanggil dari halaman voting publik untuk memvalidasi kode
-- suara tanpa membuka akses baca penuh ke tabel voters.
-- ============================================================
create or replace function check_voter_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter voters%rowtype;
begin
  select * into v_voter from voters where code = p_code;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'valid', true,
    'has_voted', v_voter.has_voted,
    'name', v_voter.name
  );
end;
$$;

revoke all on function check_voter_code(text) from public;
grant execute on function check_voter_code(text) to anon, authenticated;

-- ============================================================
-- FUNGSI: cast_vote
-- Memvalidasi kode, jendela waktu pemilu, status suara, lalu
-- mencatat suara secara atomik. Dijalankan sebagai security
-- definer sehingga klien publik tidak butuh akses insert langsung.
-- ============================================================
create or replace function cast_vote(p_code text, p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_voter voters%rowtype;
  v_settings election_settings%rowtype;
begin
  select * into v_settings from election_settings where id = 1;

  if v_settings.is_active is not true then
    return jsonb_build_object('success', false, 'reason', 'not_active');
  end if;

  if v_settings.start_time is not null and now() < v_settings.start_time then
    return jsonb_build_object('success', false, 'reason', 'not_started');
  end if;

  if v_settings.end_time is not null and now() > v_settings.end_time then
    return jsonb_build_object('success', false, 'reason', 'ended');
  end if;

  select * into v_voter from voters where code = p_code for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'invalid_code');
  end if;

  if v_voter.has_voted then
    return jsonb_build_object('success', false, 'reason', 'already_voted');
  end if;

  if not exists (select 1 from candidates where id = p_candidate_id) then
    return jsonb_build_object('success', false, 'reason', 'invalid_candidate');
  end if;

  insert into votes (candidate_id, voter_id) values (p_candidate_id, v_voter.id);

  update voters set has_voted = true, voted_at = now() where id = v_voter.id;

  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'reason', 'already_voted');
end;
$$;

revoke all on function cast_vote(text, uuid) from public;
grant execute on function cast_vote(text, uuid) to anon, authenticated;

-- ============================================================
-- VIEW: vote_counts (rekap suara per kandidat, hanya untuk admin)
-- ============================================================
create or replace view vote_counts as
select
  c.id as candidate_id,
  c.number,
  c.name,
  c.running_mate,
  count(v.id) as total_votes
from candidates c
left join votes v on v.candidate_id = c.id
group by c.id, c.number, c.name, c.running_mate
order by c.number;

-- ============================================================
-- STORAGE: bucket untuk foto kandidat
-- ============================================================
insert into storage.buckets (id, name, public)
values ('candidate-photos', 'candidate-photos', true)
on conflict (id) do nothing;

create policy "candidate photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'candidate-photos');

create policy "admin can upload candidate photos"
  on storage.objects for insert
  with check (bucket_id = 'candidate-photos' and auth.role() = 'authenticated');

-- Siswa yang mendaftar boleh mengunggah foto, tapi hanya ke folder
-- "applications/" — tidak bisa menimpa foto kandidat resmi.
create policy "public can upload application photos"
  on storage.objects for insert
  with check (
    bucket_id = 'candidate-photos'
    and (storage.foldername(name))[1] = 'applications'
  );

create policy "admin can update candidate photos"
  on storage.objects for update
  using (bucket_id = 'candidate-photos' and auth.role() = 'authenticated');

create policy "admin can delete candidate photos"
  on storage.objects for delete
  using (bucket_id = 'candidate-photos' and auth.role() = 'authenticated');

-- ============================================================
-- REALTIME (opsional, untuk grafik hasil live di dashboard admin)
-- ============================================================
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table candidate_applications;
