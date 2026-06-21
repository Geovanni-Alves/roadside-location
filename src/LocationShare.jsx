import { supabase } from "./supabase";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function LocationShare() {
  const { token } = useParams();

  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [bestAccuracy, setBestAccuracy] = useState(null);

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  const REQUIRED_ACCURACY = 10;

  // -------------------------
  // VALIDATE TOKEN (SUPABASE)
  // -------------------------
  useEffect(() => {
    const validateToken = async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !data) {
        setInvalidToken(true);
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setExpired(true);
        setLoading(false);
        return;
      }

      setRequest(data);
      setLoading(false);
    };

    validateToken();
  }, [token]);

  // -------------------------
  // GPS WATCH
  // -------------------------
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;

        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });

        setAccuracy(acc);

        setBestAccuracy((prev) => (prev === null ? acc : Math.min(prev, acc)));
      },
      (err) => console.log("GPS ERROR:", err),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // -------------------------
  // STATUS
  // -------------------------
  const getStatus = (acc) => {
    if (!acc) return "WAITING";
    if (acc <= 10) return "EXCELLENT";
    if (acc <= 20) return "GOOD";
    return "POOR";
  };

  const status = getStatus(bestAccuracy);

  const canSend = coords && bestAccuracy && bestAccuracy <= REQUIRED_ACCURACY;

  // -------------------------
  // SEND LOCATION
  // -------------------------
  const sendLocation = async () => {
    await supabase
      .from("requests")
      .update({
        latitude: coords.lat,
        longitude: coords.lng,
        accuracy: bestAccuracy,
        status: "location_sent",
      })
      .eq("token", token);

    const link = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

    alert("LOCATION SENT:\n\n" + link);
  };

  // -------------------------
  // STATES
  // -------------------------
  if (loading) return <h3>Checking request...</h3>;

  if (invalidToken)
    return (
      <div style={{ padding: 20 }}>
        <h2>Invalid Request</h2>
        <p>This link is not valid.</p>
      </div>
    );

  if (expired)
    return (
      <div style={{ padding: 20 }}>
        <h2>Request Expired</h2>
        <p>This location request has expired.</p>
      </div>
    );

  // -------------------------
  // UI
  // -------------------------
  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>🚚 Roadside Location Share</h2>

      {/* <p>
        Request ID: <strong>{request.token}</strong>
      </p> */}

      {/* GPS STATUS */}
      {!bestAccuracy && <p>⏳ Waiting for GPS signal...</p>}

      {bestAccuracy && (
        <div>
          <p>
            GPS Accuracy: <strong>{Math.round(bestAccuracy)}m</strong>
          </p>

          {bestAccuracy <= 10 && (
            <p style={{ color: "green" }}>🟢 Excellent signal</p>
          )}

          {bestAccuracy > 10 && bestAccuracy <= 20 && (
            <p style={{ color: "orange" }}>🟡 Good signal</p>
          )}

          {bestAccuracy > 20 && (
            <p style={{ color: "red" }}>🔴 Waiting for better signal</p>
          )}
        </div>
      )}

      {/* HEADING / SPEED */}
      {coords?.heading != null && (
        <p>Direction: {Math.round(coords.heading)}°</p>
      )}

      {coords?.speed != null && (
        <p>Speed: {Math.round(coords.speed * 3.6)} km/h</p>
      )}

      {/* MAP */}
      {coords && (
        <div style={{ marginTop: 15 }}>
          <iframe
            title="map"
            width="100%"
            height="250"
            style={{
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
            src={`https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=18&output=embed`}
          />
        </div>
      )}

      {/* BUTTON */}
      {bestAccuracy > REQUIRED_ACCURACY && (
        <p>📍 Move outside for better accuracy</p>
      )}

      <button
        disabled={!canSend}
        onClick={sendLocation}
        style={{
          marginTop: 15,
          padding: 12,
          width: "100%",
          fontSize: 16,
        }}
      >
        Send Location
      </button>
    </div>
  );
}
