import { supabase } from "./supabase";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Default Leaflet icon (avoids the broken-icon bug in production builds)
const pinIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const REQUIRED_ACCURACY = 10;

export default function LocationShare() {
  const { token } = useParams();

  // raw GPS position (initial reference point)
  const [gpsCoords, setGpsCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [bestAccuracy, setBestAccuracy] = useState(null);

  // PIN position (what the user actually adjusted - Uber-style)
  const [pinCoords, setPinCoords] = useState(null);
  const [addressLabel, setAddressLabel] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // extra text reference (essential on highways: "km 45, northbound, past gas station X")
  const [reference, setReference] = useState("");

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);

  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const geocodeTimer = useRef(null);

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
  // GPS WATCH (initial / reference position)
  // -------------------------
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        };

        setGpsCoords(next);
        setAccuracy(acc);
        setBestAccuracy((prev) => (prev === null ? acc : Math.min(prev, acc)));

        // only auto-place the pin while the user hasn't started
        // adjusting it manually yet
        setPinCoords((prev) => prev ?? { lat: next.lat, lng: next.lng });
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

  // -------------------------
  // REVERSE GEOCODING (shows the street/highway under the pin)
  // Uses Nominatim (OpenStreetMap) - free, no API key needed.
  // For production with high volume, swap for Google Geocoding
  // or Mapbox (more reliable, no 1 req/s rate limit).
  // -------------------------
  const reverseGeocode = useCallback(async (lat, lng) => {
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { Accept: "application/json" } },
      );
      const data = await res.json();
      setAddressLabel(data?.display_name ?? "Address not found");
    } catch (err) {
      setAddressLabel("Could not resolve address");
    } finally {
      setGeocoding(false);
    }
  }, []);

  // debounce: only geocode ~600ms after the pin stops moving
  useEffect(() => {
    if (!pinCoords) return;

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);

    geocodeTimer.current = setTimeout(() => {
      reverseGeocode(pinCoords.lat, pinCoords.lng);
    }, 600);

    return () => clearTimeout(geocodeTimer.current);
  }, [pinCoords, reverseGeocode]);

  const getDirection = (heading) => {
    if (heading == null) return "Unknown";
    if (heading >= 315 || heading < 45) return "Northbound";
    if (heading >= 45 && heading < 135) return "Eastbound";
    if (heading >= 135 && heading < 225) return "Southbound";
    return "Westbound";
  };

  const getStatus = (acc) => {
    if (!acc) return "WAITING";
    if (acc <= 10) return "EXCELLENT";
    if (acc <= 20) return "GOOD";
    return "POOR";
  };

  const status = getStatus(bestAccuracy);
  const canSend = pinCoords && confirmed;

  // -------------------------
  // MOVE THE PIN (map click OR drag)
  // -------------------------
  function PinController() {
    useMapEvents({
      click(e) {
        setPinCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        setConfirmed(false);
      },
    });
    return null;
  }

  const handleMarkerDragEnd = (e) => {
    const { lat, lng } = e.target.getLatLng();
    setPinCoords({ lat, lng });
    setConfirmed(false);
  };

  const recenterOnGps = () => {
    if (!gpsCoords) return;
    setPinCoords({ lat: gpsCoords.lat, lng: gpsCoords.lng });
    setConfirmed(false);
  };

  // -------------------------
  // SEND LOCATION
  // -------------------------
  const sendLocation = async () => {
    if (!pinCoords) return;
    setSending(true);

    const { error } = await supabase
      .from("requests")
      .update({
        latitude: pinCoords.lat,
        longitude: pinCoords.lng,
        gps_latitude: gpsCoords?.lat ?? null,
        gps_longitude: gpsCoords?.lng ?? null,
        accuracy: bestAccuracy,
        address_label: addressLabel,
        reference_note: reference,
        status: "location_sent",
      })
      .eq("token", token);

    setSending(false);

    if (error) {
      alert("Error sending location: " + error.message);
      return;
    }

    setSent(true);
  };

  // -------------------------
  // ERROR STATES
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
    <div style={{ padding: 16, fontFamily: "Arial", maxWidth: 520, margin: "0 auto" }}>
      <h2>🚚 Share Location (Tow Truck)</h2>

      {!gpsCoords && <p>⏳ Waiting for GPS signal...</p>}

      {bestAccuracy && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: "4px 0" }}>
            GPS Accuracy: <strong>{Math.round(bestAccuracy)}m</strong> ({status})
          </p>
          {gpsCoords?.heading != null && (
            <p style={{ margin: "4px 0" }}>Vehicle heading: {getDirection(gpsCoords.heading)}</p>
          )}
        </div>
      )}

      <p style={{ fontWeight: "bold", marginBottom: 4 }}>
        📍 Drag the pin to the exact spot (just like Uber's pickup pin)
      </p>
      <p style={{ fontSize: 13, color: "#666", marginTop: 0 }}>
        You can also tap anywhere on the map to move the pin.
      </p>

      {pinCoords && (
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #ccc" }}>
          <MapContainer
            center={[pinCoords.lat, pinCoords.lng]}
            zoom={18}
            style={{ height: 380, width: "100%" }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <PinController />
            <Marker
              position={[pinCoords.lat, pinCoords.lng]}
              draggable
              icon={pinIcon}
              eventHandlers={{ dragend: handleMarkerDragEnd }}
            />
          </MapContainer>
        </div>
      )}

      <div style={{ marginTop: 10, minHeight: 20 }}>
        {geocoding && <p style={{ fontSize: 13, color: "#888" }}>Resolving address...</p>}
        {!geocoding && addressLabel && (
          <p style={{ fontSize: 13, color: "#333" }}>📌 {addressLabel}</p>
        )}
      </div>

      {gpsCoords && (
        <button onClick={recenterOnGps} style={{ padding: 8, marginTop: 6 }}>
          ↺ Back to my GPS position
        </button>
      )}

      <div style={{ marginTop: 14 }}>
        <label style={{ fontWeight: "bold", fontSize: 14 }}>
          Reference point (optional, but recommended on highways)
        </label>
        <textarea
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Ex: KM 45 northbound, right after the Shell gas station, on the shoulder"
          rows={2}
          style={{ width: "100%", marginTop: 4, padding: 8, fontSize: 14 }}
        />
      </div>

      <p style={{ marginTop: 14, fontWeight: "bold" }}>Is the pin in the correct spot?</p>

      <button
        onClick={() => setConfirmed(true)}
        disabled={!pinCoords}
        style={{
          marginRight: 10,
          padding: 10,
          background: confirmed ? "green" : "#eee",
          color: confirmed ? "#fff" : "#000",
        }}
      >
        {confirmed ? "Confirmed ✅" : "Confirm Location"}
      </button>

      {confirmed && !sent && (
        <p style={{ color: "green", marginTop: 10 }}>
          Location confirmed. Ready to send.
        </p>
      )}

      <button
        disabled={!canSend || sending || sent}
        onClick={sendLocation}
        style={{
          marginTop: 15,
          padding: 12,
          width: "100%",
          fontSize: 16,
        }}
      >
        {sent ? "Location sent ✅" : sending ? "Sending..." : "Send Location"}
      </button>
    </div>
  );
}
