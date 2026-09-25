import { supabase } from "../supabaseClient.js";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.from("election_settings").select("*").eq("id", 1).single().then(({ data }) => setSettings(data));
  }, []);

  const status = getStatus(settings);

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
        <div className="kicker">
          <Link to="/">← Kembali</Link>
        </div>
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
          </div>
        ) : status !== "open" ? (
          <div className="banner banner-danger">
            {status === "inactive" && "Pendaftaran calon belum dibuka oleh panitia."}
            {status === "before" && "Pendaftaran calon belum dimulai."}
            {status === "after" && "Pendaftaran calon sudah ditutup."}
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

            <div style={{ marginTop: 12 }}>
              <button className="btn btn-purple" disabled={submitting || uploading}>
                {submitting ? "Mengirim…" : "Kirim pendaftaran"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function getStatus(settings) {
  if (!settings) return "loading";
  if (!settings.registration_open) return "inactive";
  const now = Date.now();
  if (settings.registration_start && now < new Date(settings.registration_start).getTime()) return "before";
  if (settings.registration_end && now > new Date(settings.registration_end).getTime()) return "after";
  return "open";
}
