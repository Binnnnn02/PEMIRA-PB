import { supabase } from "../supabaseClient.js";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking"); // checking | in | out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "in" : "out");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "in" : "out");
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === "checking") {
    return <div className="page">Memuat…</div>;
  }

  if (status === "out") {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
