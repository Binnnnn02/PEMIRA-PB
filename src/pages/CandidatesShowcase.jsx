import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

export default function CandidatesShowcase() {
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    supabase
      .from("candidates")
      .select("*")
      .order("number")
      .then(({ data }) => setCandidates(data || []));
  }, []);

  return (
    <div className="page">
      <div className="masthead">
        <div className="kicker">
          <Link to="/">← Kembali</Link>
        </div>
        <h1>Profil Calon Pengurus</h1>
      </div>

      <div style={{ width: "100%", maxWidth: 720 }}>
        {candidates.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--color-ink-soft)" }}>
            Belum ada kandidat yang ditetapkan.
          </p>
        )}

        <div className="profile-list">
          {candidates.map((c) => (
            <div className="profile-card" key={c.id}>
              {c.photo_url ? (
                <img src={c.photo_url} alt="" className="profile-photo" />
              ) : (
                <div className="profile-photo profile-photo-empty">{c.number}</div>
              )}
              <div className="profile-body">
                <div className="profile-number">Nomor Urut {c.number}</div>
                <h3 className="profile-name">
                  {c.name}
                  {c.running_mate ? ` & ${c.running_mate}` : ""}
                </h3>
                {c.vision && (
                  <div className="profile-block">
                    <div className="profile-label">Visi</div>
                    <p>{c.vision}</p>
                  </div>
                )}
                {c.mission && (
                  <div className="profile-block">
                    <div className="profile-label">Misi</div>
                    <p>{c.mission}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
