import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient.js";

// Mengurai teks tempel (dari Excel/Sheets = tab, atau CSV) menjadi baris siswa.
// Format per baris: NIS, Nama Lengkap, Kelas
function parseBulk(text) {
  const valid = [];
  const invalid = [];
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const [nis, full_name, class_name] = line.split(delimiter).map((part) => part.trim());
      // lewati baris header
      if (index === 0 && /^nis$/i.test(nis || "")) return;
      if (!nis || !full_name || !class_name) invalid.push(line);
      else valid.push({ nis, full_name, class_name });
    });

  // hapus duplikat NIS di dalam tempelan (ambil yang terakhir)
  const unique = [...new Map(valid.map((row) => [row.nis, row])).values()];
  return { rows: unique, invalid };
}

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ nis: "", full_name: "", class_name: "" });
  const [bulkText, setBulkText] = useState("");
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
      nis: form.nis.trim(),
      full_name: form.full_name.trim(),
      class_name: form.class_name.trim(),
    };
    if (!row.nis || !row.full_name || !row.class_name) {
      return setError("NIS, nama, dan kelas wajib diisi.");
    }
    setBusy(true);
    const { error: insertError } = await supabase.from("students").insert(row);
    setBusy(false);
    if (insertError) {
      setError(
        insertError.code === "23505"
          ? `NIS ${row.nis} sudah terdaftar.`
          : "Gagal menambah siswa: " + insertError.message
      );
      return;
    }
    setForm({ nis: "", full_name: "", class_name: form.class_name }); // kelas dipertahankan agar input beruntun lebih cepat
    setInfo(`${row.full_name} berhasil ditambahkan.`);
    load();
  }

  async function addBulk() {
    setError("");
    setInfo("");
    const { rows, invalid } = parseBulk(bulkText);
    if (rows.length === 0) {
      return setError("Tidak ada baris valid. Format: NIS, Nama Lengkap, Kelas (satu siswa per baris).");
    }
    setBusy(true);
    // upsert per NIS: NIS baru ditambahkan, NIS yang sudah ada diperbarui nama/kelasnya
    const { error: upsertError } = await supabase
      .from("students")
      .upsert(rows, { onConflict: "nis" });
    setBusy(false);
    if (upsertError) {
      return setError("Gagal impor: " + upsertError.message);
    }
    setBulkText("");
    setInfo(
      `${rows.length} siswa berhasil diimpor` +
        (invalid.length ? `, ${invalid.length} baris dilewati karena tidak lengkap.` : ".")
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
      s.nis.toLowerCase().includes(q) ||
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
              <label>NIS</label>
              <input value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} placeholder="Nomor induk siswa" />
            </div>
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
            Tempel dari Excel/Sheets (3 kolom: NIS, Nama, Kelas) atau CSV. Satu siswa per baris.
            NIS yang sudah ada akan diperbarui nama dan kelasnya.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={7}
            placeholder={"12345, Budi Santoso, X-1\n12346, Siti Aminah, X-1"}
            style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 13 }}
          />
          <button className="btn btn-purple btn-small" onClick={addBulk} disabled={busy || !bulkText.trim()} style={{ marginTop: 8 }}>
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
              placeholder="Cari nama, NIS, kelas…"
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
                <th>NIS</th>
                <th>Nama</th>
                <th>Kelas</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td><code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{s.nis}</code></td>
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
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--color-ink-soft)", padding: "24px 0" }}>
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
