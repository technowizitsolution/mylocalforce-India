import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './StateComponents';

const RoleProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user, userRoles, isLoading } = useAuth();

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !userRoles?.roles?.[requiredRole]) {
    const roleMap = {
      customer: '/customer',
      client: '/provider',
      admin: '/admin',
    };
    
    // Determine where to redirect based on user's actual roles
    const userActualRole = Object.keys(userRoles?.roles || {}).find(
      role => userRoles?.roles?.[role]
    );
    const redirectPath = roleMap[userActualRole] || '/';
    
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default RoleProtectedRoute;