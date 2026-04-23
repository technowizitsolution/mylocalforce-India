import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  FiBriefcase,
  FiCalendar,
  FiDollarSign,
  FiEdit3,
  FiRefreshCw,
  FiStar,
  FiUser,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/StateComponents';
import { subscribeToProviderDashboard } from '../services/firebase';
import { fetchProviderDetails } from '../services/firebase/providerOnboardingService';
import { getProviderFlowPath } from '../utils/providerFlow';

const defaultStats = {
  totalServices: 0,
  activeBookings: 0,
  monthlyEarnings: 0,
  averageRating: 0,
  recentBookings: [],
};

const StatCard = ({ icon: Icon, label, value, helper }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
      <Icon className="h-5 w-5" />
    </div>
    <p className="text-sm font-semibold text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-gray-950">{value}</p>
    {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
  </div>
);

const ProviderHomeScreen = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [flowPath, setFlowPath] = useState(null);
  const [stats, setStats] = useState(defaultStats);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    if (!user?.uid || flowPath !== '/provider/home') {
      return undefined;
    }

    let unsubscribe;
    let cancelled = false;

    const startSubscription = async () => {
      setIsStatsLoading(true);
      setStatsError('');

      try {
        unsubscribe = await subscribeToProviderDashboard(user.uid, (nextStats) => {
          if (!cancelled) {
            setStats({ ...defaultStats, ...nextStats });
            setIsStatsLoading(false);
          }
        });
      } catch (error) {
        if (!cancelled) {
          setStatsError('Unable to load provider dashboard right now.');
          setIsStatsLoading(false);
        }
      }
    };

    startSubscription();

    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [user?.uid, flowPath]);

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
          }),
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

  if (isLoading || !flowPath) {
    return <Loading fullScreen />;
  }

  if (flowPath !== '/provider/home') {
    return <Navigate to={flowPath} replace />;
  }

  const displayName =
    user?.firstName ||
    user?.displayName ||
    user?.name ||
    user?.email?.split('@')[0] ||
    'Provider';

  const recentBookings = stats.recentBookings || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-2xl bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
                Provider Home
              </p>
              <h1 className="mt-3 text-3xl font-bold text-gray-950 sm:text-4xl">
                Welcome back, {displayName}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
                Your provider account is approved. Manage your profile, monitor
                bookings, and keep your services ready for customers.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/provider/onboarding')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                <FiEdit3 className="h-4 w-4" />
                Review Profile
              </button>
              <button
                type="button"
                onClick={() => navigate('/customer')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)] transition hover:bg-blue-700"
              >
                <FiUser className="h-4 w-4" />
                Customer App
              </button>
            </div>
          </div>
        </header>

        {statsError && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {statsError}
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FiBriefcase}
            label="Services"
            value={isStatsLoading ? '...' : stats.totalServices}
            helper="Active and assigned services"
          />
          <StatCard
            icon={FiCalendar}
            label="Active Bookings"
            value={isStatsLoading ? '...' : stats.activeBookings}
            helper="Upcoming or accepted"
          />
          <StatCard
            icon={FiDollarSign}
            label="Monthly Earnings"
            value={
              isStatsLoading
                ? '...'
                : `$${Number(stats.monthlyEarnings || 0).toFixed(2)}`
            }
            helper="After commission"
          />
          <StatCard
            icon={FiStar}
            label="Rating"
            value={isStatsLoading ? '...' : Number(stats.averageRating || 0).toFixed(1)}
            helper="Average customer rating"
          />
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950">
                Recent Bookings
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Latest provider booking activity.
              </p>
            </div>
            {isStatsLoading && (
              <FiRefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            )}
          </div>

          {recentBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm font-semibold text-gray-900">
                No recent bookings yet
              </p>
              <p className="mt-2 text-sm text-gray-500">
                New bookings will appear here once customers start booking your
                services.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-gray-950">
                      {booking.service}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {booking.customer} - {booking.date} - {booking.time}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {booking.status}
                    </span>
                    <span className="text-sm font-bold text-gray-950">
                      ${Number(booking.amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProviderHomeScreen;
