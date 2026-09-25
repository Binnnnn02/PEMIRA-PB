import { supabase } from "../supabaseClient.js";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function AdminOverview() {
  const [stats, setStats] = useState({ voters: 0, voted: 0, candidates: 0, pending: 0 });
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [{ count: voters }, { count: voted }, { count: candidates }, { count: pending }, { data: s }] =
      await Promise.all([
        supabase.from("voters").select("*", { count: "exact", head: true }),
        supabase
          .from("voters")
          .select("*", { count: "exact", head: true })
          .eq("has_voted", true),
        supabase.from("candidates").select("*", { count: "exact", head: true }),
        supabase
          .from("candidate_applications")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("election_settings").select("*").eq("id", 1).single(),
      ]);

    setStats({
      voters: voters || 0,
      voted: voted || 0,
      candidates: candidates || 0,
      pending: pending || 0,
    });
    setSettings(s);
  }

  const turnout = stats.voters > 0 ? Math.round((stats.voted / stats.voters) * 100) : 0;

  return (
    <div>
      <h2>Ringkasan</h2>
      <p className="admin-sub">
        {settings?.title} — {settings?.organization}
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="value">{stats.voters}</div>
          <div className="label">Total pemilih terdaftar</div>
        </div>
        <div className="stat-card">
          <div className="value">
            {stats.voted} <span style={{ fontSize: 16, color: "var(--color-ink-soft)" }}>({turnout}%)</span>
          </div>
          <div className="label">Sudah memilih</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats.candidates}</div>
          <div className="label">Kandidat terdaftar</div>
        </div>
      </div>

      {stats.pending > 0 && (
        <div className="card" style={{ borderColor: "var(--color-purple)" }}>
          <h3>{stats.pending} pendaftaran calon menunggu verifikasi</h3>
          <p style={{ fontSize: 14, color: "var(--color-ink-soft)", marginBottom: 12 }}>
            Tinjau dan setujui pendaftar agar muncul di surat suara.
          </p>
          <Link to="/admin/applications" className="btn btn-purple btn-small">
            Tinjau pendaftaran
          </Link>
        </div>
      )}

      <div className="card">
        <h3>Status pemungutan suara</h3>
        <p style={{ fontSize: 14, color: "var(--color-ink-soft)" }}>
          {settings?.is_active
            ? "Pemungutan suara sedang aktif. Atur jadwal di halaman Pengaturan."
            : "Pemungutan suara belum diaktifkan. Buka di halaman Pengaturan ketika siap."}
        </p>
      </div>
    </div>
  );
}
