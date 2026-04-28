import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/StateComponents';
import { fetchProviderDetails } from '../services/firebase/providerOnboardingService';
import { getProviderFlowPath } from '../utils/providerFlow';

const APP_STORE_URL = 'https://apps.apple.com/in/app/mylocalforce/id6757386095';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.mylocalforceapp&pcampaignid=web_share';

const ProviderHomeScreen = () => {
  const { user, isLoading } = useAuth();
  const [flowPath, setFlowPath] = useState(null);

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

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full rounded-4xl border border-white/10 bg-white/6 px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:px-10 sm:py-14">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2">
              <img
                src="/images/MLF.jpg"
                alt="My Local Force logo"
                className="h-10 w-10 rounded-full object-cover"
              />
              <span className="text-sm font-semibold tracking-[0.24em] text-white/80 uppercase">
                My Local Force
              </span>
            </div>

            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.4em] text-cyan-300">
              Coming soon
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
              It is coming
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              This provider dashboard is still being built. For now, download
              our app and keep using My Local Force on mobile.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-block transition-transform duration-300 hover:scale-[1.03]"
              >
                <img
                  src="/images/appStore.webp"
                  alt="Download on the App Store"
                  className="h-12 w-auto object-contain"
                />
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-block transition-transform duration-300 hover:scale-[1.03]"
              >
                <img
                  src="/images/googlePlay.webp"
                  alt="Get it on Google Play"
                  className="h-12 w-auto object-contain"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderHomeScreen;
