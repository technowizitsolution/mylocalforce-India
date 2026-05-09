import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './StateComponents';
import { getSignedInHomePath } from '../utils/providerFlow';

const UnknownRouteRedirect = () => {
  const { isAuthenticated, user, userRoles, activeRole, isLoading } = useAuth();

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const destination = getSignedInHomePath({
    user,
    roles: userRoles?.roles,
    activeRole,
  });

  return <Navigate to={destination} replace />;
};

export default UnknownRouteRedirect;
