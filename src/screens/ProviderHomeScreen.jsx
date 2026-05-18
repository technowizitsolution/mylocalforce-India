import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiClock,
  FiDollarSign,
  FiStar,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/StateComponents';
import Footer from '../components/Footer';
import ProviderAppLayout from '../components/ProviderAppLayout';
import { fetchProviderDetails } from '../services/firebase/providerOnboardingService';
import { fetchClientData } from '../services/firebase/clientService';
import {
  calculateProviderStats,
  fetchProviderBookings,
  subscribeToProviderDashboard,
  updateBookingStatus,
} from '../services/firebase/serviceService';
import { fetchUserProfile } from '../services/firebase';
import { getProviderFlowPath } from '../utils/providerFlow';
import { notify } from '../utils/toast';

const ACTIVE_STATUSES = ['upcoming', 'accepted', 'arrived', 'in_progress'];
const FINAL_STATUSES = ['completed', 'paid'];
const SUPPORT_EMAIL = 'support@mylocalforce.com.au';

const statusLabels = {
  pending_payment: 'Pending Payment',
  upcoming: 'Upcoming',
  accepted: 'Accepted',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  paid: 'Paid',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMoney = (value) => `$${Math.round(Number(value) || 0).toLocaleString('en-AU')}`;

const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return value || 'TBD';
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatStatus = (status) => statusLabels[status] || status || 'Upcoming';

const getProviderName = (clientData, user) =>
  clientData?.profile?.name ||
  clientData?.profile?.fullName ||
  user?.profile?.name ||
  user?.name ||
  user?.fullName ||
  'Provider';

const buildDashboardRows = (bookings = [], commissionRate = 0) =>
  bookings
    .filter((booking) => ACTIVE_STATUSES.includes(booking.status))
    .sort((a, b) => {
      const aCreated = toDate(a.createdAt)?.getTime() || 0;
      const bCreated = toDate(b.createdAt)?.getTime() || 0;
      return bCreated - aCreated;
    })
    .slice(0, 3)
    .map((booking) => {
      const originalAmount = Number.parseFloat(booking.price) || 0;
      const commission = (originalAmount * commissionRate) / 100;

      return {
        id: booking.id,
        customer: booking.customerName || 'Customer',
        service: booking.serviceName || 'Service',
        date:
          booking.selectedDate ||
          booking.requestedDate ||
          booking.scheduledDate ||
          booking.date ||
          booking.createdAt ||
          null,
        time:
          booking.selectedTime ||
          booking.requestedTime ||
          booking.scheduledTime ||
          booking.time ||
          'TBD',
        rawStatus: booking.status,
        status: formatStatus(booking.status),
        amount: Math.max(0, originalAmount - commission),
        originalAmount,
        commission,
      };
    });

const calculateWeeklyStats = (bookings = [], commissionRate = 0) => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weeklyBookings = bookings.filter((booking) => {
    const bookingDate = toDate(booking.createdAt);
    return bookingDate && bookingDate >= weekAgo && bookingDate <= now;
  });
  const completedThisWeek = weeklyBookings.filter((booking) =>
    FINAL_STATUSES.includes(booking.status)
  );

  return {
    newBookings: weeklyBookings.length,
    completionRate:
      weeklyBookings.length > 0
        ? Math.round((completedThisWeek.length / weeklyBookings.length) * 100)
        : 0,
    weeklyEarnings: Math.round(
      completedThisWeek.reduce((sum, booking) => {
        const amount = Number.parseFloat(booking.price) || 0;
        return sum + Math.max(0, amount - (amount * commissionRate) / 100);
      }, 0)
    ),
  };
};

