import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiCalendar,
  FiChevronLeft,
  FiEdit3,
  FiGift,
  FiLogOut,
  FiUser,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';

const AccountLayout = ({ title, subtitle, children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const displayName = user?.name || user?.displayName || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const accountNavItems = [
    { icon: FiUser, label: 'My Profile', path: '/customer/profile' },
    { icon: FiCalendar, label: 'My Bookings', path: '/customer/bookings' },
    { icon: FiGift, label: 'Accepted Offers', path: '/customer/accepted-leads' },
  ];

  const settingsNavItems = [
    { icon: FiEdit3, label: 'Edit Profile', path: '/customer/edit-profile' },
    { icon: FiBell, label: 'Notifications', path: '/customer/notifications' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  const handleNotificationPress = () => {
    navigate('/customer/notifications');
  };

  const renderNavItem = ({ icon: Icon, label, path }) => {
    const isActive = pathname === path;

    return (
      <button
        key={label}
        onClick={() => navigate(path)}
        className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
            : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
        }`}
        type="button"
      >
        <span
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isActive
              ? 'bg-[#6C63FF]/10 text-[#5A52E3]'
              : 'bg-slate-100 text-slate-500 group-hover:bg-[#6C63FF]/10 group-hover:text-[#5A52E3]'
          }`}
        >
          <Icon size={18} />
        </span>
        <span className="flex-1 text-left">{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] lg:grid lg:h-screen lg:grid-cols-[348px_minmax(0,1fr)] lg:overflow-hidden">
      <aside className="hidden bg-[#F8FAFC] text-slate-700 border-r border-slate-200 lg:flex min-h-0 flex-col">
        <div className="shrink-0 h-24 bg-[#F8FAFC] px-6 border-b border-slate-200 flex items-center">
          <button
            onClick={() => navigate('/customer')}
            className="flex items-center gap-3 text-left"
            type="button"
          >
            <img
              src="/images/MLF.jpg"
              alt="My Local Force logo"
              className="w-11 h-11 object-cover rounded-lg border border-slate-200 shadow-sm"
            />
            <span className="text-lg font-bold tracking-wide text-slate-900">
              MY LOCAL FORCE
            </span>
          </button>
        </div>

        <div className="px-6 py-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#6C63FF] to-[#4ECDC4] flex items-center justify-center overflow-hidden">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-white">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {displayName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold tracking-wider uppercase text-[#5A52E3] bg-[#6C63FF]/10 border border-[#6C63FF]/20 rounded-full px-3 py-1">
            Member
          </div>
        </div>

        <nav className="flex-1 min-h-0 px-3 py-4 space-y-6 overflow-y-auto">
          <div>
            <p className="px-3 text-xs uppercase tracking-widest text-slate-500 mb-2">
              Account
            </p>
            <div className="space-y-1">{accountNavItems.map(renderNavItem)}</div>
          </div>

          <div>
            <p className="px-3 text-xs uppercase tracking-widest text-slate-500 mb-2">
              Settings
            </p>
            <div className="space-y-1">{settingsNavItems.map(renderNavItem)}</div>
          </div>
        </nav>

        <div className="shrink-0 bg-[#F8FAFC] px-4 py-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
            type="button"
          >
            <span className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
              <FiLogOut size={18} />
            </span>
            Logout
          </button>
        </div>
      </aside>

      <section className="flex min-h-screen min-w-0 flex-col lg:min-h-0 lg:overflow-hidden">
        <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur lg:hidden">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => navigate('/customer/profile')}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm flex items-center justify-center"
                type="button"
                aria-label="Back to profile"
              >
                <FiChevronLeft size={20} />
              </button>
              <NotificationBell
                onPress={handleNotificationPress}
                size={20}
                color="#5A52E3"
                role="customer"
                bgColor="white"
              />
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Account
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </header>

        <header className="hidden shrink-0 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur lg:block">
          <div className="flex h-24 items-center justify-between px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {todayLabel}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell
                onPress={handleNotificationPress}
                size={20}
                color="#5A52E3"
                role="customer"
                bgColor="white"
              />
              <button
                onClick={() => navigate('/customer/profile')}
                className="relative w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:border-[#6C63FF]/40 hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
                type="button"
                aria-label="Open profile"
              >
                <FiUser className="w-5 h-5 text-[#5A52E3]" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 px-4 py-5 lg:px-8 lg:py-8 lg:overflow-y-auto">
          {children}
        </main>
      </section>
    </div>
  );
};

export default AccountLayout;
