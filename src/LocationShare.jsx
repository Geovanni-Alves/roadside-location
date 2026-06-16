import { useEffect, useState } from 'react';

export default function LocationShare() {
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [bestAccuracy, setBestAccuracy] = useState(null);
  const [sent, setSent] = useState(false);

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

        // 🔥 pega melhor precisão já vista
        setBestAccuracy((prev) => (prev === null ? acc : Math.min(prev, acc)));
      },
      (err) => {
        console.log('GPS ERROR:', err);
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
    if (!acc) return 'WAITING';
    if (acc <= 10) return 'EXCELLENT';
    if (acc <= 25) return 'GOOD';
    return 'POOR';
  };

  const status = getStatus(bestAccuracy);

  const canSend = coords && bestAccuracy && bestAccuracy <= 25;

  const sendLocation = () => {
    const link = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

    alert('LOCATION SENT:\n\n' + link);
    setSent(true);
  };

  if (sent) {
    return <h3>Location sent ✅</h3>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h3>Roadside Location Share</h3>

      <p>Request ID: {crypto.randomUUID()}</p>

      {!bestAccuracy && <p>Waiting for GPS signal...</p>}

      {bestAccuracy && <p>Accuracy: {Math.round(bestAccuracy)}m</p>}

      <p>
        Status: {status === 'EXCELLENT' && '🟢 Excellent signal'}
        {status === 'GOOD' && '🟡 Good signal'}
        {status === 'POOR' && '🔴 Weak signal'}
        {status === 'WAITING' && '⏳ Searching GPS...'}
      </p>

      {bestAccuracy > 25 && <p>Move outside for better accuracy</p>}

      <button disabled={!canSend} onClick={sendLocation}>
        Send Location
      </button>
    </div>
  );
}