const ProviderHomeScreen = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [flowPath, setFlowPath] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [stats, setStats] = useState({
    totalServices: 0,
    activeBookings: 0,
    monthlyEarnings: 0,
    rating: 0,
    ratingCount: 0,
  });
  const [weeklyStats, setWeeklyStats] = useState({
    newBookings: 0,
    completionRate: 0,
    weeklyEarnings: 0,
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      return undefined;
    }

    let cancelled = false;

    const resolveFlowPath = async () => {
      const topLevelSignalsPresent =
        user.onboardingCompleted === true ||
        user.onboardingDocuments === true ||
        user.providerOnboarding === true ||
        user.provider_onboarding === true;

      const providerDetails = topLevelSignalsPresent
        ? null
        : await fetchProviderDetails(user.uid).catch(() => null);

      if (!cancelled) {
        setFlowPath(
          getProviderFlowPath({
            profile: user,
            providerDetails,
          })
        );
      }
    };

    resolveFlowPath();

    return () => {
      cancelled = true;
    };
  }, [
    user?.uid,
    user?.approvalStatus,
    user?.onboardingCompleted,
    user?.onboardingDocuments,
    user?.providerOnboarding,
    user?.provider_onboarding,
  ]);

  const loadDashboardOnce = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const [providerStats, bookingsData, profileData] = await Promise.all([
        calculateProviderStats(user.uid),
        fetchProviderBookings(user.uid),
        fetchClientData(user.uid).catch(() => ({ profile: { name: 'Provider' } })),
      ]);

      const commissionRate = providerStats.commissionRate || 0;
      setStats({
        totalServices: providerStats.totalServices || 0,
        activeBookings: providerStats.upcomingBookings || 0,
        monthlyEarnings: providerStats.monthlyEarnings || 0,
        rating: providerStats.averageRating || 0,
        ratingCount: providerStats.ratingCount || 0,
      });
      setRecentBookings(buildDashboardRows(bookingsData, commissionRate));
      setWeeklyStats(calculateWeeklyStats(bookingsData, commissionRate));
      setClientData(profileData);
    } catch (error) {
      console.error('Error loading provider dashboard:', error);
      notify.error('Failed to load provider dashboard');
      setRecentBookings([]);
    } finally {
      setDashboardLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (flowPath !== '/provider/home' || !user?.uid) return undefined;

    let unsubscribe = null;
    let mounted = true;

    const setupRealtime = async () => {
      try {
        unsubscribe = await subscribeToProviderDashboard(user.uid, (dashboardStats) => {
          if (!mounted) return;

          setStats({
            totalServices: dashboardStats.totalServices || 0,
            activeBookings: dashboardStats.activeBookings || 0,
            monthlyEarnings: dashboardStats.monthlyEarnings || 0,
            rating: dashboardStats.averageRating || 0,
            ratingCount: dashboardStats.ratingCount || 0,
          });
          setRecentBookings(dashboardStats.recentBookings || []);
          if (dashboardStats.weeklyStats) {
            setWeeklyStats(dashboardStats.weeklyStats);
          }
          setDashboardLoading(false);
          setRefreshing(false);
        });

        const [profileData, profile] = await Promise.all([
          fetchClientData(user.uid).catch(() => ({ profile: { name: 'Provider' } })),
          fetchUserProfile(user.uid).catch(() => null),
        ]);

        if (mounted) {
          const nationalityStatus =
            profile?.nationalityStatus || profile?.profile?.nationalityStatus || null;
          const visaExpiry = profile?.visaExpiryTimestamp || profile?.profile?.visaExpiry || null;
          const visaDate = toDate(visaExpiry);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const visaExpired =
            visaDate && visaDate < today && nationalityStatus !== 'australian_citizen';

          setClientData({
            ...profileData,
            visaAlert: visaExpired ? { visaExpiry: visaDate } : undefined,
            accountDeactivated:
              profile?.accountActive === false ||
              profile?.inactive === true ||
              profile?.accountStatus === 'deactivated',
          });
        }
      } catch (error) {
        console.error('Error setting up provider dashboard listener:', error);
        await loadDashboardOnce();
      }
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [flowPath, loadDashboardOnce, user?.uid]);

  useEffect(() => {
    if (clientData?.accountDeactivated) {
      notify.error(
        `Your provider account has been deactivated. Contact ${SUPPORT_EMAIL} for assistance.`,
        { duration: 15000 }
      );
    }
  }, [clientData?.accountDeactivated]);

  const providerName = useMemo(() => getProviderName(clientData, user), [clientData, user]);

  const handleStatusUpdate = async (bookingId, newStatus, label) => {
    if (!window.confirm(`Are you sure you want to ${label.toLowerCase()} this booking?`)) {
      return;
    }

    try {
      setActionLoading(`${bookingId}:${newStatus}`);
      await updateBookingStatus(bookingId, newStatus, user.uid);
      notify.success(`Booking ${label.toLowerCase()}ed successfully`);
      await loadDashboardOnce();
    } catch (error) {
      console.error('Error updating booking status:', error);
      notify.error(error?.message || `Failed to ${label.toLowerCase()} booking`);
    } finally {
      setActionLoading(null);
    }
  };

  const sendServiceStartOtp = async (bookingId) => {
    try {
      setActionLoading(`${bookingId}:arrived`);
      const response = await fetch(
        'https://us-central1-mylocalforce-295b8.cloudfunctions.net/sendServiceStartOtp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, providerId: user.uid }),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Failed to send verification code');

      notify.success('Verification code sent to the customer.');
      await loadDashboardOnce();
    } catch (error) {
      console.error('Error sending service start OTP:', error);
      notify.error(error?.message || 'Failed to send verification code');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading || !flowPath) {
    return <Loading fullScreen />;
  }

  if (flowPath !== '/provider/home') {
    return <Navigate to={flowPath} replace />;
  }

  if (dashboardLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#5A52E3]/20 border-t-[#5A52E3]" />
          <p className="text-sm font-semibold text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <ProviderAppLayout>
      <header className="border-b border-slate-200 bg-[#F8FAFC] pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
            {providerName}
            {refreshing ? (
              <span className="text-base font-semibold text-slate-400"> Refreshing...</span>
            ) : null}
          </h1>
        </div>
      </header>

      {clientData?.visaAlert ? (
        <button
          type="button"
          onClick={() => navigate('/provider/onboarding')}
          className="mt-5 w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-amber-900"
        >
          <p className="font-medium">Important: VISA status requires your attention</p>
          <p className="mt-1 text-sm">
            Tap to update your VISA details and submit for admin approval.
          </p>
        </button>
      ) : null}

      <section className="mt-7">
        <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard value={stats.totalServices} label="Services" Icon={FiBriefcase} />
          <StatCard value={stats.activeBookings} label="Active Bookings" Icon={FiCalendar} />
          <StatCard
            value={formatMoney(stats.monthlyEarnings)}
            label="This Month"
            Icon={FiDollarSign}
          />
          <StatCard
            value={stats.rating > 0 ? stats.rating.toFixed(1) : '-'}
            label={stats.ratingCount > 0 ? `Rating (${stats.ratingCount})` : 'No Ratings Yet'}
            Icon={FiStar}
            star
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Bookings</h2>
          <button
            type="button"
            onClick={() => notify.info('Provider bookings page is not available on web yet.')}
            className="text-sm font-medium text-[#5A52E3] hover:text-[#4b44c8]"
          >
            See All
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {recentBookings.length > 0 ? (
            recentBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                actionLoading={actionLoading}
                onStatusUpdate={handleStatusUpdate}
                onArrived={sendServiceStartOtp}
              />
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="font-medium text-slate-800">No active bookings yet</p>
              <p className="mt-1 text-sm text-slate-500">
                New customer bookings will appear here when they are assigned to you.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">This Week</h2>
        <div className="mt-3 grid grid-cols-1 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <PerformanceItem value={weeklyStats.newBookings} label="New Bookings" />
          <PerformanceItem value={`${weeklyStats.completionRate}%`} label="Completion Rate" />
          <PerformanceItem
            value={formatMoney(weeklyStats.weeklyEarnings)}
            label="Weekly Earnings"
          />
        </div>
      </section>
      <Footer />
    </ProviderAppLayout>
  );
};

const StatCard = ({ value, label, Icon, star = false }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-2xl font-semibold text-[#5A52E3] sm:text-3xl">
        {star ? (
          <span className="inline-flex items-center gap-1">
            <FiStar className="h-5 w-5 fill-amber-400 text-amber-400" />
            {value}
          </span>
        ) : (
          value
        )}
      </p>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
        <Icon className="h-5 w-5 text-[#5A52E3]" />
      </div>
    </div>
    <p className="mt-2 text-sm font-semibold text-slate-500">{label}</p>
  </div>
);

const BookingCard = ({ booking, actionLoading, onStatusUpdate, onArrived }) => {
  const statusKey = booking.rawStatus || booking.status?.toLowerCase();
  const isCompleted = statusKey === 'completed' || statusKey === 'paid';
  const isBusy = (status) => actionLoading === `${booking.id}:${status}`;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{booking.customer}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{booking.service}</p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <p className="text-lg font-semibold text-[#5A52E3]">{formatMoney(booking.amount)}</p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {booking.status}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <FiCalendar className="h-4 w-4" />
          {formatDate(booking.date)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FiClock className="h-4 w-4" />
          {booking.time}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {statusKey === 'upcoming' ? (
          <>
            <ActionButton
              label={isBusy('accepted') ? 'Accepting...' : 'Accept'}
              Icon={FiCheck}
              onClick={() => onStatusUpdate(booking.id, 'accepted', 'Accept')}
              disabled={isBusy('accepted')}
            />
            <ActionButton
              label={isBusy('rejected') ? 'Rejecting...' : 'Reject'}
              Icon={FiX}
              variant="danger"
              onClick={() => onStatusUpdate(booking.id, 'rejected', 'Reject')}
              disabled={isBusy('rejected')}
            />
          </>
        ) : null}

        {statusKey === 'accepted' ? (
          <>
            <ActionButton
              label={isBusy('arrived') ? 'Sending...' : 'Arrived'}
              Icon={FiCheck}
              onClick={() => onArrived(booking.id)}
              disabled={isBusy('arrived')}
            />
            <ActionButton
              label={isBusy('cancelled') ? 'Cancelling...' : 'Cancel'}
              Icon={FiX}
              variant="danger"
              onClick={() => onStatusUpdate(booking.id, 'cancelled', 'Cancel')}
              disabled={isBusy('cancelled')}
            />
          </>
        ) : null}

        {statusKey === 'arrived' ? (
          <ActionButton
            label="Enter Code in App"
            Icon={FiBell}
            onClick={() =>
              notify.info('Service start code entry is currently available in the mobile app.')
            }
          />
        ) : null}

        {statusKey === 'in_progress' ? (
          <>
            <ActionButton
              label={isBusy('completed') ? 'Completing...' : 'Complete'}
              Icon={FiCheck}
              onClick={() => onStatusUpdate(booking.id, 'completed', 'Complete')}
              disabled={isBusy('completed')}
            />
            <ActionButton
              label={isBusy('cancelled') ? 'Cancelling...' : 'Cancel'}
              Icon={FiX}
              variant="danger"
              onClick={() => onStatusUpdate(booking.id, 'cancelled', 'Cancel')}
              disabled={isBusy('cancelled')}
            />
          </>
        ) : null}
      </div>
    </article>
  );
};

const ActionButton = ({ label, Icon, onClick, disabled = false, variant = 'primary' }) => {
  const styles =
    variant === 'danger'
      ? 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-300'
      : 'bg-[#5A52E3] text-white hover:bg-[#4b44c8] disabled:bg-indigo-300';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${styles}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
};

const PerformanceItem = ({ value, label }) => (
  <div className="p-5 text-center">
    <p className="text-2xl font-semibold text-[#5A52E3]">{value}</p>
    <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
  </div>
);

export default ProviderHomeScreen;
