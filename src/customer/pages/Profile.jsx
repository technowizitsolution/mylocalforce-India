import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiUser,
  FiEdit2,
  FiEdit3,
  FiRefreshCw,
  FiCalendar,
  FiGift,
  FiInbox,
  FiBell,
  FiBellOff,
  FiHelpCircle,
  FiLogOut,
  FiChevronRight,
  FiBookmark,
  FiClock,
  FiCheck,
  FiSlash,
  FiTrash2,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import {
  fetchUserRoles,
  deactivateCurrentUserAccount,
  deleteCurrentUserAccount,
  requestNotificationPermission,
  isAppPushPermissionEnabled,
  updatePushNotificationPreference,
} from '../../services/firebase';
import { fetchUserBookings } from '../../services/firebase/serviceService';
import { notify, getUserFacingError } from '../../utils/toast';

const isToggleExplicitlyDisabled = (value) => {
  if (value === false) return true;
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['false', '0', 'no', 'off', 'disabled'].includes(normalized);
};

const Profile = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isLoggedIn, user, logout, refreshUserData } = useAuth();

  const [stats, setStats] = useState({
    totalBookings: 0,
    totalSpent: 0,
    avgRating: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [accountActionLoading, setAccountActionLoading] = useState(false);
  const [customerPushEnabled, setCustomerPushEnabled] = useState(true);
  const [pushPreferenceUpdating, setPushPreferenceUpdating] = useState(false);

  useEffect(() => {
    const notificationSettings =
      user?.notificationSettings && typeof user.notificationSettings === 'object'
        ? user.notificationSettings
        : {};
    const disabled =
      isToggleExplicitlyDisabled(user?.pushNotificationsEnabled) ||
      isToggleExplicitlyDisabled(notificationSettings.pushEnabled) ||
      isToggleExplicitlyDisabled(notificationSettings.customerPushEnabled) ||
      isToggleExplicitlyDisabled(notificationSettings.providerPushEnabled);

    setCustomerPushEnabled(!disabled);
  }, [
    user?.pushNotificationsEnabled,
    user?.notificationSettings,
    user?.notificationSettings?.pushEnabled,
    user?.notificationSettings?.customerPushEnabled,
    user?.notificationSettings?.providerPushEnabled,
  ]);

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
            ? ratedBookings.reduce((sum, b) => sum + b.rating, 0) / ratedBookings.length
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

      if (availableRoles.length > 1) {
        navigate('/role-selection');
      } else {
        notify.warning('No other role is available for this account.', {
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

  const handleContactSupport = () => {
    navigate('/customer/contact-support');
  };

  const getAccountErrorMessage = (error, fallbackMessage) => {
    if (error?.code === 'auth/requires-recent-login') {
      return 'For security reasons, please log in again and retry deleting your account.';
    }

    return error?.message || fallbackMessage;
  };

  const runDeactivateAccount = async () => {
    if (accountActionLoading) return;

    try {
      setAccountActionLoading(true);
      await deactivateCurrentUserAccount('customer');
      await logout();
      notify.success(
        'Your customer profile has been deactivated. Log in and choose Customer to reactivate it.',
        { id: 'profile-deactivate' }
      );
      navigate('/login');
    } catch (error) {
      notify.error(
        getUserFacingError(
          error,
          getAccountErrorMessage(
            error,
            'Something went wrong while deactivating your account. Please try again.'
          )
        ),
        { id: 'profile-deactivate' }
      );
    } finally {
      setAccountActionLoading(false);
    }
  };

  const handleDeactivateAccount = () => {
    if (accountActionLoading) return;
    const confirmed = window.confirm('This will deactivate only your customer profile. Continue?');
    if (!confirmed) return;
    runDeactivateAccount();
  };

  const runDeleteAccount = async () => {
    if (accountActionLoading) return;

    try {
      setAccountActionLoading(true);
      const result = await deleteCurrentUserAccount('customer');

      if (result?.mode === 'role-removed') {
        await refreshUserData?.();
        const rolesData = await fetchUserRoles(user?.uid);
        const roles = rolesData?.roles || {};
        notify.success('Your customer role has been deleted. Redirecting to your remaining role.', {
          id: 'profile-delete',
        });
        if (roles.client) {
          navigate('/provider');
        } else if (roles.customer) {
          navigate('/customer');
        } else {
          navigate('/login');
        }
        return;
      }

      await logout().catch(() => {});
      notify.success('Your account has been permanently deleted.', {
        id: 'profile-delete',
      });
      navigate('/login');
    } catch (error) {
      notify.error(
        getUserFacingError(
          error,
          getAccountErrorMessage(
            error,
            'Something went wrong while deleting your account. Please try again.'
          )
        ),
        { id: 'profile-delete' }
      );
    } finally {
      setAccountActionLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    if (accountActionLoading) return;
    const confirmed = window.confirm(
      'This will permanently delete your account. If you have multiple roles, only your customer role will be removed. Continue?'
    );
    if (!confirmed) return;
    runDeleteAccount();
  };

  const handlePushPreferenceToggle = async (nextValue) => {
    if (!user?.uid || pushPreferenceUpdating) return;

    const actionText = nextValue ? 'enable' : 'disable';
    const confirmed = window.confirm(`Do you want to ${actionText} push notifications?`);
    if (!confirmed) return;

    if (nextValue) {
      const permissionGranted = await requestNotificationPermission();
      const systemPushEnabled = await isAppPushPermissionEnabled();
      if (!permissionGranted || !systemPushEnabled) {
        notify.warning(
          'Push notifications are off in your browser settings. Please enable them to receive updates.',
          { id: 'profile-push' }
        );
        return;
      }
    }

    const previousValue = customerPushEnabled;
    setCustomerPushEnabled(nextValue);
    setPushPreferenceUpdating(true);

    try {
      await updatePushNotificationPreference(user.uid, 'customer', nextValue);
      notify.success(`Push notifications ${nextValue ? 'enabled' : 'disabled'}.`, {
        id: 'profile-push',
      });
    } catch (error) {
      setCustomerPushEnabled(previousValue);
      notify.error(
        getUserFacingError(
          error,
          'We could not update your push notification preference. Please try again.'
        ),
        { id: 'profile-push' }
      );
    } finally {
      setPushPreferenceUpdating(false);
    }
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
    { icon: FiInbox, label: 'My Leads', path: '/customer/leads' },
    { icon: FiGift, label: 'Accepted Offers', path: '/customer/accepted-leads' },
    { icon: FiBell, label: 'Notifications', path: '/customer/notifications' },
  ];

  const displayName = user?.name || user?.displayName || 'User';
  const greetingName = displayName.split(' ')[0] || 'there';
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

  const profileChecklist = [
    { label: 'Full name added', done: Boolean(user?.name || user?.displayName) },
    { label: 'Email verified', done: Boolean(user?.email) },
    { label: 'Phone number saved', done: Boolean(user?.phone) },
    { label: 'Profile photo uploaded', done: Boolean(user?.photoURL) },
  ];

  const profileCompletion = Math.round(
    (profileChecklist.filter((item) => item.done).length / profileChecklist.length) * 100
  );

  const nextProfileStep = profileChecklist.find((item) => !item.done);
  const profileCompletionMessage = nextProfileStep
    ? `Next step: ${nextProfileStep.label.toLowerCase()}.`
    : 'Profile is fully completed.';

  const bookingsBadge = !loadingStats && stats.totalBookings > 0 ? stats.totalBookings : null;

  const accountNavItems = [
    { icon: FiUser, label: 'My Profile', path: '/customer/profile' },
    {
      icon: FiCalendar,
      label: 'My Bookings',
      path: '/customer/bookings',
      badge: bookingsBadge,
    },
    { icon: FiInbox, label: 'My Leads', path: '/customer/leads' },
    { icon: FiGift, label: 'Accepted Offers', path: '/customer/accepted-leads' },
  ];

  const settingsNavItems = [
    { icon: FiEdit3, label: 'Edit Profile', path: '/customer/edit-profile' },
    { icon: FiBell, label: 'Notifications', path: '/customer/notifications' },
  ];

  const desktopActions = [
    {
      icon: FiCalendar,
      label: 'My Bookings',
      description: 'Track upcoming, active, and past service bookings.',
      path: '/customer/bookings',
      badge: bookingsBadge ? `${bookingsBadge} total` : 'No bookings yet',
      badgeClass: 'bg-[#6C63FF]/10 text-[#6C63FF]',
      iconBg: 'bg-[#6C63FF]/10',
      iconColor: 'text-[#6C63FF]',
    },
    {
      icon: FiEdit3,
      label: 'Edit Profile',
      description: 'Update your name, contact info, and preferences.',
      path: '/customer/edit-profile',
      badge: profileCompletion === 100 ? 'Complete' : `${profileCompletion}% complete`,
      badgeClass: 'bg-[#4ECDC4]/10 text-[#1E9E94]',
      iconBg: 'bg-[#4ECDC4]/10',
      iconColor: 'text-[#1E9E94]',
    },
    {
      icon: FiInbox,
      label: 'My Leads',
      description: 'Track your service requests and provider offers.',
      path: '/customer/leads',
      badge: 'View leads',
      badgeClass: 'bg-amber-50 text-amber-700',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      icon: FiGift,
      label: 'Accepted Offers',
      description: 'Review exclusive offers you have accepted.',
      path: '/customer/accepted-leads',
      badge: 'View offers',
      badgeClass: 'bg-[#6C63FF]/10 text-[#6C63FF]',
      iconBg: 'bg-[#6C63FF]/10',
      iconColor: 'text-[#6C63FF]',
    },
    {
      icon: FiBell,
      label: 'Notifications',
      description: 'Stay on top of booking reminders and updates.',
      path: '/customer/notifications',
      badge: 'Manage alerts',
      badgeClass: 'bg-slate-100 text-slate-600',
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-500',
    },
  ];

  // ─── Logged-in state ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile + tablet layout */}
      <div className="lg:hidden">
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
                <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
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
                type="button"
              >
                <FiEdit2 className="text-[#6C63FF]" size={20} />
              </button>
              <button
                onClick={handleSwitchRole}
                className="p-2 lg:p-3 rounded-xl hover:bg-indigo-50 transition-colors"
                title="Switch Role"
                type="button"
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
                    <span className="text-lg lg:text-2xl font-bold text-[#6C63FF]">{value}</span>
                    <span className="text-xs lg:text-sm text-slate-500 mt-1">{label}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* ── Menu Options ───────────────────────────────── */}
          <div className="bg-white mb-6 shadow-sm lg:rounded-2xl lg:shadow-md lg:mb-6 overflow-hidden transition-shadow hover:shadow-lg">
            {menuItems.map(({ icon: MenuIcon, label, path, onPress }, i) => (
              <button
                key={label}
                onClick={() => (onPress ? onPress() : navigate(path))}
                className={`w-full flex items-center p-4 lg:px-8 lg:py-5 hover:bg-slate-50 active:bg-slate-100 transition-colors ${
                  i < menuItems.length - 1 ? 'border-b border-slate-100' : ''
                }`}
                type="button"
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

            <div className="w-full flex items-center p-4 lg:px-8 lg:py-5 border-b border-slate-100">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <FiBellOff className="text-[#6C63FF]" size={20} />
              </div>
              <span className="flex-1 text-left ml-4 text-base lg:text-lg text-slate-800 font-medium">
                Push Notifications
              </span>
              {pushPreferenceUpdating ? (
                <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={() => handlePushPreferenceToggle(!customerPushEnabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    customerPushEnabled ? 'bg-[#6C63FF]' : 'bg-slate-200'
                  }`}
                  aria-pressed={customerPushEnabled}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      customerPushEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            </div>

            <button
              onClick={handleContactSupport}
              className="w-full flex items-center p-4 lg:px-8 lg:py-5 hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100"
              type="button"
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <FiHelpCircle className="text-[#6C63FF]" size={20} />
              </div>
              <span className="flex-1 text-left ml-4 text-base lg:text-lg text-slate-800 font-medium">
                Contact Support
              </span>
              <FiChevronRight className="text-slate-400" size={20} />
            </button>

            <button
              onClick={handleDeactivateAccount}
              className={`w-full flex items-center p-4 lg:px-8 lg:py-5 hover:bg-amber-50 active:bg-amber-100 transition-colors border-b border-slate-100 ${
                accountActionLoading ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              type="button"
              disabled={accountActionLoading}
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <FiSlash className="text-amber-500" size={20} />
              </div>
              <span className="flex-1 text-left ml-4 text-base lg:text-lg text-amber-600 font-semibold">
                Deactivate Account
              </span>
            </button>

            <button
              onClick={handleDeleteAccount}
              className={`w-full flex items-center p-4 lg:px-8 lg:py-5 hover:bg-red-50 active:bg-red-100 transition-colors ${
                accountActionLoading ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              type="button"
              disabled={accountActionLoading}
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <FiTrash2 className="text-red-500" size={20} />
              </div>
              <span className="flex-1 text-left ml-4 text-base lg:text-lg text-red-500 font-semibold">
                Delete Account
              </span>
            </button>
          </div>

          {/* ── Logout Button ──────────────────────────────── */}
          <div className="px-4 lg:px-0 mb-8">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-red-300 text-red-500 font-semibold rounded-xl hover:bg-red-50 hover:border-red-400 active:bg-red-100 transition-all lg:rounded-2xl lg:py-4 lg:text-lg"
              type="button"
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

      {/* Desktop layout */}
      <div className="hidden lg:grid lg:h-[calc(100vh-5rem)] lg:grid-cols-[348px_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="bg-[#F8FAFC] text-slate-700 border-r border-slate-200 flex min-h-0 flex-col">
          <div className="px-6 py-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#6C63FF] to-[#4ECDC4] flex items-center justify-center overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-white">{initials}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
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
              <p className="px-3 text-xs uppercase tracking-widest text-slate-500 mb-2">Account</p>
              <div className="space-y-1">
                {accountNavItems.map(({ icon: Icon, label, path, badge }) => {
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
                      {badge ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#6C63FF] text-white">
                          {badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="px-3 text-xs uppercase tracking-widest text-slate-500 mb-2">Settings</p>
              <div className="space-y-1">
                {settingsNavItems.map(({ icon: Icon, label, path }) => {
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
                })}
              </div>
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

        <main className="bg-[#F8FAFC] flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur">
            <div className="flex h-24 items-center justify-between px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {todayLabel}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">
                  Good to see you, {greetingName}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage your bookings, profile, and preferences in one place.
                </p>
              </div>

              <div className="hidden" aria-hidden="true" />
            </div>
          </header>

          <div className="flex-1 min-h-0 px-8 py-8 space-y-8 overflow-y-auto">
            <div className="grid grid-cols-3 gap-6">
              {loadingStats ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`stat-skeleton-${index}`}
                    className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center justify-center min-h-[150px] shadow-sm"
                  >
                    <div className="w-6 h-6 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                  </div>
                ))
              ) : (
                <>
                  <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-[#6C63FF]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-500">
                          Services Booked
                        </p>
                        <p className="text-4xl font-bold text-slate-950 mt-4">
                          {stats.totalBookings}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">
                          Total bookings on your account
                        </p>
                      </div>
                      <span className="w-12 h-12 rounded-2xl bg-[#6C63FF]/10 text-[#5A52E3] flex items-center justify-center">
                        <FiCalendar size={22} />
                      </span>
                    </div>
                  </div>
                  <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-[#4ECDC4]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-500">
                          Total Spent
                        </p>
                        <p className="text-4xl font-bold text-slate-950 mt-4">
                          ${stats.totalSpent.toFixed(0)}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">Lifetime spend on services</p>
                      </div>
                      <span className="w-12 h-12 rounded-2xl bg-[#4ECDC4]/15 text-[#1E9E94] flex items-center justify-center">
                        <FiGift size={22} />
                      </span>
                    </div>
                  </div>
                  <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-slate-300">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-slate-500">
                          Avg Rating
                        </p>
                        <p className="text-4xl font-bold text-slate-950 mt-4">
                          {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'}
                        </p>
                        <p className="text-sm text-slate-500 mt-2">Average rating you have given</p>
                      </div>
                      <span className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                        <FiCheck size={22} />
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
              <div className="grid grid-cols-2 gap-4">
                {desktopActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => (action.onPress ? action.onPress() : navigate(action.path))}
                      className="group min-h-[190px] rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-[#6C63FF]/30 hover:shadow-lg"
                      type="button"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={`w-12 h-12 rounded-xl ${action.iconBg} flex items-center justify-center`}
                        >
                          <Icon className={action.iconColor} size={22} />
                        </div>
                        <FiChevronRight
                          className="text-slate-400 group-hover:text-slate-600"
                          size={18}
                        />
                      </div>
                      <p className="mt-8 text-base font-semibold text-slate-900">{action.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                      <span
                        className={`mt-4 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${action.badgeClass}`}
                      >
                        {action.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-800">Profile Strength</h2>
                    <span className="text-sm font-semibold text-[#6C63FF]">
                      {profileCompletion}%
                    </span>
                  </div>
                  <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-[#6C63FF] to-[#4ECDC4]"
                      style={{ width: `${profileCompletion}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{profileCompletionMessage}</p>

                  <div className="mt-5 space-y-3">
                    {profileChecklist.map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            item.done
                              ? 'bg-[#4ECDC4]/15 text-[#4ECDC4]'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {item.done ? (
                            <FiCheck size={16} />
                          ) : (
                            <span className="text-xs font-semibold">+</span>
                          )}
                        </div>
                        <span
                          className={`text-sm ${item.done ? 'text-slate-700' : 'text-slate-400'}`}
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-5 border-t border-slate-200 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">Email</p>
                      <p className="text-sm text-slate-700 truncate">
                        {user?.email || 'user@example.com'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400">Phone</p>
                      <p className="text-sm text-slate-700 truncate">
                        {user?.phone || '+1234567890'}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/customer/edit-profile')}
                      className="w-full mt-2 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-[#6C63FF] hover:text-[#6C63FF] transition-colors"
                      type="button"
                    >
                      Edit Details
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-800">Account Controls</h2>
                    <FiBell className="text-slate-400" size={18} />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Push Notifications</p>
                      <p className="text-xs text-slate-500">Manage browser alerts for bookings.</p>
                    </div>
                    {pushPreferenceUpdating ? (
                      <div className="w-5 h-5 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePushPreferenceToggle(!customerPushEnabled)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          customerPushEnabled ? 'bg-[#6C63FF]' : 'bg-slate-200'
                        }`}
                        aria-pressed={customerPushEnabled}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            customerPushEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleContactSupport}
                    className="mt-4 w-full flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-[#6C63FF] hover:text-[#6C63FF] transition-colors"
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <FiHelpCircle size={16} />
                      Contact Support
                    </span>
                    <FiChevronRight size={16} />
                  </button>

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={handleDeactivateAccount}
                      className={`w-full flex items-center justify-between rounded-xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-600 hover:border-amber-300 hover:bg-amber-50 transition-colors ${
                        accountActionLoading ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      type="button"
                      disabled={accountActionLoading}
                    >
                      <span className="flex items-center gap-2">
                        <FiSlash size={16} />
                        Deactivate Account
                      </span>
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      className={`w-full flex items-center justify-between rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors ${
                        accountActionLoading ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                      type="button"
                      disabled={accountActionLoading}
                    >
                      <span className="flex items-center gap-2">
                        <FiTrash2 size={16} />
                        Delete Account
                      </span>
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    Deactivation hides your customer profile. Deleting removes it permanently.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">Recent Activity</h3>
                  <p className="text-sm text-slate-500">Your latest bookings and updates.</p>
                </div>
                <button
                  onClick={() => navigate('/customer/bookings')}
                  className="text-sm font-semibold text-[#6C63FF] hover:text-[#4ECDC4] transition-colors"
                  type="button"
                >
                  View bookings
                </button>
              </div>
              <div className="mt-6 bg-[#F8FAFC] border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">No activity yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Book your first service to see updates here.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/customer/bookings')}
                  className="px-4 py-2 rounded-xl bg-linear-to-r from-[#6C63FF] to-[#4ECDC4] text-white text-sm font-semibold shadow-md hover:shadow-lg transition-shadow"
                  type="button"
                >
                  Browse bookings
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-slate-400 pb-6">
              <p className="text-sm font-semibold text-[#6C63FF]">MyLocalForce</p>
              <p className="mt-1">Version 1.0.0</p>
              <p className="mt-1">Developed by Technowiz IT Solution</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Profile;
