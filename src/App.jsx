import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { firebaseConfigured } from './firebase/config';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loading from './components/Loading';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ReportLost from './pages/ReportLost';
import ReportFound from './pages/ReportFound';
import BrowseReports from './pages/BrowseReports';
import MyReports from './pages/MyReports';
import Matches from './pages/Matches';
import AdminDashboard from './pages/AdminDashboard';

function Protected({ children, adminOnly = false }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading label="Checking your session..." />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      {!firebaseConfigured && (
        <div className="banner banner-error" role="alert">
          Firebase is not configured. Copy .env.example to .env and fill in the VITE_FIREBASE_* values.
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/browse" element={<BrowseReports />} />
          <Route path="/report/lost" element={<Protected><ReportLost /></Protected>} />
          <Route path="/report/found" element={<Protected><ReportFound /></Protected>} />
          <Route path="/my-reports" element={<Protected><MyReports /></Protected>} />
          <Route path="/matches" element={<Protected><Matches /></Protected>} />
          <Route path="/admin" element={<Protected adminOnly><AdminDashboard /></Protected>} />
          <Route path="*" element={<div className="page"><h1>Page not found</h1><p>Check the address or go back to the home page.</p></div>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
