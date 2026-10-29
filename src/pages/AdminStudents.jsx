import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";

// Satu siswa per baris: "Nama" atau "Nama, Kelas" (tab/; juga boleh).
// Baris tanpa kelas memakai kelas default.
function parseBulk(text, defaultClass) {
  const rows = [];
  const invalid = [];
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const [full_name, class_name] = line.split(delimiter).map((part) => part.trim());
      const finalClass = class_name || defaultClass.trim();
      if (!full_name || !finalClass) invalid.push(line);
      else rows.push({ full_name, class_name: finalClass });
    });
  return { rows, invalid };
}

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ full_name: "", class_name: "" });
  const [bulkText, setBulkText] = useState("");
  const [bulkClass, setBulkClass] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error: loadError } = await supabase
      .from("students")
      .select("*")
      .order("class_name")
      .order("full_name");
    if (loadError) setError("Gagal memuat data siswa: " + loadError.message);
    setStudents(data || []);
  }

  async function addOne(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    const row = {
      full_name: form.full_name.trim(),
      class_name: form.class_name.trim(),
    };
    if (!row.full_name || !row.class_name) {
      return setError("Nama dan kelas wajib diisi.");
    }
    setBusy(true);
    const { error: insertError } = await supabase.from("students").insert(row);
    setBusy(false);
    if (insertError) {
      setError("Gagal menambah siswa: " + insertError.message);
      return;
    }
    setForm({ full_name: "", class_name: form.class_name }); // kelas dipertahankan agar input beruntun lebih cepat
    setInfo(`${row.full_name} berhasil ditambahkan.`);
    load();
  }

  async function addBulk() {
    setError("");
    setInfo("");
    const { rows, invalid } = parseBulk(bulkText, bulkClass);
    if (rows.length === 0) {
      return setError("Tidak ada baris valid. Isi kelas di kolom Kelas, lalu satu nama per baris.");
    }
    // lewati nama yang sudah ada di kelas yang sama
    const existing = new Set(students.map((s) => `${s.class_name}|${s.full_name.toLowerCase()}`));
    const fresh = rows.filter((r) => !existing.has(`${r.class_name}|${r.full_name.toLowerCase()}`));
    const skipped = rows.length - fresh.length;
    if (fresh.length === 0) return setError("Semua nama sudah ada di kelas tersebut.");
    setBusy(true);
    const { error: insertError } = await supabase.from("students").insert(fresh);
    setBusy(false);
    if (insertError) return setError("Gagal impor: " + insertError.message);
    setBulkText("");
    setInfo(
      `${fresh.length} siswa berhasil ditambahkan` +
        (skipped ? `, ${skipped} sudah ada (dilewati)` : "") +
        (invalid.length ? `, ${invalid.length} baris tidak lengkap.` : ".")
    );
    load();
  }

  async function toggleActive(student) {
    setError("");
    const { error: updateError } = await supabase
      .from("students")
      .update({ is_active: !student.is_active })
      .eq("id", student.id);
    if (updateError) return setError(updateError.message);
    load();
  }

  async function remove(student) {
    if (!confirm(`Hapus ${student.full_name}? Siswa yang sudah daftar ulang tidak bisa dihapus (nonaktifkan saja).`)) return;
    setError("");
    const { error: deleteError } = await supabase.from("students").delete().eq("id", student.id);
    if (deleteError) {
      setError(
        deleteError.code === "23503"
          ? "Siswa ini sudah memiliki data daftar ulang, jadi tidak bisa dihapus. Nonaktifkan saja."
          : "Gagal menghapus: " + deleteError.message
      );
      return;
    }
    load();
  }

  const classes = useMemo(
    () => [...new Set(students.map((s) => s.class_name))].filter(Boolean),
    [students]
  );

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      s.full_name.toLowerCase().includes(q) ||
      s.class_name.toLowerCase().includes(q);
    return matchSearch && (!classFilter || s.class_name === classFilter);
  });

  const activeCount = students.filter((s) => s.is_active).length;

  return (
    <div>
      <h2>Data Siswa</h2>
      <p className="admin-sub">
        {students.length} siswa · {activeCount} aktif · Hanya siswa aktif yang muncul di form daftar ulang
      </p>

      {error && <div className="banner banner-danger" style={{ marginBottom: 14 }}>{error}</div>}
      {info && <div className="banner banner-success" style={{ marginBottom: 14 }}>{info}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div className="card">
          <h3>Tambah satu siswa</h3>
          <form onSubmit={addOne}>
            <div className="form-field">
              <label>Nama lengkap</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nama siswa" />
            </div>
            <div className="form-field">
              <label>Kelas</label>
              <input value={form.class_name} onChange={(e) => setForm({ ...form, class_name: e.target.value })} placeholder="mis. X-1" />
            </div>
            <button className="btn btn-purple btn-small" disabled={busy}>
              {busy ? "…" : "Tambah siswa"}
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Impor banyak siswa</h3>
          <p style={{ fontSize: 12.5, color: "var(--color-ink-soft)", marginTop: 0 }}>
            Isi kelas, lalu tempel daftar nama (satu siswa per baris). Nama yang sudah ada di kelas itu dilewati.
          </p>
          <div className="form-field">
            <label>Kelas</label>
            <input value={bulkClass} onChange={(e) => setBulkClass(e.target.value)} placeholder="mis. 8B" />
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={7}
            placeholder={"Budi Santoso\nSiti Aminah"}
            style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 13 }}
          />
          <button className="btn btn-purple btn-small" onClick={addBulk} disabled={busy || !bulkText.trim() || !bulkClass.trim()} style={{ marginTop: 8 }}>
            {busy ? "…" : "Impor siswa"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <h3 style={{ marginBottom: 0 }}>
            Daftar siswa
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-ink-soft)", marginLeft: 8 }}>
              ({filtered.length}{search || classFilter ? ` dari ${students.length}` : ""})
            </span>
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              className="search-input"
              placeholder="Cari nama atau kelas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kelas</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600, fontSize: 14 }}>{s.full_name}</td>
                  <td style={{ fontSize: 13 }}>{s.class_name}</td>
                  <td>
                    <span className={`pill ${s.is_active ? "pill-success" : "pill-muted"}`}>
                      {s.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-outline btn-small" onClick={() => toggleActive(s)}>
                        {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button className="btn btn-danger btn-small" onClick={() => remove(s)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--color-ink-soft)", padding: "24px 0" }}>
                    Belum ada data siswa.
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
