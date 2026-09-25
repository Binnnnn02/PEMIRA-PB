import { supabase } from "../supabaseClient.js";
import { useState } from "react";
import { Link } from "react-router-dom";

const initialForm = {
  full_name: "", student_id: "", class_name: "", phone: "", desired_position: "",
  organization_experience: "", motivation: "",
};

export default function CandidateRegistration() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    const required = ["full_name", "student_id", "class_name", "phone", "desired_position", "motivation"];
    if (required.some((key) => !form[key].trim())) {
      setError("Mohon lengkapi semua kolom wajib.");
      return;
    }
    setStatus("submitting");
    const { error: saveError } = await supabase.from("candidate_registrations").insert({
      full_name: form.full_name.trim(), student_id: form.student_id.trim(), class_name: form.class_name.trim(),
      phone: form.phone.trim(), desired_position: form.desired_position.trim(),
      organization_experience: form.organization_experience.trim() || null, motivation: form.motivation.trim(),
    });
    if (saveError) {
      setStatus("idle");
      setError(saveError.code === "23505" ? "NIS/NISN ini sudah pernah digunakan untuk mendaftar." : "Pendaftaran belum dapat dikirim. Silakan coba lagi.");
      return;
    }
    setStatus("success");
    setForm(initialForm);
  }

  return <div className="page registration-page">
    <div className="masthead"><div className="kicker">Rekrutmen Organisasi</div><h1>Daftar Calon Pengurus</h1><div className="org">Ambil peran, bawa perubahan baik.</div></div>
    <main className="page-narrow">
      {status === "success" ? <section className="ballot-slip registration-success">
        <div className="stamp">✓</div><h2>Pendaftaran terkirim</h2>
        <p>Terima kasih. Panitia akan meninjau data kamu dan menghubungi lewat nomor WhatsApp yang dicantumkan.</p>
        <button className="btn btn-purple" onClick={() => setStatus("idle")}>Daftarkan siswa lain</button>
      </section> : <section className="ballot-slip">
        <h2 className="registration-title">Formulir pendaftaran</h2><p className="registration-intro">Isi data dengan benar. Kolom bertanda * wajib diisi.</p>
        <form onSubmit={submit}>
          <Field label="Nama lengkap *" id="full_name" value={form.full_name} onChange={(v) => update("full_name", v)} autoComplete="name" maxLength={120} />
          <div className="form-grid">
            <Field label="NIS / NISN *" id="student_id" value={form.student_id} onChange={(v) => update("student_id", v)} maxLength={30} />
            <Field label="Kelas *" id="class_name" value={form.class_name} onChange={(v) => update("class_name", v)} placeholder="Contoh: XI IPA 1" maxLength={50} />
          </div>
          <Field label="Nomor WhatsApp *" id="phone" type="tel" value={form.phone} onChange={(v) => update("phone", v)} placeholder="08xxxxxxxxxx" autoComplete="tel" maxLength={30} />
          <Field label="Jabatan yang diminati *" id="desired_position" value={form.desired_position} onChange={(v) => update("desired_position", v)} placeholder="Contoh: Ketua OSIS / Sekretaris" maxLength={100} />
          <Field textarea label="Pengalaman organisasi (opsional)" id="organization_experience" value={form.organization_experience} onChange={(v) => update("organization_experience", v)} maxLength={1000} />
          <Field textarea label="Motivasi menjadi pengurus *" id="motivation" value={form.motivation} onChange={(v) => update("motivation", v)} maxLength={1500} />
          {error && <div className="banner banner-danger">{error}</div>}
          <button className="btn btn-purple" disabled={status === "submitting"}>{status === "submitting" ? "Mengirim pendaftaran…" : "Kirim pendaftaran"}</button>
        </form>
      </section>}
      <Link className="back-link" to="/">← Kembali ke halaman voting</Link>
    </main>
  </div>;
}

function Field({ label, id, value, onChange, textarea, ...props }) {
  return <div className="form-field"><label htmlFor={id}>{label}</label>
    {textarea ? <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} /> : <input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />}
  </div>;
}
