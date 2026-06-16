import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function LocationShare() {
  const { token } = useParams();

  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [sent, setSent] = useState(false);

  const REQUIRED_ACCURACY = 5;

  // useEffect(() => {
  //   if (!navigator.geolocation) return;

  //   const watchId = navigator.geolocation.watchPosition(
  //     (pos) => {
  //       setCoords({
  //         lat: pos.coords.latitude,
  //         lng: pos.coords.longitude,
  //       });

  //       setAccuracy(pos.coords.accuracy);
  //     },
  //     (err) => console.log(err),
  //     {
  //       enableHighAccuracy: true,
  //       maximumAge: 0,
  //     },
  //   );

  //   return () => navigator.geolocation.clearWatch(watchId);
  // }, []);
  useEffect(() => {
    if (!navigator.geolocation) {
      console.log('NO GEOLOCATION SUPPORT');
      return;
    }

    console.log('REQUESTING GPS...');

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        console.log('GPS OK:', pos);

        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });

        setAccuracy(pos.coords.accuracy);
      },
      (err) => {
        console.log('GPS ERROR:', err);

        alert(`GPS ERROR: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );

    return () => {
      console.log('CLEARING WATCH');
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const ready = coords && accuracy && accuracy <= REQUIRED_ACCURACY;

  const sendLocation = () => {
    const link = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

    alert(`
TOKEN: ${token}

LOCATION SENT:
${link}
    `);

    setSent(true);
  };

  if (sent) {
    return <h3>Location sent successfully ✅</h3>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h3>Roadside Location Share</h3>

      <p>Request ID: {token}</p>

      {!accuracy && <p>Waiting for GPS...</p>}

      {accuracy && <p>Accuracy: {Math.round(accuracy)}m</p>}

      {!ready && accuracy && <p>Waiting for precise GPS (≤ 5m)</p>}

      <button disabled={!ready} onClick={sendLocation}>
        Send Location
      </button>
    </div>
  );
}
