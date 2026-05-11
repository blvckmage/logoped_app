import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import ChildTrainer from './pages/ChildTrainer';
import ParentDashboard from './pages/ParentDashboard';
import TherapistDashboard from './pages/TherapistDashboard';
import History from './pages/History';
import NotFound from './pages/NotFound';
import './index.css';

function App() {
  return (
    <Router>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/child" element={<ChildTrainer />} />
              <Route path="/parent" element={<ParentDashboard />} />
              <Route path="/therapist" element={<TherapistDashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;