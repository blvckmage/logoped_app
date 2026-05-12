import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import LoginPage from './pages/LoginPage';
import ChildTrainer from './pages/ChildTrainer';
import ParentDashboard from './pages/ParentDashboard';
import TherapistDashboard from './pages/TherapistDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import PatientDetail from './pages/PatientDetail';
import History from './pages/History';
import NotFound from './pages/NotFound';
import './index.css';
import type { ReactNode } from 'react';

// Role-based route guard
function RoleRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Child */}
              <Route path="/child" element={<ChildTrainer />} />

              {/* Parent */}
              <Route path="/parent" element={
                <RoleRoute roles={['parent', 'admin', 'superadmin']}>
                  <ParentDashboard />
                </RoleRoute>
              } />

              {/* Therapist */}
              <Route path="/therapist" element={
                <RoleRoute roles={['therapist', 'admin', 'superadmin']}>
                  <TherapistDashboard />
                </RoleRoute>
              } />

              {/* Patient detail */}
              <Route path="/patient/:id" element={
                <RoleRoute roles={['therapist', 'parent', 'admin', 'superadmin']}>
                  <PatientDetail />
                </RoleRoute>
              } />

              {/* Admin / SuperAdmin */}
              <Route path="/admin" element={
                <RoleRoute roles={['admin', 'superadmin']}>
                  <SuperAdminDashboard />
                </RoleRoute>
              } />
              <Route path="/superadmin" element={
                <RoleRoute roles={['superadmin']}>
                  <SuperAdminDashboard />
                </RoleRoute>
              } />

              {/* History */}
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