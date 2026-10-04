import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

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

  const TABS = [
    { key: "pending",  label: "Menunggu",  count: applications.filter(a => a.status === "pending").length },
    { key: "approved", label: "Diterima",  count: applications.filter(a => a.status === "approved").length },
    { key: "rejected", label: "Ditolak",   count: applications.filter(a => a.status === "rejected").length },
  ];

  const STATUS_PILL = {
    pending:  { cls: "pill-warn",    label: "Menunggu" },
    approved: { cls: "pill-success", label: "Diterima" },
    rejected: { cls: "pill-danger",  label: "Ditolak" },
  };

  return (
    <div>
      <h2>Pendaftaran Calon</h2>
      <p className="admin-sub">
        {pendingCount > 0
          ? `${pendingCount} pendaftaran menunggu verifikasi`
          : "Semua pendaftaran sudah diproses"}
      </p>

      {/* Tab Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              border: "1.5px solid",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              transition: "all .15s",
              ...(filter === t.key
                ? { background: "var(--color-ink)", color: "#fff", borderColor: "var(--color-ink)" }
                : { background: "transparent", color: "var(--color-ink-soft)", borderColor: "var(--color-border)" }),
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  background: filter === t.key ? "rgba(255,255,255,.2)" : "var(--color-surface-alt)",
                  color: filter === t.key ? "#fff" : "var(--color-ink-soft)",
                  padding: "1px 7px",
                  borderRadius: "var(--radius-pill)",
                  fontSize: 11,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="banner banner-danger">{error}</div>}

      {filtered.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            color: "var(--color-ink-soft)",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          Tidak ada data di kategori ini.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {filtered.map((app) => (
          <div
            key={app.id}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              padding: "18px 20px",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              {app.photo_url ? (
                <img
                  src={app.photo_url}
                  alt=""
                  style={{
                    width: 60, height: 60, borderRadius: "var(--radius-md)",
                    objectFit: "cover", flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 60, height: 60, borderRadius: "var(--radius-md)",
                    background: "var(--color-primary-wash)", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, fontWeight: 700, color: "var(--color-primary)",
                  }}
                >
                  {app.full_name?.[0] || "?"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {app.full_name}
                    {app.running_mate ? ` & ${app.running_mate}` : ""}
                  </span>
                  <span className={`pill ${STATUS_PILL[app.status]?.cls}`}>
                    {STATUS_PILL[app.status]?.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-ink-soft)" }}>
                  {app.class_or_id || "—"}
                  {app.contact ? ` · ${app.contact}` : ""}
                </div>
              </div>
            </div>

            {/* Vision / Mission */}
            {(app.vision || app.mission) && (
              <div
                style={{
                  marginTop: 14,
                  padding: "12px 14px",
                  background: "var(--color-surface-alt)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {app.vision && (
                  <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                    <strong>Visi:</strong> {app.vision}
                  </p>
                )}
                {app.mission && (
                  <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                    <strong>Misi:</strong> {app.mission}
                  </p>
                )}
              </div>
            )}

            {app.admin_note && (
              <p style={{ fontSize: 13, marginTop: 10, color: "var(--color-danger)", margin: "10px 0 0" }}>
                Catatan admin: {app.admin_note}
              </p>
            )}

            {app.status === "pending" && (
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  className="btn btn-purple btn-small"
                  onClick={() => approve(app)}
                  disabled={busyId === app.id}
                >
                  ✓ Terima & jadikan kandidat
                </button>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => reject(app)}
                  disabled={busyId === app.id}
                >
                  ✕ Tolak
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
