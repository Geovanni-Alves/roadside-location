import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dispatcher from './Dispatcher';
import LocationShare from './LocationShare';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Dispatcher (main dashboard) */}
        <Route path="/" element={<Dispatcher />} />

        {/* Location page (SMS link) */}
        <Route path="/location/:token" element={<LocationShare />} />
      </Routes>
    </BrowserRouter>
  );
}
