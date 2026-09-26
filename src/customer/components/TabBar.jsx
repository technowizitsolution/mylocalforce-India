import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiHome, FiList, FiCalendar, FiUser } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

// Tab configuration with icons and routes
const tabs = [
  { name: 'Services', path: '/customer/services', Icon: FiList },
  { name: 'Bookings', path: '/customer/bookings', Icon: FiCalendar },
  { name: 'Profile', path: '/customer/profile', Icon: FiUser },
];

const TabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRoles, activeRole } = useAuth();

  const roles = userRoles?.roles || user?.roles || {};
  const homePath =
    activeRole === 'client' && roles.client
      ? '/provider/home'
      : '/customer';
  const isHomeActive = location.pathname === homePath;

  const isActive = (path) => {
    if (path === '/customer/profile') {
      return [
        '/customer/profile',
        '/customer/edit-profile',
        '/customer/notifications',
        '/customer/accepted-leads',
        '/customer/leads',
      ].includes(location.pathname) || location.pathname.startsWith('/customer/leads/');
    }

    return location.pathname === path;
  };

  return (
    <div className="bg-white border-t border-gray-200 flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        onClick={() => navigate(homePath)}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] transition-colors duration-200 ${
          isHomeActive
            ? 'text-indigo-600'
            : 'text-gray-500 hover:text-gray-700 active:text-gray-900'
        }`}
      >
        <FiHome className={`w-5 h-5 sm:w-6 sm:h-6 ${isHomeActive ? 'stroke-[2.5]' : ''}`} />
        <span className={`text-[10px] sm:text-xs font-medium ${isHomeActive ? 'font-semibold' : ''}`}>
          Home
        </span>
      </button>

      {tabs.map(({ name, path, Icon }) => (
        <button
          key={path}
          onClick={() => navigate(path)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[48px] transition-colors duration-200 ${
            isActive(path)
              ? 'text-indigo-600'
              : 'text-gray-500 hover:text-gray-700 active:text-gray-900'
          }`}
        >
          <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${isActive(path) ? 'stroke-[2.5]' : ''}`} />
          <span className={`text-[10px] sm:text-xs font-medium ${isActive(path) ? 'font-semibold' : ''}`}>
            {name}
          </span>
        </button>
      ))}
    </div>
  );
};

export default TabBar;
