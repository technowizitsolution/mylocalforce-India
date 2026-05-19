import { useEffect, useState } from 'react';
import Hero from './Hero';
import Content from './Content';
import Mid from './Mid';
import Latest from './Latest';
import Footer from './Footer';
import PublicNavbar from './PublicNavbar';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './StateComponents';
import { getSignedInHomePath } from '../utils/providerFlow';
import { fetchAllServices } from '../services/firebase';
import useCategories from '../hooks/useCategories';

const Welcome = () => {
  const { isAuthenticated, user, userRoles, activeRole, isLoading } = useAuth();
  const { categories, loading: categoriesLoading } = useCategories();
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadServices = async () => {
      try {
        const fetchedServices = await fetchAllServices();
        if (mounted) setServices(Array.isArray(fetchedServices) ? fetchedServices : []);
      } catch (error) {
        console.error('Error loading welcome services:', error);
        if (mounted) setServices([]);
      } finally {
        if (mounted) setServicesLoading(false);
      }
    };

    loadServices();

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return <Loading fullScreen />;
  }

  const signedInHomePath = getSignedInHomePath({
    user,
    roles: userRoles?.roles,
    activeRole,
  });

  if (isAuthenticated && signedInHomePath !== '/') {
    return <Navigate to={signedInHomePath} replace />;
  }

  return (
    <div className="relative">
      <PublicNavbar variant="transparent" overlay />
      <Hero />
      <Content categories={categories} services={services} loading={categoriesLoading} />
      <Mid services={services} loading={servicesLoading} />
      <Latest services={services} loading={servicesLoading} />
      <Footer />
    </div>
  );
};

export default Welcome;
