import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ChildTrainer from './pages/ChildTrainer';
import ParentDashboard from './pages/ParentDashboard';
import TherapistDashboard from './pages/TherapistDashboard';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/child" element={<ChildTrainer />} />
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/therapist" element={<TherapistDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
