import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode() {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => CODE_CHARS[value % CODE_CHARS.length]).join("");
}

function makeMessage(row, code) {
  return `Halo ${row.students?.full_name || "Siswa"}.\n\nBerikut akses PEMIRA kamu:\nNama: ${row.students?.full_name || "-"}\nNIS: ${row.students?.nis || "-"}\nToken: ${code}\n\nGunakan token tersebut saat pemungutan suara. Jangan membagikan token kepada orang lain.`;
}

const STATUS_LABEL = {
  registered:  { label: "Terdaftar",     cls: "pill-muted" },
  token_ready: { label: "Token siap",    cls: "pill-warn" },
  sent:        { label: "Terkirim",      cls: "pill-success" },
};

export default function AdminReregistrations() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error: loadError } = await supabase
      .from("re_registrations")
      .select("*, students(full_name, nis, class_name), voters(id, code, token_sent_at)")
      .eq("election_id", 1)
      .order("created_at", { ascending: false });
    if (loadError) setError(loadError.message);
    setRows(data || []);
  }

  async function generateToken(row) {
    setError("");
    setMessage("");
    setBusyId(row.id);
    const existing = Array.isArray(row.voters) ? row.voters[0] : row.voters;
    let code = existing?.code;

    if (!existing) {
      code = generateCode();
      const { error: insertError } = await supabase.from("voters").insert({
        code,
        name: row.students?.full_name || null,
        student_id: row.student_id,
        registration_id: row.id,
      });
      if (insertError) {
        setError(insertError.message);
        setBusyId(null);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("re_registrations")
      .update({ status: "token_ready", token_sent_at: existing?.token_sent_at || null })
      .eq("id", row.id);

    if (updateError) setError(updateError.message);
    else {
      setMessage(makeMessage(row, code));
      await load();
    }
    setBusyId(null);
  }

  async function markSent(row) {
    const voter = Array.isArray(row.voters) ? row.voters[0] : row.voters;
    if (!voter) return setError("Buat token terlebih dahulu.");
    const { error: updateError } = await supabase
      .from("re_registrations")
      .update({ status: "sent", token_sent_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) setError(updateError.message);
    else load();
  }

  function copyMessage(row) {
    const voter = Array.isArray(row.voters) ? row.voters[0] : row.voters;
    if (!voter?.code) return setError("Buat token terlebih dahulu.");
    const text = makeMessage(row, voter.code);
    navigator.clipboard.writeText(text);
    setMessage(text);
  }

  const filtered = rows.filter((row) => {
    const query = search.toLowerCase();
    return [row.students?.full_name, row.students?.nis, row.students?.class_name, row.phone_number]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  return (
    <div>
      <h2>Daftar Ulang PEMIRA</h2>
      <p className="admin-sub">
        {rows.length} pendaftar · Kelola token dan distribusi via WhatsApp
      </p>

      {error && <div className="banner banner-danger" style={{ marginBottom: 14 }}>{error}</div>}

      {/* WhatsApp message preview */}
      {message && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ marginBottom: 0 }}>Pesan WhatsApp</h3>
            <button
              className="btn btn-purple btn-small"
              onClick={() => navigator.clipboard.writeText(message)}
            >
              Salin pesan
            </button>
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              lineHeight: 1.7,
              background: "var(--color-surface-alt)",
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              margin: 0,
            }}
          >
            {message}
          </pre>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="toolbar">
          <h3 style={{ marginBottom: 0 }}>
            Pendaftar
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-ink-soft)", marginLeft: 8 }}>
              ({filtered.length}{search ? ` dari ${rows.length}` : ""})
            </span>
          </h3>
          <input
            className="search-input"
            placeholder="Cari nama, NIS, kelas…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 220 }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Kelas</th>
                <th>WhatsApp</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const voter = Array.isArray(row.voters) ? row.voters[0] : row.voters;
                const s = STATUS_LABEL[row.status] || { label: row.status, cls: "pill-muted" };
                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {row.students?.full_name || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-ink-soft)", marginTop: 1 }}>
                        NIS: {row.students?.nis || "belum diisi"}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{row.students?.class_name || "—"}</td>
                    <td>
                      <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                        {row.phone_number}
                      </code>
                    </td>
                    <td>
                      <span className={`pill ${s.cls}`}>{s.label}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn btn-outline btn-small"
                          disabled={busyId === row.id}
                          onClick={() => generateToken(row)}
                        >
                          {voter ? "Lihat token" : "Buat token"}
                        </button>
                        {voter && (
                          <button
                            className="btn btn-outline btn-small"
                            onClick={() => copyMessage(row)}
                          >
                            Salin WA
                          </button>
                        )}
                        {voter && row.status !== "sent" && (
                          <button
                            className="btn btn-purple btn-small"
                            onClick={() => markSent(row)}
                          >
                            ✓ Tandai terkirim
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--color-ink-soft)", padding: "24px 0" }}>
                    Belum ada pendaftar.
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
