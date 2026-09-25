import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const labels = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" };

export default function AdminRegistrations() {
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error: loadError } = await supabase.from("candidate_registrations").select("*").order("created_at", { ascending: false });
    if (loadError) setError("Gagal memuat pendaftar: " + loadError.message);
    else setRegistrations(data || []);
  }

  async function updateStatus(id, status) {
    setError("");
    const { error: updateError } = await supabase.from("candidate_registrations").update({ status }).eq("id", id);
    if (updateError) setError("Status gagal diperbarui: " + updateError.message);
    else load();
  }

  return <div>
    <h2>Pendaftar calon</h2><p className="admin-sub">Tinjau pendaftaran siswa sebelum ditetapkan sebagai kandidat.</p>
    {error && <div className="banner banner-danger">{error}</div>}
    <div className="card registration-admin-list"><h3>Daftar pendaftar ({registrations.length})</h3>
      {registrations.length === 0 ? <p className="empty-copy">Belum ada pendaftaran masuk.</p> : registrations.map((item) => <article className="registration-item" key={item.id}>
        <div className="registration-item-head"><div><h3>{item.full_name}</h3><p>{item.class_name} · NIS/NISN: {item.student_id}</p></div><span className={`pill pill-${item.status}`}>{labels[item.status]}</span></div>
        <dl><div><dt>Jabatan diminati</dt><dd>{item.desired_position}</dd></div><div><dt>WhatsApp</dt><dd>{item.phone}</dd></div>
          {item.organization_experience && <div><dt>Pengalaman organisasi</dt><dd>{item.organization_experience}</dd></div>}<div><dt>Motivasi</dt><dd>{item.motivation}</dd></div>
        </dl>
        <div className="registration-actions"><button className="btn btn-purple btn-small" onClick={() => updateStatus(item.id, "approved")}>Setujui</button><button className="btn btn-outline btn-small" onClick={() => updateStatus(item.id, "rejected")}>Tolak</button></div>
      </article>)}
    </div>
  </div>;
}
