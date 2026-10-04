import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I agar tak rancu
const CODE_LENGTH = 6;

function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export default function AdminVoters() {
  const [voters, setVoters] = useState([]);
  const [name, setName] = useState("");
  const [bulkCount, setBulkCount] = useState(10);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("voters")
      .select("*")
      .order("created_at", { ascending: false });
    setVoters(data || []);
  }

  async function addOne(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const code = generateCode();
    const { error: insertError } = await supabase
      .from("voters")
      .insert({ code, name: name || null });
    setBusy(false);
    if (insertError) {
      setError("Gagal menambah pemilih: " + insertError.message);
      return;
    }
    setName("");
    load();
  }

  async function addBulk() {
    const count = Number(bulkCount);
    if (!count || count < 1 || count > 500) {
      setError("Masukkan jumlah antara 1 dan 500.");
      return;
    }
    setError("");
    setBusy(true);
    const rows = Array.from({ length: count }, () => ({ code: generateCode() }));
    const { error: insertError } = await supabase.from("voters").insert(rows);
    setBusy(false);
    if (insertError) {
      setError("Gagal membuat kode massal: " + insertError.message);
      return;
    }
    load();
  }

  async function remove(id) {
    if (!confirm("Hapus pemilih ini? Pemilih yang sudah memberikan suara tidak dapat dihapus.")) return;
    setError("");

    const { error: deleteError } = await supabase
      .from("voters")
      .delete()
      .eq("id", id);

    if (deleteError) {
      const message = deleteError.code === "23503"
        ? "Pemilih tidak bisa dihapus karena sudah memiliki suara. Pertahankan data ini agar riwayat PEMIRA tetap utuh."
        : "Gagal menghapus pemilih: " + deleteError.message;
      setError(message);
      return;
    }

    await load();
  }

  function downloadCsv() {
    const rows = [["nama", "kode", "sudah_memilih"]];
    voters.forEach((v) => rows.push([v.name || "", v.code, v.has_voted ? "ya" : "belum"]));
    const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kode-pemilih-pemira.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = voters.filter((v) => {
    const q = search.toLowerCase();
    return (v.name || "").toLowerCase().includes(q) || v.code.toLowerCase().includes(q);
  });

  const votedCount = voters.filter((v) => v.has_voted).length;
  const unvotedCount = voters.length - votedCount;

  return (
    <div>
      <h2>Pemilih</h2>
      <p className="admin-sub">
        {voters.length} pemilih · {votedCount} sudah memilih · {unvotedCount} belum
      </p>

      {/* Action Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div className="card">
          <h3>Tambah satu pemilih</h3>
          <form onSubmit={addOne} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div className="form-field" style={{ flex: 1, marginBottom: 0 }}>
              <label>Nama (opsional)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama siswa"
              />
            </div>
            <button className="btn btn-purple btn-small" disabled={busy}>
              {busy ? "…" : "Tambah & buat kode"}
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Buat kode massal</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Jumlah kode</label>
              <input
                type="number"
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                style={{ width: 100 }}
                min={1} max={500}
              />
            </div>
            <button className="btn btn-purple btn-small" onClick={addBulk} disabled={busy}>
              {busy ? "…" : "Buat kode"}
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--color-ink-soft)", marginTop: 8, marginBottom: 0 }}>
            Kode tanpa nama — untuk pemilih anonim. Unduh CSV untuk distribusi.
          </p>
        </div>
      </div>

      {error && <div className="banner banner-danger" style={{ marginBottom: 14 }}>{error}</div>}

      {/* Table */}
      <div className="card">
        <div className="toolbar">
          <h3 style={{ marginBottom: 0 }}>
            Daftar pemilih
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-ink-soft)", marginLeft: 8 }}>
              ({filtered.length}{search ? ` dari ${voters.length}` : ""})
            </span>
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="search-input"
              placeholder="Cari nama atau kode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <button className="btn btn-outline btn-small" onClick={downloadCsv}>
              ↓ Unduh CSV
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kode</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.name || <span style={{ color: "var(--color-ink-muted)" }}>—</span>}
                  </td>
                  <td>
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        background: "var(--color-surface-alt)",
                        padding: "3px 8px",
                        borderRadius: "var(--radius-sm)",
                        letterSpacing: ".08em",
                      }}
                    >
                      {v.code}
                    </code>
                  </td>
                  <td>
                    <span className={`pill ${v.has_voted ? "pill-success" : "pill-muted"}`}>
                      {v.has_voted ? "✓ Sudah memilih" : "Belum memilih"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-danger btn-small" onClick={() => remove(v.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--color-ink-soft)", padding: "24px 0" }}>
                    Tidak ada data.
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

function escapeCsv(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}
