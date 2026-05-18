import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiBellOff,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiEdit,
  FiFileText,
  FiHelpCircle,
  FiLogOut,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShield,
  FiSlash,
  FiStar,
  FiTool,
  FiTrash2,
  FiUser,
} from 'react-icons/fi';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import {
  deactivateCurrentUserAccount,
  deleteCurrentUserAccount,
  fetchProviderDetails,
  fetchUserProfile,
  isAppPushPermissionEnabled,
  requestNotificationPermission,
  subscribeToBusinessProfile,
  updatePushNotificationPreference,
} from '../services/firebase';
import { notify } from '../utils/toast';

const isToggleExplicitlyDisabled = (value) => {
  if (value === false) return true;
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['false', '0', 'no', 'off', 'disabled'].includes(normalized);
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return 'Not specified';
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMoney = (value) => `$${Math.round(Number(value) || 0).toLocaleString('en-AU')}`;

const formatNationalityStatus = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'australian_citizen') return 'Australian Citizen';
  if (normalized === 'permanent_resident') return 'Permanent Resident';
  if (normalized === 'visa_holder') return 'VISA Holder';
  return value || 'Not specified';
};

const isProviderOnboardingComplete = (details) => {
  if (!details) return false;
  const hasDocs = Boolean(
    details.documents?.passportUrl ||
    details.documents?.drivingLicenceUrl ||
    details.documents?.resumeUrl ||
    details.documents?.certificatesUrl
  );
  const banking = details.bankingDetails;
  const hasBanking = Boolean(
    banking?.accountName && banking?.accountNumber && banking?.bsb && banking?.bankName
  );
  const business = details.businessInformation;
  const hasBusiness = Boolean(business?.abnNumber);
  const hasServices =
    Array.isArray(details.profile?.servicesOffered) && details.profile.servicesOffered.length > 0;

  return hasDocs && hasBanking && hasBusiness && hasServices;
};

