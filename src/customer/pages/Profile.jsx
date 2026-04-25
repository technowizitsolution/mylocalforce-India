import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiUser,
  FiEdit2,
  FiEdit3,
  FiRefreshCw,
  FiCalendar,
  FiGift,
  FiBell,
  FiLogOut,
  FiChevronRight,
  FiBookmark,
  FiClock,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { fetchUserRoles } from '../../services/firebase';
import { fetchUserBookings } from '../../services/firebase/serviceService';
import { notify, getUserFacingError } from '../../utils/toast';

const Profile = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, logout } = useAuth();

  const [stats, setStats] = useState({
    totalBookings: 0,
    totalSpent: 0,
    avgRating: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const loadUserStats = async () => {
      if (!isLoggedIn || !user?.uid) {
        setLoadingStats(false);
        return;
      }

      try {
        setLoadingStats(true);
        const bookings = await fetchUserBookings(user.uid);

        const completedBookings = bookings.filter(
          (b) => b.status === 'completed' || b.status === 'paid'
        );
        const totalBookings = completedBookings.length;
        const totalSpent = completedBookings.reduce(
          (sum, b) => sum + (parseFloat(b.totalAmount) || 0),
          0
        );

        const ratedBookings = completedBookings.filter((b) => b.rating);
        const avgRating =
          ratedBookings.length > 0
            ? ratedBookings.reduce((sum, b) => sum + b.rating, 0) /
              ratedBookings.length
            : 0;

        setStats({ totalBookings, totalSpent, avgRating });
      } catch (error) {
        console.error('Error loading user stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    loadUserStats();
  }, [isLoggedIn, user?.uid]);

  const handleSwitchRole = async () => {
    try {
      const { roles } = await fetchUserRoles(user.uid);
      const availableRoles = Object.keys(roles || {}).filter((r) => roles[r]);

      if (availableRoles.includes('client') || availableRoles.includes('provider')) {
        notify.success('Switching to provider mode.', { id: 'profile-switch-role' });
        navigate('/provider');
      } else {
        notify.warning('Provider mode is not available for this account.', {
          id: 'profile-switch-role',
        });
      }
    } catch (error) {
      notify.error(getUserFacingError(error, 'Could not check available roles.'), {
        id: 'profile-switch-role',
      });
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleLogout = async () => {
    const result = await logout();
    if (result?.success) {
      notify.success('Signed out.', { id: 'profile-logout' });
      return;
    }

    notify.error(result?.error || 'Could not sign out. Please try again.', {
      id: 'profile-logout',
    });
  };

  // ─── Logged-out state ──────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        {/* Desktop: card centered with max-width */}
        <div className="w-full max-w-md lg:max-w-lg bg-white lg:rounded-3xl lg:shadow-2xl lg:p-12 p-6 flex flex-col items-center">
          <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-linear-to-br from-[#6C63FF] to-[#4ECDC4] flex items-center justify-center shadow-lg">
            <FiUser className="text-white" size={40} />
          </div>

          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 mt-6 mb-2 text-center">
            Welcome to MyLocalForce
          </h1>
          <p className="text-sm lg:text-base text-slate-500 text-center mb-8">
            Please login to access your profile
          </p>

          <button
            onClick={handleLogin}
            className="w-full bg-linear-to-r from-[#6C63FF] to-[#4ECDC4] text-white font-bold py-3.5 px-8 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 mb-8 lg:text-lg"
          >
            Login / Sign Up
          </button>

          <div className="w-full space-y-4">
            {[
              { icon: FiBookmark, text: 'Save favorite services' },
              { icon: FiClock, text: 'Track your bookings' },
              { icon: FiGift, text: 'Get exclusive offers' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Icon className="text-[#6C63FF]" size={20} />
                </div>
                <span className="text-slate-500 text-sm lg:text-base">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Menu items config ─────────────────────────────────────────────
  const menuItems = [
    { icon: FiCalendar, label: 'My Bookings', path: '/customer/bookings' },
    { icon: FiEdit3, label: 'Edit Profile', path: '/customer/edit-profile' },
    { icon: FiGift, label: 'Accepted Offers', path: '/customer/accepted-leads' },
    { icon: FiBell, label: 'Notifications', path: '/customer/notifications' },
  ];

  // ─── Logged-in state ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop wrapper — centers content with max-width on large screens */}
      <div className="lg:max-w-3xl xl:max-w-4xl lg:mx-auto lg:py-10">
        {/* ── Desktop page title ─────────────────────────── */}
        <h1 className="hidden lg:block text-3xl font-bold text-slate-800 mb-8 px-1">
          My Profile
        </h1>

        {/* ── Profile Header ─────────────────────────────── */}
        <div className="flex items-center p-4 bg-white mb-3 shadow-sm lg:rounded-2xl lg:shadow-md lg:p-8 lg:mb-6 transition-shadow hover:shadow-lg">
          {/* Avatar */}
          <div className="w-12 h-12 lg:w-20 lg:h-20 rounded-full bg-linear-to-br from-[#6C63FF] to-[#4ECDC4] flex items-center justify-center overflow-hidden ring-4 ring-indigo-100 shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <FiUser className="text-white" size={24} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 ml-3 lg:ml-6 min-w-0">
            <h2 className="text-lg lg:text-2xl font-bold text-slate-800 truncate">
              {user?.name || 'User'}
            </h2>
            <p className="text-sm lg:text-base text-slate-500 truncate">
              {user?.email || 'user@example.com'}
            </p>
            <p className="text-sm lg:text-base text-slate-400 truncate">
              {user?.phone || '+1234567890'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => navigate('/customer/edit-profile')}
              className="p-2 lg:p-3 rounded-xl hover:bg-indigo-50 transition-colors"
              title="Edit Profile"
            >
              <FiEdit2 className="text-[#6C63FF]" size={20} />
            </button>
            <button
              onClick={handleSwitchRole}
              className="p-2 lg:p-3 rounded-xl hover:bg-indigo-50 transition-colors"
              title="Switch Role"
            >
              <FiRefreshCw className="text-[#6C63FF]" size={20} />
            </button>
          </div>
        </div>

        {/* ── Quick Stats ────────────────────────────────── */}
        <div className="flex bg-white mb-3 py-5 shadow-sm lg:rounded-2xl lg:shadow-md lg:py-8 lg:mb-6 transition-shadow hover:shadow-lg">
          {loadingStats ? (
            <div className="flex-1 flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {[
                { value: stats.totalBookings, label: 'Services Booked' },
                { value: `$${stats.totalSpent.toFixed(0)}`, label: 'Total Spent' },
                {
                  value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A',
                  label: 'Avg Rating',
                },
              ].map(({ value, label }, i) => (
                <div
                  key={label}
                  className={`flex-1 flex flex-col items-center ${
                    i < 2 ? 'border-r border-slate-100' : ''
                  }`}
                >
                  <span className="text-lg lg:text-2xl font-bold text-[#6C63FF]">
                    {value}
                  </span>
                  <span className="text-xs lg:text-sm text-slate-500 mt-1">
                    {label}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Menu Options ───────────────────────────────── */}
        <div className="bg-white mb-6 shadow-sm lg:rounded-2xl lg:shadow-md lg:mb-6 overflow-hidden transition-shadow hover:shadow-lg">
          {menuItems.map(({ icon: MenuIcon, label, path }, i) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center p-4 lg:px-8 lg:py-5 hover:bg-slate-50 active:bg-slate-100 transition-colors ${
                i < menuItems.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <MenuIcon className="text-[#6C63FF]" size={20} />
              </div>
              <span className="flex-1 text-left ml-4 text-base lg:text-lg text-slate-800 font-medium">
                {label}
              </span>
              <FiChevronRight className="text-slate-400" size={20} />
            </button>
          ))}
        </div>

        {/* ── Logout Button ──────────────────────────────── */}
        <div className="px-4 lg:px-0 mb-8">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-red-300 text-red-500 font-semibold rounded-xl hover:bg-red-50 hover:border-red-400 active:bg-red-100 transition-all lg:rounded-2xl lg:py-4 lg:text-lg"
          >
            <FiLogOut size={20} />
            Logout
          </button>
        </div>

        {/* ── App Info ────────────────────────────────────── */}
        <div className="text-center pb-8 lg:pb-4">
          <p className="text-lg font-bold text-[#6C63FF]">MyLocalForce</p>
          <p className="text-sm text-slate-400 mt-0.5">Version 1.0.0</p>
          <p className="text-xs text-slate-400 italic mt-0.5">
            Developed by Technowiz IT Solution
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
