import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

export default function Dispatcher() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    car: '',
  });

  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');

  const createRequest = async () => {
    setLoading(true);

    try {
      // 1. Create secure token
      const token = uuidv4();

      // 2. Save request in Supabase
      const { error } = await supabase.from('requests').insert({
        token,
        name: form.name,
        phone: form.phone,
        car: form.car,
        status: 'waiting_location',
      });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      // 3. Generate real link (production-ready format)
      const url = `${window.location.origin}/location/${token}`;

      setLink(url);

      // 4. SMS message format (copy/paste ready)
      const smsMessage = `
Roadside Assistance Request

Please open this secure link to share your location:

${url}

This link is:
- One-time use only
- Secure
- Used only for dispatch tracking
      `;

      console.log('SMS MESSAGE:', smsMessage);
    } catch (err) {
      console.log(err);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      {/* <h2>Dispatcher Panel</h2> */}
      <h2>testing deployment</h2>
      <input
        placeholder="Customer Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <br />
      <br />

      <input
        placeholder="Phone Number"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />

      <br />
      <br />

      <input
        placeholder="Car Model"
        value={form.car}
        onChange={(e) => setForm({ ...form, car: e.target.value })}
      />

      <br />
      <br />

      <button onClick={createRequest} disabled={loading}>
        {loading ? 'Creating...' : 'Create Request'}
      </button>

      {link && (
        <div style={{ marginTop: 20 }}>
          <h3>Generated Link</h3>
          <a href={link}>{link}</a>

          <p style={{ marginTop: 10 }}>(Copy this to SMS / WhatsApp)</p>
        </div>
      )}
    </div>
  );
}