const ProviderProfileScreen = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUserData } = useAuth();
  const [profile, setProfile] = useState(null);
  const [providerDetails, setProviderDetails] = useState(null);
  const [businessStats, setBusinessStats] = useState({
    jobsCompleted: 0,
    averageRating: 0,
    monthlyEarnings: 0,
    totalEarnings: 0,
    totalBookings: 0,
    pendingBookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [providerPushEnabled, setProviderPushEnabled] = useState(true);
  const [pushPreferenceUpdating, setPushPreferenceUpdating] = useState(false);
  const [accountActionLoading, setAccountActionLoading] = useState(false);

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

    setProviderPushEnabled(!disabled);
  }, [
    user?.pushNotificationsEnabled,
    user?.notificationSettings,
    user?.notificationSettings?.pushEnabled,
    user?.notificationSettings?.customerPushEnabled,
    user?.notificationSettings?.providerPushEnabled,
  ]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    let unsubscribe = null;
    let mounted = true;

    const setup = async () => {
      try {
        const [profileData, details] = await Promise.all([
          fetchUserProfile(user.uid).catch(() => user),
          fetchProviderDetails(user.uid).catch(() => null),
        ]);

        if (mounted) {
          setProfile(profileData || user);
          setProviderDetails(details);
          setLoading(false);
        }

        unsubscribe = subscribeToBusinessProfile(
          user.uid,
          ({ userProfile, businessStats: stats }) => {
            if (!mounted) return;
            if (userProfile) setProfile((current) => ({ ...(current || {}), ...userProfile }));
            if (stats) setBusinessStats(stats);
          }
        );
      } catch (error) {
        console.error('Error loading provider profile:', error);
        notify.error('Failed to load profile');
        if (mounted) {
          setProfile(user);
          setLoading(false);
        }
      }
    };

    setup();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const isOnboardingSubmitted =
    Boolean(user?.onboardingDocuments) || isProviderOnboardingComplete(providerDetails);

  const name = profile?.name || profile?.fullName || user?.email?.split('@')[0] || 'Provider';
  const rating = Number(businessStats.averageRating || profile?.avgRating || profile?.rating || 0);
  const aboutText = useMemo(
    () =>
      profile?.about ||
      profile?.bio ||
      providerDetails?.profile?.about ||
      'Tell customers about your experience, services, and what makes your work reliable.',
    [profile, providerDetails]
  );
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const profileChecklist = [
    { label: 'Profile photo uploaded', done: Boolean(profile?.photoURL || profile?.avatar) },
    { label: 'Business details submitted', done: Boolean(providerDetails?.businessInformation) },
    { label: 'Documents uploaded', done: isProviderOnboardingComplete(providerDetails) },
    { label: 'Services added', done: Boolean(providerDetails?.profile?.servicesOffered?.length) },
  ];
  const profileCompletion = Math.round(
    (profileChecklist.filter((item) => item.done).length / profileChecklist.length) * 100
  );
  const desktopActions = [
    {
      icon: FiEdit,
      label: 'Edit Profile',
      description: 'Update your public provider profile and photo.',
      path: '/provider/edit-profile',
      badge: `${profileCompletion}% complete`,
      badgeClass: 'bg-[#4ECDC4]/10 text-[#1E9E94]',
      iconBg: 'bg-[#4ECDC4]/10',
      iconColor: 'text-[#1E9E94]',
    },
    {
      icon: FiFileText,
      label: 'My Details & Docs',
      description: 'Review submitted identity, visa, and business files.',
      path: '/provider/documents',
      badge: isOnboardingSubmitted ? 'Submitted' : 'Not submitted',
      badgeClass: isOnboardingSubmitted ? 'bg-[#6C63FF]/10 text-[#5A52E3]' : 'bg-rose-50 text-rose-600',
      iconBg: 'bg-[#6C63FF]/10',
      iconColor: 'text-[#5A52E3]',
    },
    {
      icon: FiCalendar,
      label: 'My Jobs',
      description: 'Track new, active, and completed service bookings.',
      path: '/provider/bookings',
      badge: `${businessStats.totalBookings || 0} total`,
      badgeClass: 'bg-slate-100 text-slate-600',
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-500',
    },
    {
      icon: FiDollarSign,
      label: 'Earnings',
      description: 'View monthly income and payout activity.',
      path: '/provider/earnings',
      badge: formatMoney(businessStats.totalEarnings),
      badgeClass: 'bg-emerald-50 text-emerald-700',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
  ];

  const handlePushPreferenceToggle = async (nextValue) => {
    if (!user?.uid || pushPreferenceUpdating) return;

    const actionText = nextValue ? 'enable' : 'disable';
    const confirmed = window.confirm(`Do you want to ${actionText} push notifications?`);
    if (!confirmed) return;

    if (nextValue) {
      const permissionGranted = await requestNotificationPermission();
      const systemPushEnabled = await isAppPushPermissionEnabled();
      if (!permissionGranted || !systemPushEnabled) {
        notify.warning('Push notifications are off in your browser settings.');
        return;
      }
    }

    const previousValue = providerPushEnabled;
    setProviderPushEnabled(nextValue);
    setPushPreferenceUpdating(true);

    try {
      await updatePushNotificationPreference(user.uid, 'provider', nextValue);
      await refreshUserData?.();
      notify.success(`Push notifications ${nextValue ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setProviderPushEnabled(previousValue);
      notify.error('Could not update push notifications.');
    } finally {
      setPushPreferenceUpdating(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (!window.confirm('This will deactivate your provider profile. Continue?')) return;

    try {
      setAccountActionLoading(true);
      await deactivateCurrentUserAccount('client');
      await logout();
      notify.success('Your provider profile has been deactivated.');
    } catch (error) {
      notify.error(error?.message || 'Unable to deactivate provider account.');
    } finally {
      setAccountActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('This will permanently delete your provider role or account. Continue?'))
      return;

    try {
      setAccountActionLoading(true);
      const result = await deleteCurrentUserAccount('client');
      notify.success('Provider account deletion completed.');
      if (result?.mode === 'role-removed') {
        navigate('/role-selection');
      } else {
        await logout();
        navigate('/login', { replace: true });
      }
    } catch (error) {
      notify.error(error?.message || 'Unable to delete provider account.');
    } finally {
      setAccountActionLoading(false);
    }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <ProviderAppLayout>
      <div className="lg:hidden">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-indigo-50">
              {profile?.photoURL || profile?.avatar ? (
                <img
                  src={profile.photoURL || profile.avatar}
                  alt={name}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <FiBriefcase className="h-9 w-9 text-[#5A52E3]" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-slate-900">{name}</h1>
              <p className="mt-1 truncate text-sm text-slate-500">
                {profile?.email || user?.email || 'user@example.com'}
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                <FiStar className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {rating > 0 ? rating.toFixed(1) : 'No ratings yet'}
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Business Information</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <InfoRow Icon={FiClock} label="Experience" value={`${profile?.experience || 0} years`} />
          <InfoRow
            Icon={FiMail}
            label="Email"
            value={profile?.email || user?.email || 'Not specified'}
          />
          <InfoRow
            Icon={FiPhone}
            label="Phone"
            value={profile?.phone || profile?.phoneNumber || user?.phoneNumber || 'Not specified'}
          />
          <InfoRow
            Icon={FiMapPin}
            label="Location"
            value={profile?.address || profile?.profile?.address || 'Not specified'}
          />
          <InfoRow Icon={FiUser} label="Gender" value={profile?.gender || 'Not specified'} />
          <InfoRow
            Icon={FiShield}
            label="Nationality Status"
            value={formatNationalityStatus(
              profile?.nationalityStatus || profile?.profile?.nationalityStatus
            )}
          />
          <InfoRow
            Icon={FiCalendar}
            label="Date of Birth"
            value={formatDate(profile?.dob || profile?.profile?.dob)}
          />
          <InfoRow
            Icon={FiClock}
            label="Joined"
            value={formatDate(profile?.createdAt || user?.createdAt)}
            last
          />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <FiBell className="h-5 w-5 text-[#5A52E3]" />
          <h2 className="text-base font-semibold text-slate-900">About Us</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">{aboutText}</p>
      </section>

      <section className="mt-4 grid grid-cols-1 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat value={businessStats.jobsCompleted || 0} label="Jobs Completed" />
        <Stat value={rating > 0 ? rating.toFixed(1) : '-'} label="Rating" />
        <Stat value={formatMoney(businessStats.monthlyEarnings)} label="Monthly Earnings" />
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <MenuItem
          Icon={FiEdit}
          label="Edit Profile"
          onClick={() => navigate('/provider/edit-profile')}
        />
        <MenuItem
          Icon={FiFileText}
          label="My Details & Docs"
          tag={!isOnboardingSubmitted ? 'Not submitted' : null}
          tagTone="danger"
          onClick={() => navigate('/provider/documents')}
        />
        <MenuItem
          Icon={FiCalendar}
          label="My Jobs"
          onClick={() => navigate('/provider/bookings')}
        />
        <MenuItem
          Icon={FiDollarSign}
          label="Earnings"
          onClick={() => navigate('/provider/earnings')}
        />
        <MenuItem
          Icon={FiTool}
          label="My Services"
          onClick={() => navigate('/provider/services')}
        />
        <MenuItem
          Icon={FiBell}
          label="Notifications"
          onClick={() => navigate('/provider/notifications')}
        />
        <div className="flex min-h-14 items-center gap-3 border-b border-slate-100 px-4 py-3">
          <FiBellOff className="h-5 w-5 text-[#5A52E3]" />
          <span className="flex-1 font-medium text-slate-800">Push Notifications</span>
          {pushPreferenceUpdating ? (
            <div className="h-5 w-5 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
          ) : (
            <button
              type="button"
              onClick={() => handlePushPreferenceToggle(!providerPushEnabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                providerPushEnabled ? 'bg-[#6C63FF]' : 'bg-slate-200'
              }`}
              aria-pressed={providerPushEnabled}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  providerPushEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          )}
        </div>
        <MenuItem
          Icon={FiHelpCircle}
          label="Contact Support"
          onClick={() => navigate('/provider/contact-support')}
        />
        <MenuItem
          Icon={FiSlash}
          label="Deactivate Account"
          danger="warning"
          disabled={accountActionLoading}
          onClick={handleDeactivateAccount}
        />
        <MenuItem
          Icon={FiTrash2}
          label="Delete Account"
          danger
          disabled={accountActionLoading}
          onClick={handleDeleteAccount}
        />
      </section>

      <button
        type="button"
        onClick={logout}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white text-sm font-semibold text-rose-600 shadow-sm hover:bg-rose-50"
      >
        <FiLogOut className="h-5 w-5" />
        Logout
      </button>

      <div className="mt-6 text-center">
        <p className="font-semibold text-slate-700">MyLocalForce</p>
        <p className="mt-1 text-xs text-slate-400">Version 3.0.4</p>
      </div>

      <Footer />
      </div>

      <div className="hidden lg:block">
        <div className="grid grid-cols-3 gap-6">
          <DesktopStat
            Icon={FiBriefcase}
            label="Jobs Completed"
            value={businessStats.jobsCompleted || 0}
            accent="border-l-[#6C63FF]"
          />
          <DesktopStat
            Icon={FiStar}
            label="Average Rating"
            value={rating > 0 ? rating.toFixed(1) : 'N/A'}
            accent="border-l-[#4ECDC4]"
          />
          <DesktopStat
            Icon={FiDollarSign}
            label="Monthly Earnings"
            value={formatMoney(businessStats.monthlyEarnings)}
            accent="border-l-emerald-300"
          />
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-[#6C63FF] to-[#4ECDC4] text-white">
                    {profile?.photoURL || profile?.avatar ? (
                      <img
                        src={profile.photoURL || profile.avatar}
                        alt={name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-semibold">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Provider profile
                    </p>
                    <h1 className="mt-1 truncate text-3xl font-semibold text-slate-950">
                      {name}
                    </h1>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {profile?.email || user?.email || 'user@example.com'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/provider/edit-profile')}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#6C63FF] hover:text-[#5A52E3]"
                >
                  <FiEdit className="h-4 w-4" />
                  Edit profile
                </button>
              </div>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-500">{aboutText}</p>
            </section>

            <section className="grid grid-cols-2 gap-4">
              {desktopActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => navigate(action.path)}
                    className="group min-h-[178px] rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#6C63FF]/30 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.iconBg}`}
                      >
                        <Icon className={action.iconColor} size={22} />
                      </span>
                      <FiChevronRight className="text-slate-400 group-hover:text-slate-600" />
                    </div>
                    <p className="mt-7 text-base font-semibold text-slate-900">{action.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                    <span
                      className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${action.badgeClass}`}
                    >
                      {action.badge}
                    </span>
                  </button>
                );
              })}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-800">Business Information</h2>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <DesktopInfo label="Experience" value={`${profile?.experience || 0} years`} />
                <DesktopInfo label="Phone" value={profile?.phone || profile?.phoneNumber || user?.phoneNumber || 'Not specified'} />
                <DesktopInfo label="Location" value={profile?.address || profile?.profile?.address || 'Not specified'} wide />
                <DesktopInfo label="Nationality" value={formatNationalityStatus(profile?.nationalityStatus || profile?.profile?.nationalityStatus)} />
                <DesktopInfo label="Joined" value={formatDate(profile?.createdAt || user?.createdAt)} />
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">Profile Strength</h2>
                <span className="text-sm font-semibold text-[#5A52E3]">{profileCompletion}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-linear-to-r from-[#6C63FF] to-[#4ECDC4]"
                  style={{ width: `${profileCompletion}%` }}
                />
              </div>
              <div className="mt-5 space-y-3">
                {profileChecklist.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        item.done ? 'bg-[#4ECDC4]/15 text-[#1E9E94]' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {item.done ? <FiCheck size={16} /> : <span className="text-xs">+</span>}
                    </span>
                    <span className={`text-sm ${item.done ? 'text-slate-700' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate('/provider/documents')}
                className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-[#6C63FF] hover:text-[#5A52E3]"
              >
                Review details
              </button>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">Account Controls</h2>
                <FiBell className="text-slate-400" size={18} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Push Notifications</p>
                  <p className="text-xs text-slate-500">Browser alerts for jobs and updates.</p>
                </div>
                {pushPreferenceUpdating ? (
                  <div className="h-5 w-5 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePushPreferenceToggle(!providerPushEnabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      providerPushEnabled ? 'bg-[#6C63FF]' : 'bg-slate-200'
                    }`}
                    aria-pressed={providerPushEnabled}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        providerPushEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate('/provider/contact-support')}
                className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-[#6C63FF] hover:text-[#5A52E3]"
              >
                <span className="flex items-center gap-2">
                  <FiHelpCircle size={16} />
                  Contact Support
                </span>
                <FiChevronRight size={16} />
              </button>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleDeactivateAccount}
                  disabled={accountActionLoading}
                  className="w-full rounded-xl border border-amber-200 px-4 py-3 text-left text-sm font-semibold text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-60"
                >
                  Deactivate Account
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={accountActionLoading}
                  className="w-full rounded-xl border border-rose-200 px-4 py-3 text-left text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                >
                  Delete Account
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </ProviderAppLayout>
  );
};

const InfoRow = ({ Icon, label, value, last = false }) => (
  <div
    className={`grid gap-3 px-4 py-3 sm:grid-cols-[220px_1fr] ${last ? '' : 'border-b border-slate-100'}`}
  >
    <div className="flex items-center gap-2 font-medium text-slate-500">
      <Icon className="h-5 w-5" />
      {label}
    </div>
    <p className="font-medium text-slate-900">{value}</p>
  </div>
);

const Stat = ({ value, label }) => (
  <div className="p-5 text-center">
    <p className="text-2xl font-semibold text-[#5A52E3]">{value}</p>
    <p className="mt-1 text-sm text-slate-500">{label}</p>
  </div>
);

const DesktopStat = ({ Icon, label, value, accent }) => (
  <div className={`rounded-2xl border border-slate-200 border-l-4 ${accent} bg-white p-6 shadow-sm`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-4 text-4xl font-semibold text-slate-950">{value}</p>
        <p className="mt-2 text-sm text-slate-500">Updated from your provider activity</p>
      </div>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6C63FF]/10 text-[#5A52E3]">
        <Icon size={22} />
      </span>
    </div>
  </div>
);

const DesktopInfo = ({ label, value, wide = false }) => (
  <div className={`rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 ${wide ? 'col-span-2' : ''}`}>
    <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
    <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
  </div>
);

const MenuItem = ({ Icon, label, tag, tagTone, danger, disabled, onClick }) => {
  const textClass =
    danger === true ? 'text-rose-600' : danger === 'warning' ? 'text-amber-600' : 'text-slate-800';
  const iconClass =
    danger === true ? 'text-rose-500' : danger === 'warning' ? 'text-amber-500' : 'text-[#5A52E3]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-14 w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 disabled:opacity-60"
    >
      <Icon className={`h-5 w-5 ${iconClass}`} />
      <span className={`flex-1 font-semibold ${textClass}`}>{label}</span>
      {tag ? (
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            tagTone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
          }`}
        >
          {tag}
        </span>
      ) : null}
      {!danger ? <span className="text-slate-300">{'>'}</span> : null}
    </button>
  );
};

export default ProviderProfileScreen;
