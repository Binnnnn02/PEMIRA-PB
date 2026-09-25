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

const BAR_COLOR = "#4a1942";

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

  return (
    <div>
      <h2>Hasil Suara</h2>
      <p className="admin-sub">
        Total {total} suara masuk
        {lastUpdated ? ` · diperbarui ${lastUpdated.toLocaleTimeString("id-ID")}` : ""}
      </p>

      <div className="card">
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fontFamily: "IBM Plex Sans" }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total_votes" radius={[3, 3, 0, 0]}>
                {rows.map((r) => (
                  <Cell key={r.candidate_id} fill={BAR_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Kandidat</th>
              <th>Suara</th>
              <th>Persentase</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.candidate_id}>
                <td>{r.number}</td>
                <td>
                  {r.name}
                  {r.running_mate ? ` & ${r.running_mate}` : ""}
                </td>
                <td>{r.total_votes}</td>
                <td>{total > 0 ? Math.round((r.total_votes / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
