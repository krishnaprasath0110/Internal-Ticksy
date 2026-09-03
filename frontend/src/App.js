import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import TicketsPage from './pages/tickets/TicketsPage';
import NewTicketPage from './pages/tickets/NewTicketPage';
import ProfilePage from './pages/profile/ProfilePage';
import MainLayout from './components/layout/MainLayout';
import CandidatesPage from './pages/users/CandidatesPage';
import AgentsPage from './pages/users/AgentsPage';
import TicketView from './pages/tickets/TicketView';
import DepartmentsPage from './pages/departments/DepartmentsPage';
import CategoriesPage from './pages/categories/CategoriesPage';
import UniversitiesPage from './pages/universities/UniversitiesPage';
import ProgramsPage from './pages/programs/ProgramsPage';
import BatchesPage from './pages/batches/BatchesPage';
import TemplatesPage from './pages/templates/TemplatesPage';

const PrivateRoute = ({ children, requireAdmin }) => {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Check if this is an SSO callback
  const params = new URLSearchParams(window.location.search);
  if (params.get('sso_data')) {
    // Let the page render to handle SSO
    return children;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role?.name !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const DefaultRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  // Check if this is an SSO callback
  const params = new URLSearchParams(window.location.search);
  if (params.get('sso_data')) {
    // Let the auth context handle SSO
    return null;
  }

  return (
    <Navigate 
      to={user?.role?.name === 'candidate' ? '/tickets' : '/dashboard'} 
      replace 
    />
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <DefaultRoute />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <DashboardPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <TicketsPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/tickets/:id"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <TicketView />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/tickets/new"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <NewTicketPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <ProfilePage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/candidates"
              element={
                <PrivateRoute requireAdmin>
                  <MainLayout>
                    <CandidatesPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="/agents"
              element={
                <PrivateRoute requireAdmin>
                  <MainLayout>
                    <AgentsPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="departments"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <DepartmentsPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="categories"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <CategoriesPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="universities"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <UniversitiesPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="programs"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <ProgramsPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="batches"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <BatchesPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
            <Route
              path="templates"
              element={
                <PrivateRoute>
                  <MainLayout>
                    <TemplatesPage />
                  </MainLayout>
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
