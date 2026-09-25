import { supabase } from "../supabaseClient.js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError("Email atau kata sandi salah.");
      return;
    }
    navigate("/admin/overview");
  }

  return (
    <div className="page">
      <div className="masthead">
        <div className="kicker">Panitia PEMIRA</div>
        <h1>Masuk Admin</h1>
      </div>
      <div className="page-narrow">
        <form className="ballot-slip" onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label>Kata sandi</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="banner banner-danger">{error}</div>}
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-purple" disabled={loading}>
              {loading ? "Memproses…" : "Masuk"}
            </button>
          </div>
        </form>
        <p className="field-hint" style={{ marginTop: 16 }}>
          Akun admin dibuat oleh panitia melalui dashboard Supabase
          (Authentication → Users), bukan lewat halaman ini.
        </p>
      </div>
    </div>
  );
}
