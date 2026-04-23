import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './StateComponents';

const RoleProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user, userRoles, isLoading } = useAuth();
  const resolvedRoles =
    userRoles?.roles && Object.keys(userRoles.roles).length > 0
      ? userRoles.roles
      : user?.roles || {};

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !resolvedRoles?.[requiredRole]) {
    const roleMap = {
      customer: '/customer',
      client: '/provider',
      admin: '/admin',
    };
    
    // Determine where to redirect based on user's actual roles
    const userActualRole = Object.keys(resolvedRoles || {}).find(
      role => resolvedRoles?.[role]
    );
    const redirectPath = roleMap[userActualRole] || '/';
    
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

export default RoleProtectedRoute;
