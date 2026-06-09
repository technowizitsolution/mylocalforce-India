import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CustomerNavbar from './components/CustomerNavbar';
import TabBar from './components/TabBar';
import FloatingAiSupport from '../components/FloatingAiSupport';
import { useAuth } from '../context/AuthContext';

const Customer = () => {
  const location = useLocation();
  const { user } = useAuth();
  const showTabBar = location.pathname === '/customer';

  useEffect(() => {
    if (!user?.uid || location.pathname !== '/customer' || typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(`mylocalforce:last-home-path:${user.uid}`, '/customer');
  }, [location.pathname, user?.uid]);

  return (
    <div className="flex h-dvh w-full flex-col bg-gray-50">
      <main
        id="customer-scroll-root"
        className={`flex-1 overflow-y-auto overflow-x-hidden ${
          showTabBar ? 'pb-[calc(4rem+env(safe-area-inset-bottom))]' : 'pb-0'
        } lg:pb-0`}
      >
        <CustomerNavbar />
        <Outlet />
      </main>
      {showTabBar ? (
        <nav className="fixed bottom-0 left-0 right-0 z-40 w-full lg:hidden">
          <TabBar />
        </nav>
      ) : null}
      <FloatingAiSupport role="customer" />
    </div>
  );
};

export default Customer;
