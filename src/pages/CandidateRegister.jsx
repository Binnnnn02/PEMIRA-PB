import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

const CLASS_OPTIONS = ["Kelas 7", "Kelas 8A", "Kelas 8B"];
const POSITION_OPTIONS = ["Koordinator", "Anggota"];

// Koordinator hanya untuk kelas 8 (8A/8B); Anggota boleh kelas 7 maupun 8.
function canChooseCoordinator(className) {
  return typeof className === "string" && className.startsWith("Kelas 8");
}

const emptyForm = {
  full_name: "",
  class_or_id: "",
  position: "",
  motto: "",
  motivation: "",
  vision: "",
  mission: "",
  contact: "",
  photo_url: "",
  cv_url: "",
};

function getInitialSettings() {
  try {
    const cached = sessionStorage.getItem("pemira_settings_cache");
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export default function CandidateRegister() {
  const initialSettings = getInitialSettings();
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(!initialSettings);
  const [form, setForm] = useState(emptyForm);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const uploading = uploadingPhoto || uploadingCv;
  const coordinatorAllowed = canChooseCoordinator(form.class_or_id);

  useEffect(() => {
    supabase.from("election_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setSettings(data);
        try { sessionStorage.setItem("pemira_settings_cache", JSON.stringify(data)); } catch {}
      }
      setLoading(false);
    });
  }, []);

  const status = getStatus(settings, loading);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Saat kelas diganti ke kelas 7, pilihan "Koordinator" otomatis turun ke "Anggota".
  function handleClassChange(value) {
    setForm((f) => {
      const mustSwitch =
        value !== "" && f.position === "Koordinator" && !canChooseCoordinator(value);
      return { ...f, class_or_id: value, position: mustSwitch ? "Anggota" : f.position };
    });
  }

  // Unggah berkas ke bucket "candidate-photos" pada folder "applications/",
  // satu-satunya folder yang boleh diunggah oleh pendaftar (lihat supabase/schema.sql).
  async function uploadApplicationFile(file, prefix) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `applications/${prefix}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("candidate-photos")
      .upload(path, file, { contentType: file.type || undefined });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("candidate-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Foto harus berupa gambar (JPG atau PNG).");
      update("photo_url", "");
      e.target.value = "";
      return;
    }

    setUploadingPhoto(true);
    try {
      const url = await uploadApplicationFile(file, "foto");
      update("photo_url", url);
    } catch (uploadError) {
      update("photo_url", "");
      setError("Gagal mengunggah foto: " + uploadError.message);
    }
    setUploadingPhoto(false);
  }

  async function handleCvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      setError("CV harus berupa berkas PDF.");
      update("cv_url", "");
      e.target.value = "";
      return;
    }

    setUploadingCv(true);
    try {
      const url = await uploadApplicationFile(file, "cv");
      update("cv_url", url);
    } catch (uploadError) {
      update("cv_url", "");
      setError("Gagal mengunggah CV: " + uploadError.message);
    }
    setUploadingCv(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (uploading) {
      setError("Tunggu sampai proses unggah selesai.");
      return;
    }
    if (!form.full_name.trim()) {
      setError("Nama lengkap wajib diisi.");
      return;
    }
    if (!form.class_or_id) {
      setError("Kelas wajib dipilih.");
      return;
    }
    if (!form.position) {
      setError("Jabatan yang diinginkan wajib dipilih.");
      return;
    }
    if (form.position === "Koordinator" && !coordinatorAllowed) {
      setError("Jabatan Koordinator hanya untuk kelas 8. Silakan pilih Anggota.");
      return;
    }
    if (!form.motto.trim()) {
      setError("Motto hidup wajib diisi.");
      return;
    }
    if (!form.motivation.trim()) {
      setError("Motivasi/tujuan mendaftar wajib diisi.");
      return;
    }
    if (!form.vision.trim() || !form.mission.trim()) {
      setError("Visi dan misi wajib diisi.");
      return;
    }
    if (!form.contact.trim()) {
      setError("Nomor aktif wajib diisi.");
      return;
    }
    if (!form.photo_url) {
      setError("Foto diri dengan seragam putih biru lengkap wajib diunggah.");
      return;
    }
    if (!form.cv_url) {
      setError("CV dalam bentuk PDF wajib diunggah.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("candidate_applications").insert({
      full_name: form.full_name.trim(),
      class_or_id: form.class_or_id || null,
      position: form.position,
      motto: form.motto.trim() || null,
      motivation: form.motivation || null,
      vision: form.vision || null,
      mission: form.mission || null,
      contact: form.contact.trim() || null,
      photo_url: form.photo_url || null,
      cv_url: form.cv_url || null,
    });
    setSubmitting(false);

    if (insertError) {
      const missingColumn = /schema cache|could not find the .* column|does not exist/i.test(
        insertError.message || ""
      );
      if (missingColumn) console.error("Migrasi database belum dijalankan:", insertError.message);
      setError(
        missingColumn
          ? "Sistem pendaftaran belum siap (basis data belum diperbarui). Silakan hubungi panitia."
          : "Gagal mengirim pendaftaran: " + insertError.message
      );
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
              Terima kasih, {form.full_name}. Kamu mendaftar sebagai {form.position}. Foto diri dan
              CV-mu sudah kami terima. Panitia akan memverifikasi pendaftaranmu. Jika lolos, namamu
              akan muncul di halaman kandidat dengan nomor urut resmi.
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
              <input
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>Kelas</label>
              <select
                value={form.class_or_id}
                onChange={(e) => handleClassChange(e.target.value)}
                required
              >
                <option value="">Pilih kelas</option>
                {CLASS_OPTIONS.map((kelas) => (
                  <option key={kelas} value={kelas}>
                    {kelas}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Jabatan yang diinginkan</label>
              <select
                value={form.position}
                onChange={(e) => update("position", e.target.value)}
                disabled={!form.class_or_id}
                required
              >
                <option value="">
                  {form.class_or_id ? "Pilih jabatan" : "Pilih kelas terlebih dahulu"}
                </option>
                {POSITION_OPTIONS.map((jabatan) => {
                  const blocked = jabatan === "Koordinator" && !coordinatorAllowed;
                  return (
                    <option key={jabatan} value={jabatan} disabled={blocked}>
                      {blocked ? `${jabatan} (hanya kelas 8)` : jabatan}
                    </option>
                  );
                })}
              </select>
              <div className="field-hint">
                Koordinator hanya bisa dipilih oleh kelas 8. Anggota bisa dipilih kelas 7 maupun 8.
              </div>
            </div>

            <div className="form-field">
              <label>Motto Hidup</label>
              <input
                value={form.motto}
                onChange={(e) => update("motto", e.target.value)}
                placeholder="Contoh: Berani jujur, berani memimpin"
                required
              />
            </div>

            <div className="form-field">
              <label>Motivasi/Tujuan Mendaftar</label>
              <textarea
                value={form.motivation}
                onChange={(e) => update("motivation", e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>Visi</label>
              <textarea value={form.vision} onChange={(e) => update("vision", e.target.value)} required />
            </div>

            <div className="form-field">
              <label>Misi</label>
              <textarea value={form.mission} onChange={(e) => update("mission", e.target.value)} required />
            </div>

            <div className="form-field">
              <label>Nomor aktif</label>
              <input
                value={form.contact}
                onChange={(e) => update("contact", e.target.value)}
                placeholder="Contoh: 0812xxxxxxx"
                required
              />
            </div>

            <div className="form-field">
              <label>Foto Diri Menggunakan Seragam Putih Biru Lengkap</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                required={!form.photo_url}
              />
              <div className="field-hint">
                {uploadingPhoto
                  ? "Mengunggah foto…"
                  : "Format JPG atau PNG. Wajib memakai seragam putih biru lengkap."}
              </div>
              {form.photo_url && (
                <img
                  src={form.photo_url}
                  alt="Pratinjau foto diri"
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, marginTop: 6 }}
                />
              )}
            </div>

            {error && <div className="banner banner-danger">{error}</div>}

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn-purple" disabled={submitting || uploading}>
                {submitting ? "Mengirim…" : uploading ? "Mengunggah…" : "Kirim pendaftaran"}
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