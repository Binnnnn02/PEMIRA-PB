import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

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
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "var(--color-primary)",
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            P
          </div>
          <h1 style={{ fontSize: 22, letterSpacing: "-.02em", marginBottom: 4 }}>
            Masuk Admin
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-ink-soft)" }}>
            Portal Panitia PEMIRA
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "28px 24px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sekolah.id"
              required
              autoFocus
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Kata sandi</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="banner banner-danger" style={{ marginTop: 0, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-purple"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading ? "Memproses…" : "Masuk ke Panel Admin"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: 16,
            fontSize: 12.5,
            color: "var(--color-ink-muted)",
            lineHeight: 1.6,
          }}
        >
          Akun admin dibuat melalui Supabase Dashboard
          <br />
          (Authentication → Users), bukan lewat halaman ini.
        </p>
      </div>
    </div>
  );
}
