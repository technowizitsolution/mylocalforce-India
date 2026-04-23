import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { switchActiveRole } from '../services/firebase/userService';
import { fetchProviderDetails } from '../services/firebase/providerOnboardingService';
import { Loading } from '../components/StateComponents';
import { getProviderFlowPath } from '../utils/providerFlow';

const ProviderEntryScreen = () => {
  const { user, isLoading } = useAuth();
  const [destination, setDestination] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const resolveDestination = async () => {
      if (!user?.uid) {
        return;
      }

      try {
        if (user.activeRole !== 'client') {
          await switchActiveRole(user.uid, 'client').catch(() => undefined);
        }

        let providerDetails = null;
        const topLevelSignalsPresent =
          user.onboardingCompleted === true ||
          user.onboardingDocuments === true ||
          user.providerOnboarding === true ||
          user.provider_onboarding === true;

        if (!topLevelSignalsPresent) {
          providerDetails = await fetchProviderDetails(user.uid).catch(
            () => null,
          );
        }

        if (!cancelled) {
          setDestination(
            getProviderFlowPath({
              profile: user,
              providerDetails,
            }),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setDestination('/provider/onboarding');
        }
      }
    };

    resolveDestination();

    return () => {
      cancelled = true;
    };
  }, [
    user?.uid,
    user?.activeRole,
    user?.approvalStatus,
    user?.onboardingCompleted,
    user?.onboardingDocuments,
    user?.providerOnboarding,
    user?.provider_onboarding,
  ]);

  if (isLoading || !destination) {
    return <Loading fullScreen />;
  }

  return <Navigate to={destination} replace />;
};

export default ProviderEntryScreen;
