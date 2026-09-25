import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const authString = localStorage.getItem('whiskytix_auth');

  if (!authString) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  try {
    const auth = JSON.parse(authString);
    if (!auth || !auth.email) {
      localStorage.removeItem('whiskytix_auth');
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }
  } catch {
    localStorage.removeItem('whiskytix_auth');
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
