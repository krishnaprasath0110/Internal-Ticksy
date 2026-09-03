import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute - User:', user); // Debug log
  console.log('ProtectedRoute - Loading:', loading); // Debug log
  console.log('ProtectedRoute - Current path:', location.pathname); // Debug log

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    console.log('ProtectedRoute - No user, redirecting to login'); // Debug log
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Define role-based routing
  const roleBasedRoutes = {
    admin: ['/admin', '/dashboard', '/tickets', '/department', '/category'],
    department_manager: ['/dashboard', '/tickets', '/department'],
    category_manager: ['/dashboard', '/tickets', '/category'],
    candidate: ['/dashboard','/tickets', '/profile'] // Add candidate routes
  };

  // // Get allowed routes for user's role
  // const allowedRoutes = roleBasedRoutes[user.role] || [];
  // console.log('ProtectedRoute - Allowed routes:', allowedRoutes); // Debug log

  // // Check if current path is allowed for user's role
  // const isAllowed = allowedRoutes.some(route => 
  //   location.pathname.startsWith(route)
  // );

  // if (!isAllowed) {
  //   console.log('ProtectedRoute - Unauthorized path for role:', user.role); // Debug log
  //   // Redirect to the first allowed route for their role
  //   const defaultRoute = allowedRoutes[0] || '/dashboard';
  //   return <Navigate to={defaultRoute} replace />;
  // }

  return children;
};

export default ProtectedRoute;
