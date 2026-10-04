import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

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
        supabase.from("election_settings").select("*").eq("id", 1).maybeSingle(),
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
  const isActive = settings?.is_active;

  return (
    <div>
      <h2>Ringkasan</h2>
      <p className="admin-sub">
        {settings?.title
          ? `${settings.title} — ${settings.organization}`
          : "Memuat data pemilu…"}
      </p>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="value">{stats.voters}</div>
          <div className="label">Pemilih terdaftar</div>
        </div>
        <div className="stat-card">
          <div className="value">
            {stats.voted}
            <span style={{ fontSize: 15, fontWeight: 400, color: "var(--color-ink-soft)", marginLeft: 6 }}>
              ({turnout}%)
            </span>
          </div>
          <div className="label">Suara masuk</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats.candidates}</div>
          <div className="label">Kandidat terdaftar</div>
        </div>
      </div>

      {/* Pending alert */}
      {stats.pending > 0 && (
        <div
          className="card"
          style={{ borderColor: "var(--color-primary)", borderLeftWidth: 3, borderLeftStyle: "solid" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>
                {stats.pending} pendaftaran menunggu verifikasi
              </h3>
              <p style={{ fontSize: 13, color: "var(--color-ink-soft)", margin: 0 }}>
                Tinjau dan setujui pendaftar agar muncul di surat suara.
              </p>
            </div>
            <Link to="/admin/applications" className="btn btn-purple btn-small" style={{ flexShrink: 0 }}>
              Tinjau →
            </Link>
          </div>
        </div>
      )}

      {/* Voting status */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span
            style={{
              width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
              background: isActive ? "var(--color-success)" : "var(--color-ink-muted)",
              boxShadow: isActive ? "0 0 0 3px var(--color-success-wash)" : "none",
            }}
          />
          <h3 style={{ marginBottom: 0 }}>
            Status pemungutan suara:{" "}
            <span style={{ color: isActive ? "var(--color-success)" : "var(--color-ink-soft)" }}>
              {isActive ? "Aktif" : "Nonaktif"}
            </span>
          </h3>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--color-ink-soft)", margin: 0 }}>
          {isActive
            ? "Pemungutan suara sedang aktif. Atur jadwal di halaman Pengaturan."
            : "Pemungutan suara belum diaktifkan. Buka di halaman Pengaturan ketika siap."}
        </p>
      </div>
    </div>
  );
}
