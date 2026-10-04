import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

const NAV_ICONS = {
  overview:     "◈",
  applications: "📋",
  "daftar-ulang": "📝",
  candidates:   "👤",
  voters:       "🗳️",
  results:      "📊",
  settings:     "⚙️",
};

const links = [
  { to: "overview",     label: "Ringkasan" },
  { to: "applications", label: "Pendaftaran Calon" },
  { to: "daftar-ulang", label: "Daftar Ulang" },
  { to: "candidates",   label: "Kandidat" },
  { to: "voters",       label: "Pemilih" },
  { to: "results",      label: "Hasil Suara" },
  { to: "settings",     label: "Pengaturan" },
];

export default function AdminLayout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin/login");
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          PEMIRA
          <span>Panel Admin</span>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{NAV_ICONS[l.to]}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="btn btn-outline btn-small"
            onClick={handleLogout}
            style={{ width: "100%", color: "#94a3b8", borderColor: "rgba(255,255,255,.12)", background: "transparent" }}
          >
            Keluar
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
