export const roleHomePathMap = {
  admin: '/admin',
  client: '/provider',
  customer: '/customer',
};

export const getRoleHomePath = (role) => roleHomePathMap[role] || '/';

export const hasProviderOnboarding = (profile = {}, providerDetails = null) =>
  Boolean(
    profile?.onboardingCompleted === true ||
      profile?.onboardingDocuments === true ||
      profile?.providerOnboarding === true ||
      profile?.provider_onboarding === true ||
      (profile?.details && profile.details.provider_onboarding === true) ||
      (providerDetails &&
        typeof providerDetails === 'object' &&
        Object.keys(providerDetails).length > 0),
  );

export const getProviderFlowState = ({
  profile = {},
  providerDetails = null,
} = {}) => {
  if (!hasProviderOnboarding(profile, providerDetails)) {
    return 'onboarding';
  }

  const approvalStatus = profile?.approvalStatus || 'approved';

  if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
    return 'under-review';
  }

  return 'dashboard';
};

export const getProviderFlowPath = (input) => {
  const state = getProviderFlowState(input);

  if (state === 'onboarding') {
    return '/provider/onboarding';
  }

  if (state === 'under-review') {
    return '/provider/under-review';
  }

  return '/provider/home';
};

export const getSignedInHomePath = ({
  user = null,
  roles = null,
  activeRole = null,
} = {}) => {
  const resolvedRoles =
    roles && typeof roles === 'object' ? roles : user?.roles || {};
  const enabledRoles = Object.keys(resolvedRoles).filter(
    (role) => resolvedRoles[role],
  );

  if (activeRole && resolvedRoles[activeRole]) {
    return getRoleHomePath(activeRole);
  }

  if (enabledRoles.length === 1) {
    return getRoleHomePath(enabledRoles[0]);
  }

  if (resolvedRoles.client) {
    return '/provider';
  }

  if (resolvedRoles.customer) {
    return '/customer';
  }

  if (resolvedRoles.admin) {
    return '/admin';
  }

  return '/';
};
