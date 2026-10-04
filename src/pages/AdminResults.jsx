import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { supabase } from "../supabaseClient.js";

const BAR_COLOR = "#4f46e5";

export default function AdminResults() {
  const [rows, setRows] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("votes-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes" }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function load() {
    const { data } = await supabase
      .from("vote_counts")
      .select("*")
      .order("total_votes", { ascending: false });
    setRows(data || []);
    setLastUpdated(new Date());
  }

  const total = rows.reduce((sum, r) => sum + r.total_votes, 0);
  const leader = rows[0];

  return (
    <div>
      <h2>Hasil Suara</h2>
      <p className="admin-sub">
        {total} suara masuk
        {lastUpdated
          ? ` · diperbarui pukul ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
          : ""}
        <span
          style={{
            display: "inline-block",
            marginLeft: 10,
            width: 8, height: 8,
            borderRadius: "50%",
            background: "var(--color-success)",
            boxShadow: "0 0 0 3px var(--color-success-wash)",
            verticalAlign: "middle",
          }}
          title="Live"
        />
      </p>

      {/* Leader Card */}
      {leader && total > 0 && (
        <div
          className="card"
          style={{
            borderColor: "var(--color-primary)",
            borderLeftWidth: 3,
            borderLeftStyle: "solid",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--color-primary)", marginBottom: 4 }}>
            Sementara unggul
          </p>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {leader.name}{leader.running_mate ? ` & ${leader.running_mate}` : ""}
          </div>
          <div style={{ fontSize: 14, color: "var(--color-ink-soft)", marginTop: 2 }}>
            {leader.total_votes} suara · {Math.round((leader.total_votes / total) * 100)}%
          </div>
        </div>
      )}

      {/* Bar Chart */}
      <div className="card">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 30 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fontFamily: "Inter, sans-serif", fill: "#64748b" }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                }}
              />
              <Bar dataKey="total_votes" radius={[6, 6, 0, 0]}>
                {rows.map((r, i) => (
                  <Cell key={r.candidate_id} fill={i === 0 && total > 0 ? BAR_COLOR : "#a5b4fc"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Kandidat</th>
                <th style={{ textAlign: "right" }}>Suara</th>
                <th style={{ textAlign: "right" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pct = total > 0 ? Math.round((r.total_votes / total) * 100) : 0;
                return (
                  <tr key={r.candidate_id}>
                    <td>
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 28, height: 28, borderRadius: "50%", fontSize: 13, fontWeight: 700,
                          background: i === 0 && total > 0 ? "var(--color-primary-wash)" : "var(--color-surface-alt)",
                          color: i === 0 && total > 0 ? "var(--color-primary)" : "var(--color-ink-soft)",
                        }}
                      >
                        {r.number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {r.name}{r.running_mate ? ` & ${r.running_mate}` : ""}
                      </div>
                      {/* Progress bar */}
                      <div
                        style={{
                          marginTop: 6, height: 4, borderRadius: 999,
                          background: "var(--color-surface-alt)", overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: i === 0 && total > 0 ? "var(--color-primary)" : "#a5b4fc",
                            borderRadius: 999,
                            transition: "width .5s ease",
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {r.total_votes}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--color-ink-soft)", fontVariantNumeric: "tabular-nums" }}>
                      {pct}%
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--color-ink-soft)", padding: "24px 0" }}>
                    Belum ada suara masuk.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
