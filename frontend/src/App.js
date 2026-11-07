import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isAdmin, isStudent } from './api/auth';

// Public
import Home    from './pages/Home';
import Login   from './pages/Login';
import Signup  from './pages/Signup';

// Student
import StudentHome     from './pages/student/StudentHome';
import GameCatalogue   from './pages/student/GameCatalogue';
import GameDetail      from './pages/student/GameDetail';
import PaymentPage     from './pages/student/PaymentPage';
import MyRegistrations from './pages/student/MyRegistrations';

// Admin
import AdminDashboard  from './pages/admin/AdminDashboard';
import ManageGames     from './pages/admin/ManageGames';
import ApprovalsQueue  from './pages/admin/ApprovalsQueue';
import AllUsers        from './pages/admin/AllUsers';
import UserDetail      from './pages/admin/UserDetail';
import SportManagement from './pages/admin/SportManagement';
import PaymentSettings from './pages/admin/PaymentSettings';
import Departments          from './pages/admin/Departments';
import ManualRegistration   from './pages/admin/ManualRegistration';

import './styles/App.css';

function RequireAdmin({ children }) {
  return isAdmin() ? children : <Navigate to="/login" replace />;
}
function RequireStudent({ children }) {
  return isStudent() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public */}
          <Route path="/"       element={<Home />} />
          <Route path="/login"  element={isAdmin() ? <Navigate to="/admin/dashboard" /> : isStudent() ? <Navigate to="/student/games" /> : <Login />} />
          <Route path="/signup" element={isStudent() ? <Navigate to="/student/games" /> : <Signup />} />
          {/* Redirect old admin login URL so bookmarks don't 404 */}
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />

          {/* Student */}
          <Route path="/student"               element={<RequireStudent><StudentHome /></RequireStudent>} />
          <Route path="/student/games"         element={<RequireStudent><GameCatalogue /></RequireStudent>} />
          <Route path="/student/games/:id"     element={<RequireStudent><GameDetail /></RequireStudent>} />
          <Route path="/student/games/:id/pay" element={<RequireStudent><PaymentPage /></RequireStudent>} />
          <Route path="/student/registrations" element={<RequireStudent><MyRegistrations /></RequireStudent>} />

          {/* Admin */}
          <Route path="/admin/dashboard"       element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/games"           element={<RequireAdmin><ManageGames /></RequireAdmin>} />
          <Route path="/admin/approvals"       element={<RequireAdmin><ApprovalsQueue /></RequireAdmin>} />
          <Route path="/admin/users"           element={<RequireAdmin><AllUsers /></RequireAdmin>} />
          <Route path="/admin/users/:id"       element={<RequireAdmin><UserDetail /></RequireAdmin>} />
          <Route path="/admin/sport/:gameId"   element={<RequireAdmin><SportManagement /></RequireAdmin>} />
          <Route path="/admin/payment-settings" element={<RequireAdmin><PaymentSettings /></RequireAdmin>} />
          <Route path="/admin/departments"          element={<RequireAdmin><Departments /></RequireAdmin>} />
          <Route path="/admin/register-student"     element={<RequireAdmin><ManualRegistration /></RequireAdmin>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
