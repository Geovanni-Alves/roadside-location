import { useEffect, useState } from "react";
import { supabase } from "./supabase";

function getGoogleMapsLink(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

// ⚠️ TEST-ONLY SCREEN. Just reads location_pings and opens each in Google
// Maps - no status logic, no filtering, no styling polish. Meant for quick
// debugging while testing GPS/pin accuracy in different spots.
export default function TestPings() {
  const [pings, setPings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from("location_pings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error) setPings(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel("test-pings")
      .on("postgres_changes", { event: "*", schema: "public", table: "location_pings" }, () => load())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={{ padding: 20, fontFamily: "monospace", maxWidth: 900, margin: "0 auto" }}>
      <h2>Test: Raw Location Pings ({pings.length})</h2>
      <button onClick={load} style={{ marginBottom: 16, padding: 8 }}>
        ↻ Refresh
      </button>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
            <th style={{ padding: 6 }}>Time</th>
            <th style={{ padding: 6 }}>Token</th>
            <th style={{ padding: 6 }}>Lat, Lng</th>
            <th style={{ padding: 6 }}>Accuracy</th>
            <th style={{ padding: 6 }}>Address</th>
            <th style={{ padding: 6 }}></th>
          </tr>
        </thead>
        <tbody>
          {pings.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 6, whiteSpace: "nowrap" }}>{new Date(p.created_at).toLocaleTimeString()}</td>
              <td style={{ padding: 6 }}>{p.request_token?.slice(0, 8)}...</td>
              <td style={{ padding: 6 }}>
                {p.latitude?.toFixed(6)}, {p.longitude?.toFixed(6)}
              </td>
              <td style={{ padding: 6 }}>{p.accuracy != null ? `${Math.round(p.accuracy)}m` : "-"}</td>
              <td style={{ padding: 6 }}>{p.address_label ?? "-"}</td>
              <td style={{ padding: 6 }}>
                <a href={getGoogleMapsLink(p.latitude, p.longitude)} target="_blank" rel="noreferrer">
                  Open in Maps
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pings.length === 0 && <p>No pings yet.</p>}
    </div>
  );
}
