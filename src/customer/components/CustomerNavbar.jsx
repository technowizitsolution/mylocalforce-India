import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiUser } from 'react-icons/fi';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { fetchUserRoles } from '../../services/firebase';
import { notify } from '../../utils/toast';

const customerNavItems = [
  { label: 'Home', path: '/customer' },
  { label: 'Services', path: '/customer/services' },
  { label: 'Bookings', path: '/customer/bookings' },
];

const CustomerNavbar = ({ scrollTargetId = 'customer-scroll-root' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRoles, isLoggedIn } = useAuth();
  const [hasScrolled, setHasScrolled] = useState(false);

  const roles = userRoles?.roles || user?.roles || {};
  const canSwitchRole = Boolean(roles.customer && roles.client);
  const isHome = location.pathname === '/customer';
  const isTransparent = isHome && !hasScrolled;

  useEffect(() => {
    const scrollTarget = document.getElementById(scrollTargetId);
    if (!scrollTarget) return undefined;

    const updateScrollState = () => {
      setHasScrolled(scrollTarget.scrollTop > 8);
    };

    updateScrollState();
    scrollTarget.addEventListener('scroll', updateScrollState, { passive: true });

    return () => {
      scrollTarget.removeEventListener('scroll', updateScrollState);
    };
  }, [scrollTargetId, location.pathname]);

  const handleSwitchRole = async () => {
    try {
      if (!isLoggedIn || !user?.uid) {
        navigate('/login');
        return;
      }

      const { roles: latestRoles } = await fetchUserRoles(user.uid);
      const availableRoles = Object.keys(latestRoles || {}).filter((role) => latestRoles[role]);

      if (availableRoles.length > 1) {
        navigate('/role-selection');
        return;
      }

      notify.info('No other role is available for this account.');
    } catch (error) {
      notify.error('Failed to check available roles.');
    }
  };

  return (
    <header
      className={`sticky top-0 z-30 hidden transition-colors duration-300 lg:block ${
        isHome ? '-mb-20' : ''
      } ${
        isTransparent
          ? 'bg-transparent text-white'
          : 'border-b border-gray-200 bg-white/95 text-gray-950 shadow-sm backdrop-blur'
      }`}
    >
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-6 px-8">
        <button
          type="button"
          onClick={() => navigate('/customer')}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <img
            src="/images/MLF.jpg"
            alt="My Local Force"
            className="h-12 w-12 shrink-0 rounded object-cover"
          />
          <span className="truncate text-xl font-extrabold">MY LOCAL FORCE</span>
        </button>

        <nav className="flex items-center gap-1" aria-label="Customer navigation">
          {customerNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/customer'}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isTransparent
                    ? isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                    : isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {canSwitchRole ? (
            <button
              type="button"
              onClick={handleSwitchRole}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold shadow-sm transition-colors ${
                isTransparent
                  ? 'border-white/60 bg-white/10 text-white hover:bg-white/20'
                  : 'border-slate-200 bg-white text-[#5A52E3] hover:border-[#6C63FF]/40 hover:bg-indigo-50'
              }`}
            >
              <FiRefreshCw className="h-4 w-4" />
              Switch
            </button>
          ) : null}

          <NotificationBell
            onPress={() => navigate('/customer/notifications')}
            size={20}
            color="#5A52E3"
            role="customer"
            bgColor="white"
          />

          <button
            type="button"
            onClick={() => navigate('/customer/profile')}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-[#6C63FF]/40 hover:bg-indigo-50 active:bg-indigo-100"
            aria-label="Customer profile"
          >
            <FiUser className="h-5 w-5 text-[#5A52E3]" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default CustomerNavbar;
