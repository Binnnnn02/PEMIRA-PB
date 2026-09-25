import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient.js";

const links = [
  { to: "overview", label: "Ringkasan" },
  { to: "applications", label: "Pendaftaran Calon" },
  { to: "daftar-ulang", label: "Daftar Ulang" },
  { to: "candidates", label: "Kandidat" },
  { to: "voters", label: "Pemilih" },
  { to: "results", label: "Hasil Suara" },
  { to: "settings", label: "Pengaturan" },
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
        <div className="brand">PEMIRA · Panel Admin</div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-outline btn-small" onClick={handleLogout} style={{ color: "#fff", borderColor: "#585e78" }}>
          Keluar
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
