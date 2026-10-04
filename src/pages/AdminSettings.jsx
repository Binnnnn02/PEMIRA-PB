import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

function toLocalInputValue(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 0 }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".07em",
          color: "var(--color-ink-soft)",
          marginBottom: 14,
          marginTop: 24,
          paddingBottom: 8,
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Toggle({ id, checked, onChange, label }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        userSelect: "none",
        marginBottom: 0,
      }}
    >
      <div
        style={{
          width: 40, height: 22,
          borderRadius: 999,
          background: checked ? "var(--color-primary)" : "var(--color-border)",
          position: "relative",
          transition: "background .2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 3, left: checked ? 21 : 3,
            width: 16, height: 16,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
            transition: "left .2s",
          }}
        />
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        />
      </div>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
    </label>
  );
}

export default function AdminSettings() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("election_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        setForm(data || {});
        setLoading(false);
      });
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const { data, error: updateError } = await supabase
      .from("election_settings")
      .update({
        title: form.title,
        organization: form.organization,
        tagline: form.tagline,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
        is_active: form.is_active,
        registration_start: form.registration_start
          ? new Date(form.registration_start).toISOString()
          : null,
        registration_end: form.registration_end
          ? new Date(form.registration_end).toISOString()
          : null,
        registration_open: form.registration_open,
        reregistration_start: form.reregistration_start
          ? new Date(form.reregistration_start).toISOString()
          : null,
        reregistration_end: form.reregistration_end
          ? new Date(form.reregistration_end).toISOString()
          : null,
        reregistration_open: form.reregistration_open,
      })
      .eq("id", 1)
      .select();

    if (updateError) {
      setError("Gagal menyimpan: " + updateError.message);
      return;
    }
    if (!data || data.length === 0) {
      setError("Tidak ada data yang tersimpan. Cek baris id=1 dan policy RLS, atau login ulang.");
      return;
    }
    try {
      sessionStorage.setItem("pemira_settings_cache", JSON.stringify(data[0]));
    } catch {}
    setSaved(true);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--color-ink-soft)", paddingTop: 40 }}>
        <div
          style={{
            width: 18, height: 18, border: "2px solid var(--color-border)",
            borderTopColor: "var(--color-primary)", borderRadius: "50%",
            animation: "spin .7s linear infinite",
          }}
        />
        Memuat pengaturan…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h2>Pengaturan</h2>
      <p className="admin-sub">Atur identitas pemilu dan jendela waktu pemungutan suara.</p>

      <form onSubmit={handleSubmit}>
        {/* Identity */}
        <div className="card">
          <Section title="Identitas Pemilu">
            <div className="form-grid">
              <div className="form-field">
                <label>Judul pemilu</label>
                <input
                  value={form.title || ""}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="PEMIRA 2026"
                />
              </div>
              <div className="form-field">
                <label>Nama organisasi</label>
                <input
                  value={form.organization || ""}
                  onChange={(e) => update("organization", e.target.value)}
                  placeholder="SMP Permata Bunda"
                />
              </div>
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Tagline (opsional, tampil di halaman utama)</label>
              <input
                value={form.tagline || ""}
                onChange={(e) => update("tagline", e.target.value)}
                placeholder="mis. Bersama Membangun Perubahan"
              />
            </div>
          </Section>
        </div>

        {/* Registration */}
        <div className="card">
          <Section title="Pendaftaran Calon Pengurus">
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-field">
                <label>Mulai pendaftaran</label>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(form.registration_start)}
                  onChange={(e) => update("registration_start", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Selesai pendaftaran</label>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(form.registration_end)}
                  onChange={(e) => update("registration_end", e.target.value)}
                />
              </div>
            </div>
            <Toggle
              id="registration_open"
              checked={!!form.registration_open}
              onChange={(e) => update("registration_open", e.target.checked)}
              label="Buka pendaftaran calon pengurus"
            />
          </Section>
        </div>

        {/* Re-registration */}
        <div className="card">
          <Section title="Daftar Ulang PEMIRA">
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-field">
                <label>Mulai daftar ulang</label>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(form.reregistration_start)}
                  onChange={(e) => update("reregistration_start", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Selesai daftar ulang</label>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(form.reregistration_end)}
                  onChange={(e) => update("reregistration_end", e.target.value)}
                />
              </div>
            </div>
            <Toggle
              id="reregistration_open"
              checked={!!form.reregistration_open}
              onChange={(e) => update("reregistration_open", e.target.checked)}
              label="Buka daftar ulang PEMIRA"
            />
          </Section>
        </div>

        {/* Voting */}
        <div className="card">
          <Section title="Pemungutan Suara">
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div className="form-field">
                <label>Mulai voting</label>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(form.start_time)}
                  onChange={(e) => update("start_time", e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Selesai voting</label>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(form.end_time)}
                  onChange={(e) => update("end_time", e.target.value)}
                />
              </div>
            </div>
            <Toggle
              id="is_active"
              checked={!!form.is_active}
              onChange={(e) => update("is_active", e.target.checked)}
              label="Aktifkan pemungutan suara"
            />
            <p
              style={{
                fontSize: 12.5,
                color: "var(--color-ink-muted)",
                marginTop: 12,
                marginBottom: 0,
                lineHeight: 1.6,
              }}
            >
              Selama nonaktif, halaman voting akan menampilkan status "belum dibuka" meski pemilih memasukkan kode
              yang benar. Aturan yang sama berlaku untuk pendaftaran calon dan daftar ulang.
            </p>
          </Section>
        </div>

        {error && <div className="banner banner-danger">{error}</div>}
        {saved && <div className="banner banner-success">✓ Pengaturan tersimpan.</div>}

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-purple" style={{ width: "auto", padding: "11px 28px" }}>
            Simpan pengaturan
          </button>
        </div>
      </form>
    </div>
  );
}
