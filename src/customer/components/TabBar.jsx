import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, List, Calendar, User } from 'react-feather';

// Tab configuration with icons and routes
const tabs = [
  { name: 'Home', path: '/customer', Icon: Home },
  { name: 'Services', path: '/customer/services', Icon: List },
  { name: 'Bookings', path: '/customer/bookings', Icon: Calendar },
  { name: 'Profile', path: '/customer/profile', Icon: User },
];

const TabBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="bg-white border-t border-gray-200 h-16 flex items-center justify-around">
      {tabs.map(({ name, path, Icon }) => (
        <button
          key={path}
          onClick={() => navigate(path)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-200 ${
            isActive(path)
              ? 'text-blue-500 '
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Icon size={24} />
          <span className="text-xs font-medium">{name}</span>
        </button>
      ))}
    </div>
  );
};

export default TabBar;