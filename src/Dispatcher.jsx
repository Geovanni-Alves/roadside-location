import { useState } from "react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "./supabase";

// sms: URI scheme is inconsistent across platforms: iOS wants "&body=",
// Android wants "?body=". This builds the right one from the user agent.
// It's a stopgap until real SMS automation (Twilio) is wired up - it
// still requires the dispatcher to tap "send" in their own messages app.
function buildSmsLink(phone, message) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? "&" : "?";
  return `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
}

export default function Dispatcher() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    car: "",
  });

  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const createRequest = async () => {
    setLoading(true);

    try {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const { data, error } = await supabase
        .from("requests")
        .insert([
          {
            token,
            name: form.name,
            phone: form.phone,
            car: form.car,
            status: "waiting_location",
            expires_at: expiresAt,
          },
        ])
        .select()
        .single();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      const url = `${window.location.origin}/location/${token}`;
      setLink(url);

      const message = `Roadside Assistance: please open this secure link to share your location: ${url} (one-time use, expires in 5 minutes)`;
      setSmsMessage(message);
    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(smsMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial", maxWidth: 480, margin: "0 auto" }}>
      <Link to="/" style={{ fontSize: 14, color: "#2563eb" }}>
        ← Back to requests
      </Link>

      <h2>New Request</h2>

      <input
        placeholder="Customer Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        style={{ width: "100%", padding: 8, marginBottom: 10 }}
      />

      <input
        placeholder="Phone Number"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        style={{ width: "100%", padding: 8, marginBottom: 10 }}
      />

      <input
        placeholder="Car Model"
        value={form.car}
        onChange={(e) => setForm({ ...form, car: e.target.value })}
        style={{ width: "100%", padding: 8, marginBottom: 10 }}
      />

      <button onClick={createRequest} disabled={loading || !form.phone} style={{ padding: 10, width: "100%" }}>
        {loading ? "Creating..." : "Create Request"}
      </button>

      {link && (
        <div style={{ marginTop: 24, padding: 14, border: "1px solid #e5e7eb", borderRadius: 10 }}>
          <h3 style={{ marginTop: 0 }}>Link ready</h3>
          <p style={{ fontSize: 13, wordBreak: "break-all", color: "#4b5563" }}>{link}</p>

          <a
            href={buildSmsLink(form.phone, smsMessage)}
            style={{
              display: "block",
              textAlign: "center",
              padding: 12,
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
              textDecoration: "none",
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            📱 Send via SMS
          </a>

          <button onClick={copyMessage} style={{ padding: 10, width: "100%" }}>
            {copied ? "Copied ✅" : "Copy message"}
          </button>

          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 10, marginBottom: 0 }}>
            "Send via SMS" opens your phone's messages app with the text
            pre-filled - you still need to tap send there. Only works when
            this page is open on a phone.
          </p>

          <Link
            to="/"
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 12,
              fontSize: 14,
              color: "#2563eb",
            }}
          >
            View requests dashboard →
          </Link>
        </div>
      )}
    </div>
  );
}
