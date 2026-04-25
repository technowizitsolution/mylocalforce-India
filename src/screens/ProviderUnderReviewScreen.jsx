import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFileText,
  FiLogOut,
  FiRefreshCw,
  FiShield,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const InfoCard = ({ title, children, icon: Icon = FiFileText }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
      <Icon className="h-5 w-5" />
    </div>
    <h2 className="text-sm font-bold text-gray-950">{title}</h2>
    <div className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
      {children}
    </div>
  </div>
);

const ReviewStep = ({ number, title, text, active, complete }) => (
  <div className="flex gap-4">
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        complete
          ? 'bg-emerald-600 text-white'
          : active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-400'
      }`}
    >
      {complete ? <FiCheckCircle className="h-4 w-4" /> : number}
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
    </div>
  </div>
);

const ProviderUnderReviewScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUserData, logout } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const approvalStatus = user?.approvalStatus || 'pending';
  const isRejected = approvalStatus === 'rejected';

  const rejectionDetails = useMemo(() => {
    if (Array.isArray(user?.rejectionReasons) && user.rejectionReasons.length > 0) {
      return user.rejectionReasons
        .map((item, index) => `${index + 1}. ${item}`)
        .join('\n');
    }

    if (typeof user?.rejectionReason === 'string' && user.rejectionReason.trim()) {
      return user.rejectionReason.trim();
    }

    return '';
  }, [user?.rejectionReason, user?.rejectionReasons]);

  useEffect(() => {
    if (approvalStatus === 'approved') {
      navigate('/provider/home', { replace: true });
    }
  }, [approvalStatus, navigate]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await refreshUserData?.();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const reuploadItems = Array.isArray(user?.rejectionMeta?.reuploadItems)
    ? user.rejectionMeta.reuploadItems
    : [];
  const missingDetails = Array.isArray(user?.rejectionMeta?.missingDetails)
    ? user.rejectionMeta.missingDetails
    : [];

  const pageTitle = isRejected
    ? 'Application Needs Updates'
    : 'Profile Under Review';
  const pageSubtitle = isRejected
    ? 'Your provider application was reviewed and needs a few updates before it can be approved.'
    : 'Thank you for completing your provider onboarding. Our team is reviewing your profile now.';

  return (
    <div className="min-h-screen bg-white p-4 sm:p-5">
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-8 lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(22rem,45vw)_1fr] lg:gap-12">
        <aside className="relative min-h-[20rem] overflow-hidden rounded-2xl bg-gray-950 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
          <img
            src="/images/SSaloon.jpg"
            alt="My Local Force services"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/42 via-blue-950/16 to-gray-950/52" />

          <div className="relative flex h-full min-h-[20rem] flex-col justify-between p-6 text-white sm:p-8 lg:min-h-full lg:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/12 backdrop-blur">
                <img
                  src="/images/MLF.jpg"
                  alt="My Local Force"
                  className="h-7 w-7 rounded object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-bold">My Local Force</p>
              </div>
            </div>

            <div className="max-w-md py-10 lg:py-0">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-100">
                Provider application
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                {isRejected
                  ? 'A few updates are needed.'
                  : 'Your profile is being reviewed.'}
              </h1>
              <p className="mt-4 text-base leading-7 text-white/78">
                {isRejected
                  ? 'Update the requested details and resubmit your provider application.'
                  : 'You have submitted your onboarding details. The admin team will review them soon.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiShield className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Secure review</p>
                <p className="mt-1 text-xs text-white/65">
                  Admin verification
                </p>
              </div>
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                {isRejected ? (
                  <FiAlertCircle className="mb-3 h-5 w-5 text-red-100" />
                ) : (
                  <FiClock className="mb-3 h-5 w-5 text-blue-100" />
                )}
                <p className="text-sm font-bold">
                  {isRejected ? 'Action needed' : 'Pending review'}
                </p>
                <p className="mt-1 text-xs text-white/65">
                  {isRejected ? 'Update details' : 'Usually 24 hours'}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-h-screen bg-white">
          <div className="mx-auto flex min-h-screen w-full max-w-[54rem] flex-col px-1 py-2 sm:px-4 lg:px-8">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-2 text-base font-medium text-blue-600 transition hover:text-blue-700 disabled:opacity-70"
              >
                <FiLogOut className="h-4 w-4" />
                {isLoggingOut ? 'Signing Out...' : 'Logout'}
              </button>
            </div>

            <div className="flex flex-1 items-center py-10 sm:py-12 lg:py-16">
              <div className="w-full">
                <div className="mb-8">
                  <div
                    className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${
                      isRejected
                        ? 'bg-red-50 text-red-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {isRejected ? (
                      <FiAlertCircle className="h-8 w-8" />
                    ) : (
                      <FiClock className="h-8 w-8" />
                    )}
                  </div>

                  <p
                    className={`text-sm font-bold uppercase tracking-wide ${
                      isRejected ? 'text-red-600' : 'text-blue-600'
                    }`}
                  >
                    {isRejected ? 'Action required' : 'Application submitted'}
                  </p>
                  <h1 className="mt-3 text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
                    {pageTitle}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">
                    {pageSubtitle}
                  </p>
                </div>

                {location.state?.justSubmitted && (
                  <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <p className="text-sm text-emerald-700">
                        Your onboarding details were submitted successfully.
                      </p>
                    </div>
                  </div>
                )}

                <div
                  className={`mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
                    isRejected
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isRejected ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                  />
                  {isRejected ? 'Rejected - Action Required' : 'Pending Review'}
                </div>

                {!isRejected && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.9fr]">
                    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <h2 className="text-lg font-bold text-gray-950">
                        Review progress
                      </h2>
                      <div className="mt-5 space-y-5">
                        <ReviewStep
                          number="1"
                          title="Application submitted"
                          text="Your onboarding details are saved and ready for review."
                          complete
                        />
                        <ReviewStep
                          number="2"
                          title="Admin review"
                          text="Our team checks your services, business details, and documents."
                          active
                        />
                        <ReviewStep
                          number="3"
                          title="Provider access"
                          text="Once approved, your provider role becomes active on web and mobile."
                        />
                      </div>
                    </section>

                    <div className="grid gap-4">
                      <InfoCard title="Review Window" icon={FiClock}>
                        Provider applications are usually reviewed within 24
                        hours.
                      </InfoCard>
                      <InfoCard title="What Happens Next" icon={FiShield}>
                        You can refresh your status here while the admin team
                        completes verification.
                      </InfoCard>
                    </div>
                  </div>
                )}

                {isRejected && (
                  <div className="grid gap-4">
                    {rejectionDetails && (
                      <InfoCard title="Rejection Reasons" icon={FiAlertCircle}>
                        {rejectionDetails}
                      </InfoCard>
                    )}

                    {reuploadItems.length > 0 && (
                      <InfoCard title="Please Re-upload" icon={FiFileText}>
                        {reuploadItems.map((item) => `- ${item}`).join('\n')}
                      </InfoCard>
                    )}

                    {missingDetails.length > 0 && (
                      <InfoCard title="Missing Details" icon={FiFileText}>
                        {missingDetails.map((item) => `- ${item}`).join('\n')}
                      </InfoCard>
                    )}
                  </div>
                )}

                <div className="mt-9 flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row">
                  {isRejected && (
                    <button
                      type="button"
                      onClick={() => navigate('/provider/onboarding')}
                      className="inline-flex h-14 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-blue-700"
                    >
                      <FiEdit3 className="h-4 w-4" />
                      Update Application
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-lg border border-gray-300 px-6 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-70"
                  >
                    <FiRefreshCw
                      className={`h-4 w-4 ${
                        isRefreshing ? 'animate-spin' : ''
                      }`}
                    />
                    Refresh Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProviderUnderReviewScreen;
