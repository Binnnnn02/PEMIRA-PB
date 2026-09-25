import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

const STORAGE_KEY = "pemira-reregistration-submitted:1";

function normalizePhone(value) {
  const digits = value.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+62")) return `0${digits.slice(3)}`;
  if (digits.startsWith("62")) return `0${digits.slice(2)}`;
  return digits;
}

export default function ReRegistration() {
  const [settings, setSettings] = useState(null);
  const [students, setStudents] = useState([]);
  const [className, setClassName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: election }, { data: studentRows, error: studentsError }] = await Promise.all([
      supabase.from("election_settings").select("*").eq("id", 1).single(),
      supabase.from("student_directory").select("id, class_name, full_name").eq("is_active", true).order("class_name").order("full_name"),
    ]);

    setSettings(election);
    setStudents(studentRows || []);
    if (studentsError) setError("Data siswa belum tersedia. Hubungi panitia.");
    setLoading(false);
  }

  const classes = useMemo(
    () => [...new Set(students.map((student) => student.class_name))].filter(Boolean),
    [students]
  );

  const filteredStudents = useMemo(
    () => students.filter((student) => student.class_name === className),
    [students, className]
  );

  function handleClassChange(value) {
    setClassName(value);
    setStudentId("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    const normalizedPhone = normalizePhone(phone);
    if (!studentId || !className) return setError("Pilih kelas dan nama siswa terlebih dahulu.");
    if (!/^08[0-9]{8,13}$/.test(normalizedPhone)) {
      return setError("Nomor WhatsApp harus diawali 08 dan berisi 10–15 digit.");
    }

    if (localStorage.getItem(STORAGE_KEY) === "1") {
      return setError("Perangkat ini sudah pernah mengirim daftar ulang. Jika ada kendala, hubungi panitia.");
    }

    setSubmitting(true);
    const { data, error: submitError } = await supabase.rpc("submit_re_registration", {
      p_election_id: 1,
      p_student_id: studentId,
      p_phone_number: normalizedPhone,
    });
    setSubmitting(false);

    if (submitError) {
      setError("Pendaftaran gagal. Coba lagi atau hubungi panitia.");
      return;
    }

    if (!data?.success) {
      const messages = {
        already_registered: "Siswa ini sudah terdaftar ulang untuk PEMIRA ini.",
        phone_used: "Nomor WhatsApp ini sudah digunakan untuk daftar ulang.",
        invalid_student: "Data siswa tidak valid.",
      };
      setError(messages[data?.reason] || "Pendaftaran tidak dapat diproses.");
      return;
    }

    localStorage.setItem(STORAGE_KEY, "1");
    setSuccess(true);
  }

  const registrationOpen = settings?.registration_open;

  return (
    <div className="page">
      <div className="masthead">
        <div className="kicker"><Link to="/">← Kembali ke beranda</Link></div>
        <h1>Daftar Ulang PEMIRA</h1>
        <p className="org">{settings?.title || "PEMIRA"}</p>
      </div>

      <div className="page-narrow">
        {success ? (
          <div className="ballot-slip">
            <div className="banner banner-success">Daftar ulang berhasil dikirim.</div>
            <h3>Data kamu sudah tercatat</h3>
            <p className="field-hint" style={{ textAlign: "left" }}>
              Panitia akan mengirimkan nama, NIS, dan token melalui WhatsApp sesuai jadwal. Jangan membagikan token kepada orang lain.
            </p>
            <Link to="/" className="btn btn-purple">Kembali ke beranda</Link>
          </div>
        ) : !registrationOpen ? (
          <div className="ballot-slip">
            <div className="banner banner-danger">Pendaftaran ulang sedang ditutup.</div>
            <p className="field-hint" style={{ textAlign: "left" }}>
              Pantau pengumuman panitia untuk jadwal daftar ulang.
            </p>
            <Link to="/" className="btn btn-outline">Kembali</Link>
          </div>
        ) : (
          <form className="ballot-slip" onSubmit={handleSubmit}>
            <p className="field-hint" style={{ textAlign: "left", marginTop: 0 }}>
              Pilih data siswa yang sudah terdaftar di sistem, lalu masukkan nomor WhatsApp aktif.
            </p>

            <div className="form-field">
              <label htmlFor="class_name">Kelas</label>
              <select id="class_name" value={className} onChange={(event) => handleClassChange(event.target.value)} required disabled={loading}>
                <option value="">Pilih kelas</option>
                {classes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="student_id">Nama siswa</label>
              <select id="student_id" value={studentId} onChange={(event) => setStudentId(event.target.value)} required disabled={!className || loading}>
                <option value="">Pilih nama</option>
                {filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="phone">Nomor WhatsApp</label>
              <input id="phone" type="tel" inputMode="numeric" placeholder="08xxxxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} required />
              <div className="field-hint" style={{ textAlign: "left" }}>Nomor digunakan panitia untuk mengirim token H-1. Satu nomor hanya bisa dipakai sekali dalam satu PEMIRA.</div>
            </div>

            {error && <div className="banner banner-danger">{error}</div>}
            <button className="btn btn-purple" disabled={submitting || loading}>{submitting ? "Mengirim…" : "Kirim Daftar Ulang"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
