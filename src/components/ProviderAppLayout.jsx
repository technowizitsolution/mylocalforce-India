import React, { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiHome,
  FiList,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi';
import NotificationBell from '../customer/components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { fetchUserRoles } from '../services/firebase';
import { notify } from '../utils/toast';

const providerNavItems = [
  { label: 'Home', path: '/provider/home' },
  { label: 'Services', path: '/provider/services' },
  { label: 'Bookings', path: '/provider/bookings' },
  { label: 'Earnings', path: '/provider/earnings' },
];

const providerTabs = [
  { label: 'Home', path: '/provider/home', Icon: FiHome },
  { label: 'Services', path: '/provider/services', Icon: FiList },
  { label: 'Bookings', path: '/provider/bookings', Icon: FiCalendar },
  { label: 'Earnings', path: '/provider/earnings', Icon: FiBarChart2 },
  { label: 'Profile', path: '/provider/profile', Icon: FiUser },
];

const providerDetailTitles = {
  '/provider/notifications': 'Notifications',
  '/provider/edit-profile': 'Edit Profile',
  '/provider/edit-details': 'Edit Details',
  '/provider/documents': 'Documents',
  '/provider/contact-support': 'Contact Support',
};

const ProviderAppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRoles, activeRole } = useAuth();

  const isProviderHomeRoute = location.pathname === '/provider/home';
  const isProviderPrimaryRoute = providerTabs.some((item) => item.path === location.pathname);
  const isProviderDetailRoute =
    location.pathname.startsWith('/provider/') && !isProviderPrimaryRoute;
  const mobileDetailTitle = providerDetailTitles[location.pathname] || 'Provider';
  const roles = userRoles?.roles || user?.roles || {};
  const homePath =
    activeRole === 'customer' && roles.customer
      ? '/customer'
      : '/provider/home';

  useEffect(() => {
    if (!user?.uid || !isProviderHomeRoute || typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(`mylocalforce:last-home-path:${user.uid}`, '/provider/home');
  }, [isProviderHomeRoute, user?.uid]);

  const handleSwitchRole = async () => {
    try {
      if (!user?.uid) {
        navigate('/login');
        return;
      }

      const { roles } = await fetchUserRoles(user.uid);
      const availableRoles = Object.keys(roles || {}).filter((role) => roles[role]);

      if (availableRoles.length > 1) {
        navigate('/role-selection');
        return;
      }

      notify.info('You only have the service provider role.');
    } catch (error) {
      notify.error('Failed to check available roles');
    }
  };

  const handleBackPress = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/provider/home', { replace: true });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F8FAFC] text-slate-900">
      <ProviderNavbar onSwitchRole={handleSwitchRole} />

      {isProviderPrimaryRoute ? (
        <ProviderMobileHeader
          variant="home"
          onSwitchRole={handleSwitchRole}
          onNotifications={() => navigate('/provider/notifications')}
        />
      ) : null}

      {isProviderDetailRoute ? (
        <ProviderMobileHeader
          variant="detail"
          title={mobileDetailTitle}
          onBack={handleBackPress}
          onNotifications={() => navigate('/provider/notifications')}
        />
      ) : null}

      <main
        className={`mx-auto min-w-0 w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8 lg:pt-8 ${
          isProviderPrimaryRoute ? 'pb-24 lg:pb-10' : 'pb-10'
        }`}
      >
        {children}
      </main>

      {isProviderPrimaryRoute ? <ProviderMobileTabBar homePath={homePath} /> : null}
    </div>
  );
};

const ProviderNavbar = ({ onSwitchRole }) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur lg:block">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-18 lg:px-8">
        <NavLink to="/provider/home" className="flex min-w-0 items-center gap-3">
          <img
            src="/images/MLF.jpg"
            alt="My Local Force"
            className="h-10 w-10 shrink-0 rounded object-cover lg:h-12 lg:w-12"
          />
          <span className="truncate text-sm font-semibold text-slate-950 sm:text-base lg:text-xl">
            MY LOCAL FORCE
          </span>
        </NavLink>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Provider navigation">
          {providerNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onSwitchRole}
            className="hidden h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-[#5A52E3] shadow-sm transition-colors hover:border-[#6C63FF]/40 hover:bg-indigo-50 sm:inline-flex"
          >
            <FiRefreshCw className="h-4 w-4" />
            Switch
          </button>

          <NotificationBell
            onPress={() => navigate('/provider/notifications')}
            size={20}
            color="#5A52E3"
            role="provider"
            bgColor="white"
          />

          <button
            type="button"
            onClick={() => navigate('/provider/profile')}
            className="relative hidden h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-[#6C63FF]/40 hover:bg-indigo-50 active:bg-indigo-100 lg:flex"
            aria-label="Provider profile"
          >
            <FiUser className="h-5 w-5 text-[#5A52E3]" />
          </button>
        </div>
      </div>
    </header>
  );
};

const ProviderMobileHeader = ({ variant, title, onBack, onSwitchRole, onNotifications }) => {
  if (variant === 'home') {
    return (
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={onSwitchRole}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-[#5A52E3] shadow-sm transition-colors hover:border-[#6C63FF]/40 hover:bg-indigo-50"
          >
            <FiBriefcase className="h-4 w-4" />
            <span>Provider</span>
            <FiChevronDown className="h-3.5 w-3.5" />
          </button>

          <NotificationBell
            onPress={onNotifications}
            size={20}
            color="#5A52E3"
            role="provider"
            bgColor="white"
          />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur lg:hidden">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-[#6C63FF]/40 hover:bg-indigo-50 hover:text-[#5A52E3]"
          aria-label="Go back"
        >
          <FiChevronLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Provider
          </p>
          <h1 className="truncate text-base font-semibold text-slate-950">{title}</h1>
        </div>

        <NotificationBell
          onPress={onNotifications}
          size={20}
          color="#5A52E3"
          role="provider"
          bgColor="white"
        />
      </div>
    </header>
  );
};

const ProviderMobileTabBar = ({ homePath = '/provider/home' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isHomeActive = location.pathname === homePath;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] lg:hidden">
      {providerTabs.map(({ label, path, Icon }) => {
        const targetPath = label === 'Home' ? homePath : path;
        const isActive = location.pathname === targetPath;

        return (
          <button
            key={label}
            type="button"
            onClick={() => navigate(targetPath)}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors duration-200 ${
              isActive
                ? 'text-indigo-600'
                : 'text-gray-500 hover:text-gray-700 active:text-gray-900'
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
            <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default ProviderAppLayout;
