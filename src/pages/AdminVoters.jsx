import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

export default function AdminVoters() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { load(); }, []);
  async function load() {
    const { data, error: loadError } = await supabase.from("voter_status").select("student_id, full_name, class_name, status").order("full_name");
    if (loadError) setError("Gagal memuat status siswa. Periksa pemasangan migrasi SQL.");
    else setRows(data || []);
  }
  const filtered = rows.filter((r) => `${r.full_name} ${r.class_name}`.toLowerCase().includes(search.toLowerCase()));
  const voted = rows.filter((r) => r.status === "voted").length;
  return <div>
    <h2>Status Pemilih</h2>
    <p className="admin-sub">{rows.length} siswa · {voted} sudah memilih · {rows.length - voted} belum memilih</p>
    {error && <div className="banner banner-danger" style={{ marginBottom: 14 }}>{error}</div>}
    <div className="card">
      <div className="toolbar"><h3 style={{ marginBottom: 0 }}>Daftar siswa</h3><div style={{ display: "flex", gap: 8 }}><input className="search-input" placeholder="Cari nama atau kelas…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} /><button className="btn btn-outline btn-small" onClick={load}>Perbarui</button></div></div>
      <p className="field-hint">Admin dapat melihat status partisipasi dan rekap jumlah suara. Pilihan kandidat tiap siswa tidak disimpan bersama identitasnya.</p>
      <div style={{ overflowX: "auto" }}><table><thead><tr><th>Nama</th><th>Kelas</th><th>Status</th></tr></thead><tbody>
        {filtered.map((r) => <tr key={r.student_id}><td>{r.full_name}</td><td>{r.class_name}</td><td><span className={`pill ${r.status === "voted" ? "pill-success" : "pill-muted"}`}>{r.status === "voted" ? "✓ Sudah memilih" : "Belum memilih"}</span></td></tr>)}
        {!filtered.length && <tr><td colSpan={3} style={{ textAlign: "center", padding: "24px 0" }}>Tidak ada data.</td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}
