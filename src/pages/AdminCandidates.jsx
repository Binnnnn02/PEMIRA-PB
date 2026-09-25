import { supabase } from "../supabaseClient.js";
import { useEffect, useState } from "react";

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
    if (!confirm("Hapus kandidat ini? Suara yang sudah masuk untuk kandidat ini tidak bisa dihapus bersamaan.")) return;
    await supabase.from("candidates").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <h2>Kandidat</h2>
      <p className="admin-sub">Kelola paslon yang tampil di surat suara.</p>

      <div className="card">
        <h3>{form.id ? "Ubah kandidat" : "Tambah kandidat"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label>Nomor urut</label>
              <input
                type="number"
                value={form.number}
                onChange={(e) => updateField("number", e.target.value)}
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
          <div className="form-field">
            <label>Foto</label>
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

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn btn-purple btn-small" disabled={uploading}>
              {form.id ? "Simpan perubahan" : "Tambah kandidat"}
            </button>
            {form.id && (
              <button type="button" className="btn btn-outline btn-small" onClick={resetForm}>
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Daftar kandidat ({candidates.length})</h3>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Nama</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id}>
                <td>{c.number}</td>
                <td>
                  {c.name}
                  {c.running_mate ? ` & ${c.running_mate}` : ""}
                </td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-outline btn-small" onClick={() => edit(c)}>
                    Ubah
                  </button>
                  <button className="btn btn-outline btn-small" onClick={() => remove(c.id)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "var(--color-ink-soft)" }}>
                  Belum ada kandidat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
