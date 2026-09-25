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

export default function AdminSettings() {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("election_settings")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => setForm(data));
  }, []);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const { error: updateError } = await supabase
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
      })
      .eq("id", 1);

    if (updateError) {
      setError("Gagal menyimpan: " + updateError.message);
      return;
    }
    setSaved(true);
  }

  if (!form) return <div>Memuat…</div>;

  return (
    <div>
      <h2>Pengaturan</h2>
      <p className="admin-sub">Atur identitas pemilu dan jendela waktu pemungutan suara.</p>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Judul pemilu</label>
            <input value={form.title || ""} onChange={(e) => update("title", e.target.value)} />
          </div>
          <div className="form-field">
            <label>Nama organisasi</label>
            <input
              value={form.organization || ""}
              onChange={(e) => update("organization", e.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Tagline (opsional, tampil di halaman utama)</label>
          <input
            value={form.tagline || ""}
            onChange={(e) => update("tagline", e.target.value)}
            placeholder="mis. Bersama Membangun Perubahan"
          />
        </div>

        <h3 style={{ marginTop: 24 }}>Pendaftaran calon pengurus</h3>
        <div className="form-grid">
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
        <div className="form-field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            id="registration_open"
            checked={!!form.registration_open}
            onChange={(e) => update("registration_open", e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <label htmlFor="registration_open" style={{ marginBottom: 0 }}>
            Buka pendaftaran calon pengurus
          </label>
        </div>

        <h3 style={{ marginTop: 24 }}>Pemungutan suara</h3>
        <div className="form-grid">
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

        <div className="form-field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            id="is_active"
            checked={!!form.is_active}
            onChange={(e) => update("is_active", e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <label htmlFor="is_active" style={{ marginBottom: 0 }}>
            Aktifkan pemungutan suara
          </label>
        </div>

        <p className="field-hint" style={{ textAlign: "left" }}>
          Selama nonaktif, halaman voting akan menampilkan status "belum dibuka" meski
          pemilih memasukkan kode yang benar. Aturan yang sama berlaku untuk pendaftaran calon.
        </p>

        {error && <div className="banner banner-danger">{error}</div>}
        {saved && <div className="banner banner-success">Pengaturan tersimpan.</div>}

        <div style={{ marginTop: 10 }}>
          <button className="btn btn-purple btn-small">Simpan pengaturan</button>
        </div>
      </form>
    </div>
  );
}
