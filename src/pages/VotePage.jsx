import { supabase } from "../supabaseClient.js";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Countdown from "../components/Countdown.jsx";

const CODE_LENGTH = 6;

const REASON_MESSAGES = {
  not_found: "Kode suara tidak ditemukan. Periksa kembali kode kamu.",
  already_voted: "Kode ini sudah digunakan untuk memilih.",
  invalid_code: "Kode suara tidak valid.",
  invalid_candidate: "Kandidat tidak valid, silakan pilih ulang.",
  not_active: "Pemungutan suara belum dibuka oleh panitia.",
  not_started: "Pemungutan suara belum dimulai.",
  ended: "Waktu pemungutan suara sudah berakhir.",
};

export default function VotePage() {
  const [settings, setSettings] = useState(null);
  const [step, setStep] = useState("code"); // code | ballot | submitting | done | closed
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [voterName, setVoterName] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    supabase
      .from("election_settings")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => setSettings(data));
  }, []);

  const windowStatus = getWindowStatus(settings);

  function handleDigitChange(index, value) {
    const clean = value.replace(/[^a-zA-Z0-9]/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function submitCode() {
    setError("");
    const code = digits.join("").toUpperCase();
    if (code.length !== CODE_LENGTH) {
      setError("Lengkapi seluruh kode terlebih dahulu.");
      return;
    }
    setChecking(true);
    const { data, error: rpcError } = await supabase.rpc("check_voter_code", {
      p_code: code,
    });
    setChecking(false);

    if (rpcError) {
      setError("Terjadi kesalahan. Coba lagi.");
      return;
    }
    if (!data.valid) {
      setError(REASON_MESSAGES.not_found);
      return;
    }
    if (data.has_voted) {
      setError(REASON_MESSAGES.already_voted);
      return;
    }

    setVoterName(data.name || "");

    const { data: candidateRows, error: candidateError } = await supabase
      .from("candidates")
      .select("*")
      .order("number", { ascending: true });

    if (candidateError) {
      setError("Gagal memuat daftar kandidat.");
      return;
    }

    setCandidates(candidateRows || []);
    setStep("ballot");
  }

  async function submitVote() {
    if (!selected) return;
    setStep("submitting");
    const code = digits.join("").toUpperCase();
    const { data, error: rpcError } = await supabase.rpc("cast_vote", {
      p_code: code,
      p_candidate_id: selected,
    });

    if (rpcError || !data.success) {
      setError(REASON_MESSAGES[data?.reason] || "Gagal mengirim suara. Coba lagi.");
      setStep("ballot");
      return;
    }

    setStep("done");
  }

  return (
    <div className="page">
      <div className="masthead">
        <div className="kicker">
          {step === "code" ? <Link to="/">← Kembali</Link> : "Bilik Suara Digital"}
        </div>
        <h1>{settings?.title || "PEMIRA"}</h1>
        <div className="org">{settings?.organization || ""}</div>
      </div>

      <div className="page-narrow">
        {step !== "done" && ["before", "after", "inactive"].includes(windowStatus.type) && (
          <div className="banner banner-danger" style={{ marginBottom: 18 }}>
            {windowStatus.type === "before" && (
              <>
                Pemungutan suara dibuka dalam{" "}
                <Countdown target={settings.start_time} />
              </>
            )}
            {windowStatus.type === "after" && "Pemungutan suara telah ditutup."}
            {windowStatus.type === "inactive" &&
              "Pemungutan suara belum dibuka oleh panitia."}
          </div>
        )}

        {step === "code" && (
          <div className="ballot-slip">
            <h2 style={{ fontSize: 18, textAlign: "center" }}>
              Masukkan kode suara kamu
            </h2>
            <div className="code-boxes">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  value={d}
                  maxLength={1}
                  inputMode="text"
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                />
              ))}
            </div>
            <div className="field-hint">
              Kode {CODE_LENGTH} karakter diberikan oleh panitia PEMIRA.
            </div>

            {error && <div className="banner banner-danger">{error}</div>}

            <div style={{ marginTop: 20 }}>
              <button
                className="btn btn-purple"
                onClick={submitCode}
                disabled={checking || ["after", "inactive"].includes(windowStatus.type)}
              >
                {checking ? "Memeriksa…" : "Lanjutkan"}
              </button>
            </div>
          </div>
        )}

        {(step === "ballot" || step === "submitting") && (
          <div>
            <p style={{ textAlign: "center", color: "var(--color-ink-soft)" }}>
              {voterName ? `Halo, ${voterName}. ` : ""}
              Pilih satu paslon di bawah ini.
            </p>

            <div className="candidate-list">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  className={`candidate-row ${selected === c.id ? "selected" : ""}`}
                  onClick={() => setSelected(c.id)}
                  disabled={step === "submitting"}
                >
                  <div className="candidate-number">{c.number}</div>
                  {c.photo_url ? (
                    <img className="candidate-photo" src={c.photo_url} alt="" />
                  ) : (
                    <div className="candidate-photo" />
                  )}
                  <div className="candidate-info">
                    <div className="names">
                      {c.name}
                      {c.running_mate ? ` & ${c.running_mate}` : ""}
                    </div>
                    {c.vision && (
                      <div className="running-mate">{truncate(c.vision, 70)}</div>
                    )}
                  </div>
                  <div className={`ink-mark ${selected === c.id ? "filled" : ""}`} />
                </button>
              ))}
            </div>

            {error && <div className="banner banner-danger">{error}</div>}

            <div style={{ marginTop: 22 }}>
              <button
                className="btn btn-purple"
                onClick={submitVote}
                disabled={!selected || step === "submitting"}
              >
                {step === "submitting" ? "Mengirim suara…" : "Kirim suara"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="ballot-slip" style={{ textAlign: "center" }}>
            <div className="stamp">✓</div>
            <h2 style={{ fontSize: 20 }}>Suara kamu telah tercatat</h2>
            <p style={{ color: "var(--color-ink-soft)", marginTop: 8 }}>
              Terima kasih sudah berpartisipasi dalam {settings?.title || "PEMIRA"}.
              Kode suara kamu tidak dapat digunakan lagi.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function getWindowStatus(settings) {
  if (!settings) return { type: "loading" };
  if (!settings.is_active) return { type: "inactive" };
  const now = Date.now();
  if (settings.start_time && now < new Date(settings.start_time).getTime()) {
    return { type: "before" };
  }
  if (settings.end_time && now > new Date(settings.end_time).getTime()) {
    return { type: "after" };
  }
  return { type: "open" };
}
