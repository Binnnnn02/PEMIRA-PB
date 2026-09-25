import { supabase } from "../supabaseClient.js";
import { useEffect, useState } from "react";

export default function AdminApplications() {
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();

    const channel = supabase
      .channel("applications-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "candidate_applications" },
        () => load()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function load() {
    const { data } = await supabase
      .from("candidate_applications")
      .select("*")
      .order("created_at", { ascending: false });
    setApplications(data || []);
  }

  async function approve(app) {
    setBusyId(app.id);
    setError("");

    const { data: existing } = await supabase
      .from("candidates")
      .select("number")
      .order("number", { ascending: false })
      .limit(1);

    const nextNumber = existing && existing.length > 0 ? existing[0].number + 1 : 1;

    const { error: insertError } = await supabase.from("candidates").insert({
      number: nextNumber,
      name: app.full_name,
      running_mate: app.running_mate,
      vision: app.vision,
      mission: app.mission,
      photo_url: app.photo_url,
    });

    if (insertError) {
      setError("Gagal membuat kandidat: " + insertError.message);
      setBusyId(null);
      return;
    }

    await supabase
      .from("candidate_applications")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", app.id);

    setBusyId(null);
    load();
  }

  async function reject(app) {
    const note = prompt("Alasan penolakan (opsional, tidak wajib):", "");
    if (note === null) return;
    setBusyId(app.id);
    await supabase
      .from("candidate_applications")
      .update({ status: "rejected", admin_note: note || null, reviewed_at: new Date().toISOString() })
      .eq("id", app.id);
    setBusyId(null);
    load();
  }

  const filtered = applications.filter((a) => a.status === filter);
  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <div>
      <h2>Pendaftaran Calon</h2>
      <p className="admin-sub">
        {pendingCount} pendaftaran menunggu verifikasi
      </p>

      <div className="toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          {["pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              className="btn btn-outline btn-small"
              style={
                filter === s
                  ? { background: "var(--color-ink)", color: "#fff", borderColor: "var(--color-ink)" }
                  : {}
              }
              onClick={() => setFilter(s)}
            >
              {{ pending: "Menunggu", approved: "Diterima", rejected: "Ditolak" }[s]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="banner banner-danger">{error}</div>}

      {filtered.length === 0 && (
        <p style={{ color: "var(--color-ink-soft)" }}>Tidak ada data di kategori ini.</p>
      )}

      <div className="application-grid">
        {filtered.map((app) => (
          <div className="card" key={app.id}>
            <div style={{ display: "flex", gap: 14 }}>
              {app.photo_url ? (
                <img
                  src={app.photo_url}
                  alt=""
                  style={{ width: 56, height: 56, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 4,
                    background: "var(--color-paper-alt)",
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ marginBottom: 2 }}>
                  {app.full_name}
                  {app.running_mate ? ` & ${app.running_mate}` : ""}
                </h3>
                <div style={{ fontSize: 13, color: "var(--color-ink-soft)" }}>
                  {app.class_or_id || "—"} {app.contact ? `· ${app.contact}` : ""}
                </div>
              </div>
            </div>

            {app.vision && (
              <p style={{ fontSize: 13, marginTop: 12 }}>
                <strong>Visi:</strong> {app.vision}
              </p>
            )}
            {app.mission && (
              <p style={{ fontSize: 13, marginTop: 6 }}>
                <strong>Misi:</strong> {app.mission}
              </p>
            )}
            {app.admin_note && (
              <p style={{ fontSize: 13, marginTop: 6, color: "var(--color-danger)" }}>
                Catatan: {app.admin_note}
              </p>
            )}

            {app.status === "pending" && (
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  className="btn btn-purple btn-small"
                  onClick={() => approve(app)}
                  disabled={busyId === app.id}
                >
                  Terima &amp; jadikan kandidat
                </button>
                <button
                  className="btn btn-outline btn-small"
                  onClick={() => reject(app)}
                  disabled={busyId === app.id}
                >
                  Tolak
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
