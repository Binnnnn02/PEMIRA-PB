import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient.js";
import Countdown from "../components/Countdown.jsx";

export default function VotePage() {
  const [settings, setSettings] = useState(null);
  const [students, setStudents] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [className, setClassName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [selected, setSelected] = useState("");
  const [step, setStep] = useState("select");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("election_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("student_directory").select("id, full_name, class_name").order("full_name"),
    ]).then(([settingsResult, rosterResult]) => {
      if (settingsResult.data) setSettings(settingsResult.data);
      if (rosterResult.error) setError("Gagal memuat daftar siswa. Silakan coba lagi.");
      setStudents(rosterResult.data || []);
    });
  }, []);

  const status = getWindowStatus(settings);
  const classes = [...new Set(students.map((student) => student.class_name).filter(Boolean))]
    .sort(new Intl.Collator("id", { numeric: true, sensitivity: "base" }).compare);
  const studentsInClass = students.filter((student) => student.class_name === className);

  async function continueToBallot() {
    setError("");
    if (!className) return setError("Pilih kelasmu terlebih dahulu.");
    if (!studentId) return setError("Pilih namamu dari daftar siswa.");
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("check_student_vote", { p_student_id: studentId });
    setBusy(false);
    if (rpcError || !data?.valid) return setError("Nama siswa tidak ditemukan atau sudah tidak aktif.");
    if (data.status === "voted") return setError("Nama ini sudah tercatat memilih.");
    setStudentName(data.name);
    const { data: rows, error: candidatesError } = await supabase.from("candidates").select("*").order("number");
    if (candidatesError) return setError("Gagal memuat daftar kandidat.");
    setCandidates(rows || []);
    setStep("ballot");
  }

  async function submitVote() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("cast_student_vote", {
      p_student_id: studentId,
      p_candidate_id: selected,
    });
    setBusy(false);
    if (rpcError || !data?.success) {
      if (data?.reason === "already_voted") {
        setStep("done");
        return;
      }
      setError(data?.reason === "not_active" ? "Pemungutan suara sedang ditutup." : "Suara gagal dikirim. Silakan coba lagi.");
      return;
    }
    setStep("done");
  }

  return <div className="page">
    <div className="masthead"><div className="kicker">Bilik Suara Digital</div><h1>{settings?.title || "PEMIRA"}</h1><div className="org">{settings?.organization || ""}</div></div>
    <div className="page-narrow">
      {["before", "after", "inactive"].includes(status.type) && <div className="banner banner-danger" style={{ marginBottom: 18 }}>
        {status.type === "before" ? <>Pemungutan suara dibuka dalam <Countdown target={settings?.start_time} /></> : status.type === "after" ? "Pemungutan suara telah ditutup." : "Pemungutan suara belum dibuka oleh panitia."}
      </div>}
      {step === "select" && <div className="ballot-slip">
        <h2 style={{ fontSize: 18, textAlign: "center" }}>Pilih kelas dan namamu</h2>
        <p style={{ color: "var(--color-ink-soft)", textAlign: "center" }}>Pilih kelasmu terlebih dahulu. Daftar nama akan menampilkan siswa dari kelas itu saja.</p>
        <div className="form-field"><label>Kelas</label><select value={className} onChange={(e) => { setClassName(e.target.value); setStudentId(""); setError(""); }}>
          <option value="">Pilih kelas</option>{classes.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></div>
        <div className="form-field"><label>Nama siswa</label><select value={studentId} onChange={(e) => { setStudentId(e.target.value); setError(""); }} disabled={!className}>
          <option value="">{className ? "Pilih nama dari kelas ini" : "Pilih kelas terlebih dahulu"}</option>{studentsInClass.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select></div>
        {error && <div className="banner banner-danger">{error}</div>}
        <p className="field-hint">Panitia tidak bisa melihat pilihanmu, panitia hanya melihat status voting dan jumlah suara.</p>
        <p className="field-hint">
          NB: Jika ada masalah teknis seperti namamu statusnya sudah melakukan PEMIRA, silakan hubungi panitia melalui WhatsApp. <br />
          Tim IT: Bibin - <a href="https://wa.me/0895629208339" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </p>
        <button className="btn btn-purple" onClick={continueToBallot} disabled={busy || ["before", "after", "inactive"].includes(status.type)}>{busy ? "Memeriksa…" : "Lanjutkan"}</button>
        <Link to="/" className="btn btn-outline" style={{ marginTop: 8 }}>Kembali ke Beranda</Link>
      </div>}
      {step === "ballot" && <div>
        <p style={{ textAlign: "center", color: "var(--color-ink-soft)" }}>Halo, {studentName}. Pilih satu kandidat. Pilihanmu dirahasiakan dan tidak ditampilkan kepada admin.</p>
        <div className="candidate-list">{candidates.map((c) => <button key={c.id} className={`candidate-row ${selected === c.id ? "selected" : ""}`} onClick={() => setSelected(c.id)}>
          <div className="candidate-number">{c.number}</div>{c.photo_url ? <img className="candidate-photo" src={c.photo_url} alt="" /> : <div className="candidate-photo" />}
          <div className="candidate-info"><div className="names">{c.name}{c.running_mate ? ` & ${c.running_mate}` : ""}</div>{c.vision && <div className="running-mate">{c.vision.length > 70 ? `${c.vision.slice(0, 70)}…` : c.vision}</div>}</div><div className={`ink-mark ${selected === c.id ? "filled" : ""}`} />
        </button>)}</div>
        {error && <div className="banner banner-danger">{error}</div>}
        <button className="btn btn-purple" style={{ marginTop: 22 }} onClick={submitVote} disabled={!selected || busy}>{busy ? "Mengirim suara…" : "Kirim Suara"}</button>
      </div>}
      {step === "done" && <div className="ballot-slip" style={{ textAlign: "center" }}><div className="stamp">✓</div><h2 style={{ fontSize: 20 }}>Status voting tercatat</h2><p style={{ color: "var(--color-ink-soft)", marginTop: 8 }}>Terima kasih sudah berpartisipasi. Nama tercatat sudah memilih; pilihan kandidat tetap rahasia.</p><Link to="/" className="btn btn-outline" style={{ marginTop: 20 }}>Kembali ke Beranda</Link></div>}
    </div>
  </div>;
}

function getWindowStatus(settings) {
  if (!settings || !settings.is_active) return { type: "inactive" };
  const now = Date.now();
  if (settings.start_time && now < new Date(settings.start_time).getTime()) return { type: "before" };
  if (settings.end_time && now > new Date(settings.end_time).getTime()) return { type: "after" };
  return { type: "open" };
}
