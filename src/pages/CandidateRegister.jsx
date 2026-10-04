import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

const emptyForm = {
  full_name: "",
  class_or_id: "",
  running_mate: "",
  vision: "",
  mission: "",
  contact: "",
  photo_url: "",
};

export default function CandidateRegister() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.from("election_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      setSettings(data || {}); 
      setLoading(false);
    });
  }, []);

  const status = getStatus(settings, loading);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const path = `applications/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("candidate-photos")
      .upload(path, file);

    if (uploadError) {
      setError("Gagal mengunggah foto: " + uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("candidate-photos").getPublicUrl(path);
    update("photo_url", data.publicUrl);
    setUploading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.full_name.trim()) {
      setError("Nama lengkap wajib diisi.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("candidate_applications").insert({
      full_name: form.full_name,
      class_or_id: form.class_or_id || null,
      running_mate: form.running_mate || null,
      vision: form.vision || null,
      mission: form.mission || null,
      contact: form.contact || null,
      photo_url: form.photo_url || null,
    });
    setSubmitting(false);

    if (insertError) {
      setError("Gagal mengirim pendaftaran: " + insertError.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="page">
      <div className="masthead">
        <div className="kicker">Pendaftaran Calon</div>
        <h1>Daftar sebagai Calon Pengurus</h1>
        <div className="org">{settings?.organization || ""}</div>
      </div>

      <div className="page-narrow">
        {done ? (
          <div className="ballot-slip" style={{ textAlign: "center" }}>
            <div className="stamp">✓</div>
            <h2 style={{ fontSize: 20 }}>Pendaftaran diterima</h2>
            <p style={{ color: "var(--color-ink-soft)", marginTop: 8 }}>
              Terima kasih, {form.full_name}. Panitia akan memverifikasi pendaftaranmu.
              Jika lolos, namamu akan muncul di halaman kandidat dengan nomor urut resmi.
            </p>
            <div style={{ marginTop: 20 }}>
              <Link to="/" className="btn btn-outline">
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        ) : status === "loading" ? (
          <div style={{ textAlign: "center", color: "var(--color-ink-soft)", padding: "40px 0" }}>
            Memuat data...
          </div>
        ) : status !== "open" ? (
          <div className="ballot-slip" style={{ textAlign: "center" }}>
            <div
              className="stamp"
              style={{
                borderColor: "var(--color-line)",
                color: "var(--color-ink-soft)",
                transform: "rotate(0deg)",
              }}
            >
              ?
            </div>
            <h2 style={{ fontSize: 20 }}>
              {status === "inactive" && "Pendaftaran Belum Dibuka"}
              {status === "before" && "Pendaftaran Belum Dimulai"}
              {status === "after" && "Pendaftaran Sudah Ditutup"}
            </h2>
            <p style={{ color: "var(--color-ink-soft)", marginTop: 8 }}>
              {status === "inactive" &&
                "Pendaftaran calon pengurus belum diaktifkan oleh panitia. Silakan kembali lagi nanti."}
              {status === "before" && "Pendaftaran calon pengurus baru akan segera dibuka."}
              {status === "after" &&
                "Pendaftaran calon pengurus telah ditutup. Terima kasih atas partisipasinya."}
            </p>
            <div style={{ marginTop: 24 }}>
              <Link to="/" className="btn btn-outline">
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        ) : (
          <form className="ballot-slip" onSubmit={handleSubmit}>
            <div className="form-field">
              <label>Nama lengkap</label>
              <input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required />
            </div>
            <div className="form-field">
              <label>Kelas / NIM / NIS</label>
              <input value={form.class_or_id} onChange={(e) => update("class_or_id", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Nama calon wakil (jika maju berpasangan)</label>
              <input value={form.running_mate} onChange={(e) => update("running_mate", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Visi</label>
              <textarea value={form.vision} onChange={(e) => update("vision", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Misi</label>
              <textarea value={form.mission} onChange={(e) => update("mission", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Nomor WhatsApp / email aktif</label>
              <input value={form.contact} onChange={(e) => update("contact", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Foto (opsional)</label>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} />
              {form.photo_url && (
                <img
                  src={form.photo_url}
                  alt=""
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, marginTop: 6 }}
                />
              )}
            </div>

            {error && <div className="banner banner-danger">{error}</div>}

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-purple" disabled={submitting || uploading}>
                {submitting ? "Mengirim…" : "Kirim pendaftaran"}
              </button>
              <Link to="/" className="btn btn-outline">
                Kembali ke Beranda
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function getStatus(settings, loading) {
  if (loading) return "loading";
  if (!settings || !settings.registration_open) return "inactive";
  const now = Date.now();
  if (settings.registration_start && now < new Date(settings.registration_start).getTime()) return "before";
  if (settings.registration_end && now > new Date(settings.registration_end).getTime()) return "after";
  return "open";
}
