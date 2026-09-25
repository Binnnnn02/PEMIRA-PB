import { Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import VotePage from "./pages/VotePage.jsx";
import ReRegistration from "./pages/ReRegistration.jsx";
import AdminReregistrations from "./pages/AdminReregistrations.jsx";
import CandidateRegister from "./pages/CandidateRegister.jsx";
import CandidatesShowcase from "./pages/CandidatesShowcase.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminLayout from "./pages/AdminLayout.jsx";
import AdminOverview from "./pages/AdminOverview.jsx";
import AdminApplications from "./pages/AdminApplications.jsx";
import AdminCandidates from "./pages/AdminCandidates.jsx";
import AdminVoters from "./pages/AdminVoters.jsx";
import AdminResults from "./pages/AdminResults.jsx";
import AdminSettings from "./pages/AdminSettings.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/pilih" element={<VotePage />} />
      <Route path="/daftar-ulang" element={<ReRegistration />} />
      <Route path="/pendaftaran-calon" element={<CandidateRegister />} />
      <Route path="/kandidat" element={<CandidatesShowcase />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<AdminOverview />} />
        <Route path="applications" element={<AdminApplications />} />
        <Route path="daftar-ulang" element={<AdminReregistrations />} />
        <Route path="candidates" element={<AdminCandidates />} />
        <Route path="voters" element={<AdminVoters />} />
        <Route path="results" element={<AdminResults />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
