import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dispatcher from './Dispatcher';
import LocationShare from './LocationShare';
import RequestsDashboard from './RequestsDashboard';
import TestPings from './TestPings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home: live dashboard of all requests */}
        <Route path="/" element={<RequestsDashboard />} />

        {/* Create a new request */}
        <Route path="/new" element={<Dispatcher />} />

        {/* Test-only: raw list of location pings */}
        <Route path="/test" element={<TestPings />} />

        {/* Location page (SMS link) */}
        <Route path="/location/:token" element={<LocationShare />} />
      </Routes>
    </BrowserRouter>
  );
}
