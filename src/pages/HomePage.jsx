import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import Countdown from "../components/Countdown.jsx";

export default function HomePage() {
  const [settings, setSettings] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({ voters: 0, voted: 0 });

  useEffect(() => {
    supabase.from("election_settings").select("*").eq("id", 1).single().then(({ data }) => setSettings(data));
    supabase
      .from("candidates")
      .select("*")
      .order("number")
      .then(({ data }) => setCandidates(data || []));
    loadStats();
  }, []);

  async function loadStats() {
    const [{ count: voters }, { count: voted }] = await Promise.all([
      supabase.from("voters").select("*", { count: "exact", head: true }),
      supabase.from("voters").select("*", { count: "exact", head: true }).eq("has_voted", true),
    ]);
    setStats({ voters: voters || 0, voted: voted || 0 });
  }

  const votingStatus = getStatus(settings?.is_active, settings?.start_time, settings?.end_time);
  const registrationStatus = getStatus(
    settings?.registration_open,
    settings?.registration_start,
    settings?.registration_end
  );

  return (
    <div className="home">
      <header className="home-nav">
        <div className="home-nav-brand">{settings?.title || "PEMIRA"}</div>
        <nav>
          <Link to="/kandidat">Kandidat</Link>
          <Link to="/pendaftaran-calon">Daftar Calon</Link>
          <Link to="/daftar-ulang">Daftar Ulang</Link>
          <Link to="/pilih" className="home-nav-cta">
            Masuk Memilih
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-kicker">{settings?.organization || "Organisasi"}</div>
        <h1 className="hero-title">
          {settings?.title || "PEMIRA"}
          {settings?.tagline ? <span className="hero-tagline">{settings.tagline}</span> : null}
        </h1>
        <p className="hero-lede">
          Satu suara, satu ketukan. Daftarkan dirimu sebagai calon pengurus, atau gunakan
          kode suaramu untuk memilih pemimpin organisasi berikutnya.
        </p>

        <div className="hero-actions">
          <Link to="/pilih" className="btn btn-purple" style={{ width: "auto" }}>
            Masuk &amp; Memilih
          </Link>
          <Link to="/pendaftaran-calon" className="btn btn-outline" style={{ width: "auto" }}>
            Daftar sebagai Calon
          </Link>
          <Link to="/daftar-ulang" className="btn btn-outline" style={{ width: "auto" }}>
            Daftar Ulang PEMIRA
          </Link>
        </div>

        <div className="hero-status-row">
          <StatusChip label="Pendaftaran calon" status={registrationStatus} settings={settings} field="registration" />
          <StatusChip label="Pemungutan suara" status={votingStatus} settings={settings} field="voting" />
        </div>
      </section>

      {stats.voters > 0 && (
        <section className="stat-strip">
          <div>
            <div className="stat-strip-value">{stats.voters}</div>
            <div className="stat-strip-label">pemilih terdaftar</div>
          </div>
          <div>
            <div className="stat-strip-value">{stats.voted}</div>
            <div className="stat-strip-label">suara masuk</div>
          </div>
          <div>
            <div className="stat-strip-value">{candidates.length}</div>
            <div className="stat-strip-label">calon pengurus</div>
          </div>
        </section>
      )}

      {candidates.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Calon Pengurus</h2>
            <Link to="/kandidat">Lihat semua profil →</Link>
          </div>
          <div className="preview-grid">
            {candidates.slice(0, 3).map((c) => (
              <div className="preview-card" key={c.id}>
                {c.photo_url ? (
                  <img src={c.photo_url} alt="" className="preview-photo" />
                ) : (
                  <div className="preview-photo preview-photo-empty">{c.number}</div>
                )}
                <div className="preview-number">Nomor Urut {c.number}</div>
                <div className="preview-name">
                  {c.name}
                  {c.running_mate ? ` & ${c.running_mate}` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Bagaimana alurnya</h2>
        </div>
        <ol className="steps">
          <li>
            <span className="steps-mark">1</span>
            <div>
              <strong>Pendaftaran calon dibuka.</strong> Siswa yang ingin maju mengisi formulir
              pendaftaran dan menunggu verifikasi panitia.
            </div>
          </li>
          <li>
            <span className="steps-mark">2</span>
            <div>
              <strong>Panitia memverifikasi</strong> dan menetapkan nomor urut resmi untuk setiap
              paslon yang lolos.
            </div>
          </li>
          <li>
            <span className="steps-mark">3</span>
            <div>
              <strong>Pemungutan suara dibuka.</strong> Setiap pemilih memasukkan kode suara unik
              dan memilih satu paslon — satu kode hanya berlaku sekali.
            </div>
          </li>
          <li>
            <span className="steps-mark">4</span>
            <div>
              <strong>Hasil ditampilkan</strong> kepada panitia secara langsung saat suara masuk.
            </div>
          </li>
        </ol>
      </section>

      <footer className="home-footer">
        {settings?.organization || "Organisasi"} · Diselenggarakan oleh panitia PEMIRA
      </footer>
    </div>
  );
}

function getStatus(active, start, end) {
  if (!active) return "inactive";
  const now = Date.now();
  if (start && now < new Date(start).getTime()) return "before";
  if (end && now > new Date(end).getTime()) return "after";
  return "open";
}

function StatusChip({ label, status, settings, field }) {
  const start = field === "voting" ? settings?.start_time : settings?.registration_start;
  const end = field === "voting" ? settings?.end_time : settings?.registration_end;

  const text = {
    inactive: "Belum dibuka",
    before: "Segera dibuka",
    open: "Sedang dibuka",
    after: "Sudah ditutup",
  }[status];

  return (
    <div className={`status-chip status-chip-${status}`}>
      <span className="status-dot" />
      <span>
        {label}: <strong>{text}</strong>
        {status === "before" && start && (
          <>
            {" "}
            · <Countdown target={start} />
          </>
        )}
      </span>
    </div>
  );
}
