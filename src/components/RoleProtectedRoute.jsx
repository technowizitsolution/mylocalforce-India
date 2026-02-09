import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './StateComponents';

const RoleProtectedRoute = ({ children, requiredRole }) => {
  const isAuthenticated = true;
  const user = { role: 'customer' };
  const loading = false;

  if (loading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    const roleMap = {
      customer: '/customer',
      provider: '/provider',
    };
    return <Navigate to={roleMap[user?.role] || '/'} replace />;
  }

  return children;
};

export default RoleProtectedRoute;