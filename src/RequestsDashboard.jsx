import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./supabase";

// Links are generated on the fly from latitude/longitude - never stored,
// see conversation notes. This keeps them always up to date even if the
// link format changes later, and avoids storing redundant/derivable data.
function getGoogleMapsLink(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function getWazeLink(lat, lng) {
  return `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`;
}

const STATUS_LABELS = {
  waiting_location: { label: "Waiting for location", color: "#b45309", bg: "#fef3c7" },
  location_sent: { label: "Location received", color: "#15803d", bg: "#dcfce7" },
};

function StatusBadge({ status, expiresAt }) {
  const isExpired = status === "waiting_location" && expiresAt && new Date(expiresAt) < new Date();

  if (isExpired) {
    return (
      <span style={{ padding: "4px 10px", borderRadius: 20, background: "#f3f4f6", color: "#6b7280", fontSize: 12, fontWeight: "bold" }}>
        Expired
      </span>
    );
  }

  const info = STATUS_LABELS[status] ?? { label: status, color: "#374151", bg: "#f3f4f6" };

  return (
    <span style={{ padding: "4px 10px", borderRadius: 20, background: info.bg, color: info.color, fontSize: 12, fontWeight: "bold" }}>
      {info.label}
    </span>
  );
}

function PingRow({ ping, isLatest }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        background: isLatest ? "#eff6ff" : "#f9fafb",
        marginBottom: 6,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
        {new Date(ping.created_at).toLocaleTimeString()} {isLatest && "· latest"}
      </p>

      {ping.address_label && <p style={{ margin: "4px 0", fontSize: 13, color: "#374151" }}>📌 {ping.address_label}</p>}

      <p style={{ margin: "2px 0", fontSize: 12, color: "#6b7280" }}>
        {ping.travel_direction && <>Direction: <strong>{ping.travel_direction}</strong> · </>}
        {ping.accuracy != null && <>Accuracy: {Math.round(ping.accuracy)}m</>}
      </p>

      {ping.reference_note && (
        <p style={{ margin: "4px 0", fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>"{ping.reference_note}"</p>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <a
          href={getGoogleMapsLink(ping.latitude, ping.longitude)}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            background: "#2563eb",
            color: "#fff",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          Google Maps
        </a>
        <a
          href={getWazeLink(ping.latitude, ping.longitude)}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            background: "#0ea5e9",
            color: "#fff",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          Waze
        </a>
      </div>
    </div>
  );
}

export default function RequestsDashboard() {
  const [requests, setRequests] = useState([]);
  const [pingsByToken, setPingsByToken] = useState({});
  const [expandedToken, setExpandedToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [{ data: reqData, error: reqError }, { data: pingData, error: pingError }] = await Promise.all([
      supabase.from("requests").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("location_pings").select("*").order("created_at", { ascending: false }).limit(500),
    ]);

    if (!reqError) setRequests(reqData ?? []);

    if (!pingError) {
      const grouped = {};
      for (const ping of pingData ?? []) {
        if (!grouped[ping.request_token]) grouped[ping.request_token] = [];
        grouped[ping.request_token].push(ping);
      }
      setPingsByToken(grouped);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Live updates: as soon as a driver sends a location (in TEST_MODE,
    // even multiple times from the same link), it shows up here without
    // a refresh.
    const channel = supabase
      .channel("requests-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "location_pings" }, () => loadData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (loading) return <h3 style={{ padding: 20 }}>Loading requests...</h3>;

  return (
    <div style={{ padding: 20, fontFamily: "Arial", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div>
          <h2 style={{ margin: 0 }}>🚚 Roadside Location</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>Active requests</p>
        </div>

        <Link
          to="/new"
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          + New Request
        </Link>
      </div>

      <div style={{ marginBottom: 16 }} />

      {requests.length === 0 && <p>No requests yet.</p>}

      {requests.map((r) => {
        const pings = pingsByToken[r.token] ?? [];
        const latest = pings[0];
        const isExpanded = expandedToken === r.token;

        return (
          <div
            key={r.token}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{r.name || "Unnamed request"}</strong>
              <StatusBadge status={r.status} expiresAt={r.expires_at} />
            </div>

            <p style={{ margin: "6px 0", fontSize: 14, color: "#374151" }}>
              {r.car && <>🚗 {r.car} · </>}
              {r.phone && (
                <a href={`tel:${r.phone}`} style={{ color: "#2563eb" }}>
                  📞 {r.phone}
                </a>
              )}
            </p>

            {latest && (
              <>
                <PingRow ping={latest} isLatest />

                {pings.length > 1 && (
                  <button
                    onClick={() => setExpandedToken(isExpanded ? null : r.token)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#2563eb",
                      fontSize: 12,
                      cursor: "pointer",
                      padding: 0,
                      marginTop: 4,
                    }}
                  >
                    {isExpanded ? "Hide" : `Show all ${pings.length} updates received (testing)`}
                  </button>
                )}

                {isExpanded && (
                  <div style={{ marginTop: 8 }}>
                    {pings.slice(1).map((p) => (
                      <PingRow key={p.id} ping={p} />
                    ))}
                  </div>
                )}
              </>
            )}

            {!latest && (
              <p style={{ margin: "6px 0", fontSize: 13, color: "#9ca3af" }}>
                Waiting for the customer to share their location...
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
