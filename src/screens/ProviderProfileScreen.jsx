import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiBellOff,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiDollarSign,
  FiEdit,
  FiFileText,
  FiHelpCircle,
  FiLogOut,
  FiMail,
  FiMapPin,
  FiPhone,
  FiRefreshCw,
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
  fetchUserRoles,
  isAppPushPermissionEnabled,
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

  const handleSwitchRole = async () => {
    try {
      const { roles } = await fetchUserRoles(user.uid);
      const availableRoles = Object.keys(roles || {}).filter((role) => roles[role]);
      if (availableRoles.length > 1) {
        navigate('/role-selection');
      } else {
        notify.info('You only have one role available.');
      }
    } catch (error) {
      notify.error('Failed to check available roles');
    }
  };

  const handlePushPreferenceToggle = async (nextValue) => {
    if (!user?.uid || pushPreferenceUpdating) return;

    if (nextValue) {
      const systemPushEnabled = await isAppPushPermissionEnabled();
      if (!systemPushEnabled) {
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
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
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
              <h1 className="truncate text-2xl font-black text-slate-950">{name}</h1>
              <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                {profile?.email || user?.email || 'user@example.com'}
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                <FiStar className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {rating > 0 ? rating.toFixed(1) : 'No ratings yet'}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <IconButton
              label="Edit profile"
              Icon={FiEdit}
              onClick={() => navigate('/provider/edit-profile')}
            />
            <IconButton
              label="Switch role"
              Icon={FiRefreshCw}
              onClick={handleSwitchRole}
              className="lg:hidden"
            />
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Business Information</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
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

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <FiBell className="h-5 w-5 text-[#5A52E3]" />
          <h2 className="text-lg font-black text-slate-950">About Us</h2>
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{aboutText}</p>
      </section>

      <section className="mt-6 grid grid-cols-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat value={businessStats.jobsCompleted || 0} label="Jobs Completed" />
        <Stat value={rating > 0 ? rating.toFixed(1) : '-'} label="Rating" />
        <Stat value={formatMoney(businessStats.monthlyEarnings)} label="Monthly Earnings" />
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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
          <span className="flex-1 font-bold text-slate-800">Push Notifications</span>
          <button
            type="button"
            onClick={() => handlePushPreferenceToggle(!providerPushEnabled)}
            disabled={pushPreferenceUpdating}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              providerPushEnabled ? 'bg-[#6C63FF]' : 'bg-slate-200'
            } disabled:opacity-60`}
            aria-pressed={providerPushEnabled}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                providerPushEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
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
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white text-sm font-black text-rose-600 shadow-sm hover:bg-rose-50"
      >
        <FiLogOut className="h-5 w-5" />
        Logout
      </button>

      <div className="mt-6 text-center">
        <p className="font-black text-slate-700">MyLocalForce</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">Version 3.0.4</p>
      </div>

      <Footer />
    </ProviderAppLayout>
  );
};

const IconButton = ({ label, Icon, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#5A52E3] shadow-sm transition-colors hover:bg-indigo-50 ${className}`}
    aria-label={label}
  >
    <Icon className="h-5 w-5" />
  </button>
);

const InfoRow = ({ Icon, label, value, last = false }) => (
  <div
    className={`grid gap-3 px-4 py-3 sm:grid-cols-[220px_1fr] ${last ? '' : 'border-b border-slate-100'}`}
  >
    <div className="flex items-center gap-2 font-bold text-slate-500">
      <Icon className="h-5 w-5" />
      {label}
    </div>
    <p className="font-bold text-slate-900">{value}</p>
  </div>
);

const Stat = ({ value, label }) => (
  <div className="p-5 text-center">
    <p className="text-2xl font-black text-[#5A52E3]">{value}</p>
    <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
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
      <span className={`flex-1 font-bold ${textClass}`}>{label}</span>
      {tag ? (
        <span
          className={`rounded-full px-2 py-1 text-xs font-bold ${
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
