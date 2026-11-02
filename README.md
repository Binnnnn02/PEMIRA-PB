# PEMIRA — Aplikasi Pemilihan Raya Organisasi

Aplikasi voting React + Supabase. Siswa memilih nama dari roster, lalu memberikan satu suara. Status partisipasi disimpan terpisah dari surat suara anonim.

## Fitur

- Halaman utama, kandidat, dan pendaftaran calon tetap tersedia.
- `/pilih`: pilih nama siswa, pilih kandidat, lalu kirim suara.
- Panel admin: pengelolaan siswa dan kandidat, jadwal pemungutan suara, daftar status sudah/belum memilih, serta rekap suara agregat.
- Tidak ada halaman atau proses Daftar Ulang.

## Setup Supabase

1. Buat project Supabase dan jalankan `supabase/schema.sql` di SQL Editor.
2. Setelah itu jalankan **seluruh** `supabase/migrations/20261031_secret_ballot.sql`. Migrasi ini wajib: ia menghapus alur kode/daftar ulang lama, memindahkan suara lama ke format anonim tanpa waktu atau identitas pemilih, serta memasang RPC dan akses database yang baru. Migrasi bisa dijalankan ulang setelah percobaan terhenti dan tidak menggandakan suara.
3. Buat akun admin di Authentication → Users.
4. Salin Project URL dan anon public key dari Project Settings → API ke `.env` sebagai `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
5. Admin login, lalu isi roster melalui **Data Siswa**. Untuk alumni, tambahkan nama dengan kelas/kategori **Alumni** dan biarkan statusnya aktif. Mereka akan muncul dalam pilihan kelas Alumni di halaman voting.

Untuk instalasi yang sudah berjalan, ekspor/cadangkan database terlebih dahulu lalu jalankan migrasi SQL. Migrasi mempertahankan hasil suara lama dalam bentuk jumlah suara kandidat, lalu menghapus baris lama yang menghubungkan voter dengan kandidat. Kode suara lama dan data pendaftaran ulang dihapus.

## Menjalankan aplikasi

```bash
npm install
```

Salin `.env.example` menjadi `.env` lalu isi URL dan anon public key Supabase.

```bash
npm run dev
```

Build produksi:

```bash
npm run build
```

Atur `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada hosting. Aplikasi menggunakan React Router; pastikan hosting memakai fallback SPA ke `index.html`.

## Privasi dan pengamanan suara

- Tabel `voter_participation` mencatat student ID, status, dan waktu partisipasi. Admin hanya bisa melihat nama serta status melalui view khusus; tabel status dan waktu tidak dapat dibaca langsung melalui API.
- Tabel `votes` hanya menyimpan ID baris acak dan ID kandidat. Tidak ada kolom student ID, voter ID, waktu, kode, atau relasi yang menghubungkannya ke partisipasi. API klien tidak diberi akses membaca surat suara satu per satu; admin memakai view `vote_counts` untuk melihat total per kandidat.
- `cast_student_vote` mengunci baris partisipasi dan memperbarui status serta memasukkan surat suara dalam satu transaksi database. Dua pengiriman bersamaan untuk nama yang sama hanya dapat menghasilkan satu suara, termasuk lintas browser atau perangkat.
- **Memilih nama saja bukan verifikasi identitas.** Siapa pun yang dapat membuka halaman dapat memilih nama siswa lain. Panitia perlu memverifikasi siswa secara langsung atau menambahkan metode autentikasi sebelum pemilihan nyata.
