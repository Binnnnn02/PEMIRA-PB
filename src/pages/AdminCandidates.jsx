import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const emptyForm = {
  id: null,
  number: "",
  name: "",
  running_mate: "",
  vision: "",
  mission: "",
  photo_url: "",
};

export default function AdminCandidates() {
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("candidates").select("*").order("number");
    setCandidates(data || []);
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function edit(candidate) {
    setForm(candidate);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");

    const path = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("candidate-photos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Gagal mengunggah foto: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("candidate-photos").getPublicUrl(path);
    updateField("photo_url", data.publicUrl);
    setUploading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const payload = {
      number: Number(form.number),
      name: form.name,
      running_mate: form.running_mate || null,
      vision: form.vision || null,
      mission: form.mission || null,
      photo_url: form.photo_url || null,
    };

    if (!payload.number || !payload.name) {
      setError("Nomor urut dan nama wajib diisi.");
      return;
    }

    const query = form.id
      ? supabase.from("candidates").update(payload).eq("id", form.id)
      : supabase.from("candidates").insert(payload);

    const { error: saveError } = await query;
    if (saveError) {
      setError("Gagal menyimpan: " + saveError.message);
      return;
    }

    resetForm();
    load();
  }

  async function remove(id) {
    if (!confirm("Hapus kandidat ini? Kandidat yang sudah memiliki suara tidak dapat dihapus agar hasil pemilihan tetap aman.")) return;
    setError("");

    const { error: deleteError } = await supabase
      .from("candidates")
      .delete()
      .eq("id", id);

    if (deleteError) {
      const message = deleteError.code === "23503"
        ? "Kandidat tidak bisa dihapus karena sudah memiliki suara."
        : "Gagal menghapus kandidat: " + deleteError.message;
      setError(message);
      return;
    }

    await load();
  }

  return (
    <div>
      <h2>Kandidat</h2>
      <p className="admin-sub">Kelola paslon yang tampil di surat suara.</p>

      {/* Form Card */}
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>
          {form.id ? "✏️ Ubah kandidat" : "＋ Tambah kandidat baru"}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>Nomor urut</label>
              <input
                type="number"
                value={form.number}
                onChange={(e) => updateField("number", e.target.value)}
                min={1}
              />
            </div>
            <div className="form-field">
              <label>Nama calon ketua</label>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Nama calon wakil (opsional)</label>
            <input
              value={form.running_mate || ""}
              onChange={(e) => updateField("running_mate", e.target.value)}
            />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>Visi</label>
              <textarea
                value={form.vision || ""}
                onChange={(e) => updateField("vision", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Misi</label>
              <textarea
                value={form.mission || ""}
                onChange={(e) => updateField("mission", e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Foto</label>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} />
            {form.photo_url && (
              <img
                src={form.photo_url}
                alt=""
                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: "var(--radius-md)", marginTop: 8, border: "1px solid var(--color-border)" }}
              />
            )}
          </div>

          {error && <div className="banner banner-danger">{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn btn-purple btn-small" disabled={uploading}>
              {uploading ? "Mengunggah…" : form.id ? "Simpan perubahan" : "Tambah kandidat"}
            </button>
            {form.id && (
              <button type="button" className="btn btn-outline btn-small" onClick={resetForm}>
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Candidates Table */}
      <div className="card">
        <h3 style={{ marginBottom: 0 }}>Daftar kandidat ({candidates.length})</h3>
        <div style={{ marginTop: 14, overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>No.</th>
                <th style={{ width: 60 }}>Foto</th>
                <th>Nama</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 30, height: 30,
                        background: "var(--color-primary-wash)",
                        color: "var(--color-primary)",
                        borderRadius: "50%",
                        fontWeight: 700, fontSize: 14,
                      }}
                    >
                      {c.number}
                    </span>
                  </td>
                  <td>
                    {c.photo_url ? (
                      <img
                        src={c.photo_url}
                        alt=""
                        style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: "var(--radius-sm)",
                          background: "var(--color-surface-alt)", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          fontSize: 12, color: "var(--color-ink-muted)",
                        }}
                      >
                        —
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {c.name}
                      {c.running_mate ? ` & ${c.running_mate}` : ""}
                    </div>
                    {c.vision && (
                      <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginTop: 2 }}>
                        {c.vision.slice(0, 60)}{c.vision.length > 60 ? "…" : ""}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-outline btn-small" onClick={() => edit(c)}>
                        Ubah
                      </button>
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => remove(c.id)}
                        style={{ fontSize: 12 }}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {candidates.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--color-ink-soft)", padding: "24px 0" }}>
                    Belum ada kandidat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
