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
  waiting_location: {
    label: "Waiting for location",
    color: "#b45309",
    bg: "#fef3c7",
  },
  location_sent: {
    label: "Location received",
    color: "#15803d",
    bg: "#dcfce7",
  },
};

function StatusBadge({ status, expiresAt }) {
  const isExpired =
    status === "waiting_location" &&
    expiresAt &&
    new Date(expiresAt) < new Date();

  if (isExpired) {
    return (
      <span
        style={{
          padding: "4px 10px",
          borderRadius: 20,
          background: "#f3f4f6",
          color: "#6b7280",
          fontSize: 12,
          fontWeight: "bold",
        }}
      >
        Expired
      </span>
    );
  }

  const info = STATUS_LABELS[status] ?? {
    label: status,
    color: "#374151",
    bg: "#f3f4f6",
  };

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 20,
        background: info.bg,
        color: info.color,
        fontSize: 12,
        fontWeight: "bold",
      }}
    >
      {info.label}
    </span>
  );
}

export default function RequestsDashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error) setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();

    // Live updates: as soon as a driver drags the pin and hits "Send
    // Location", this row updates here automatically - no refresh needed.
    const channel = supabase
      .channel("requests-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => loadRequests(),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (loading) return <h3 style={{ padding: 20 }}>Loading requests...</h3>;

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Arial",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>🚚 Roadside Location</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
            Active requests
          </p>
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
        const hasLocation =
          r.status === "location_sent" &&
          r.latitude != null &&
          r.longitude != null;

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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
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

            {hasLocation && (
              <>
                {r.address_label && (
                  <p
                    style={{ margin: "6px 0", fontSize: 13, color: "#4b5563" }}
                  >
                    📌 {r.address_label}
                  </p>
                )}

                {r.travel_direction && (
                  <p
                    style={{ margin: "6px 0", fontSize: 13, color: "#4b5563" }}
                  >
                    Direction of travel: <strong>{r.travel_direction}</strong>
                  </p>
                )}

                {r.reference_note && (
                  <p
                    style={{
                      margin: "6px 0",
                      fontSize: 13,
                      color: "#4b5563",
                      fontStyle: "italic",
                    }}
                  >
                    "{r.reference_note}"
                  </p>
                )}

                {r.accuracy != null && (
                  <p
                    style={{ margin: "6px 0", fontSize: 12, color: "#9ca3af" }}
                  >
                    GPS accuracy at time of send: {Math.round(r.accuracy)}m
                  </p>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <a
                    href={getGoogleMapsLink(r.latitude, r.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "#2563eb",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    Open in Google Maps
                  </a>

                  <a
                    href={getWazeLink(r.latitude, r.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      background: "#0ea5e9",
                      color: "#fff",
                      textDecoration: "none",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    Open in Waze
                  </a>
                </div>
              </>
            )}

            {!hasLocation && r.status === "waiting_location" && (
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
