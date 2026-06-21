import { supabase } from "./supabase";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function LocationShare() {
  const { token } = useParams();
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [bestAccuracy, setBestAccuracy] = useState(null);
  const [sent, setSent] = useState(false);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

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

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;

        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });

        setAccuracy(acc);

        // take the best gps accuracy
        setBestAccuracy((prev) => (prev === null ? acc : Math.min(prev, acc)));
      },
      (err) => {
        console.log("GPS ERROR:", err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const getStatus = (acc) => {
    if (!acc) return "WAITING";
    if (acc <= 10) return "EXCELLENT";
    if (acc <= 25) return "GOOD";
    return "POOR";
  };

  const status = getStatus(bestAccuracy);

  const canSend = coords && bestAccuracy && bestAccuracy <= 25;

  const sendLocation = () => {
    const link = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

    alert("LOCATION SENT:\n\n" + link);
    setSent(true);
  };

  if (sent) {
    return <h3>Location sent ✅</h3>;
  }

  if (loading) {
    return <h3>Checking request...</h3>;
  }

  if (invalidToken) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Invalid Request</h2>
        <p>This link is not valid.</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Request Expired</h2>
        <p>This location request has expired.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      {coords && (
        <div style={{ marginTop: 20 }}>
          <p>
            <strong>Location Link:</strong>
          </p>

          <a
            href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "blue",
              textDecoration: "underline",
              fontSize: 16,
            }}
          >
            Open in Google Maps
          </a>
        </div>
      )}
      <h3>Roadside Location Share</h3>

      <p>Request ID: {request.token}</p>

      {!bestAccuracy && <p>Waiting for GPS signal...</p>}

      {bestAccuracy && <p>Accuracy: {Math.round(bestAccuracy)}m</p>}

      <p>
        Status: {status === "EXCELLENT" && "🟢 Excellent signal"}
        {status === "GOOD" && "🟡 Good signal"}
        {status === "POOR" && "🔴 Weak signal"}
        {status === "WAITING" && "⏳ Searching GPS..."}
      </p>

      {bestAccuracy > 25 && <p>Move outside for better accuracy</p>}

      <button disabled={!canSend} onClick={sendLocation}>
        Send Location
      </button>
    </div>
  );
}
