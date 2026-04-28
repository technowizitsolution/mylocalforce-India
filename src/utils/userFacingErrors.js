const FALLBACK_ERROR = 'Something went wrong. Please try again.';

const codeMessages = [
  {
    match: ['permission-denied', 'auth/operation-not-allowed'],
    message: 'You do not have permission to perform this action.',
  },
  {
    match: ['storage/unauthorized'],
    message:
      'Secure upload is not allowed for this link. Refresh the desktop page, create a new upload link, and try again.',
  },
  {
    match: ['unauthenticated', 'auth/requires-recent-login', 'auth/user-token-expired'],
    message: 'Your session expired. Sign in again to continue.',
  },
  {
    match: ['not-found', 'auth/user-not-found'],
    message: 'We could not find that record. Refresh and try again.',
  },
  {
    match: ['unavailable', 'network', 'deadline-exceeded'],
    message: 'Connection issue. Check your internet and try again.',
  },
  {
    match: ['already-exists', 'auth/email-already-in-use'],
    message: 'This account already exists. Try signing in instead.',
  },
  {
    match: ['auth/invalid-email'],
    message: 'Enter a valid email address.',
  },
  {
    match: ['auth/wrong-password', 'auth/invalid-credential'],
    message: 'Incorrect login details. Please try again.',
  },
  {
    match: ['auth/too-many-requests', 'resource-exhausted'],
    message: 'Too many attempts. Please wait a moment and try again.',
  },
];

const technicalMessagePatterns = [
  /firebase/i,
  /cloud function/i,
  /internal/i,
  /stack/i,
  /network request failed/i,
  /^error[:\s]/i,
];

export const getUserFacingError = (error, fallback = FALLBACK_ERROR) => {
  if (!error) return fallback;

  if (typeof error === 'string') {
    return error.trim() || fallback;
  }

  if (error.userMessage) return error.userMessage;

  const code = String(error.code || error.status || '').toLowerCase();
  const mapped = codeMessages.find(({ match }) => match.some((item) => code.includes(item)));
  if (mapped) return mapped.message;

  const message = String(error.message || '').trim();
  if (!message) return fallback;

  const looksTechnical = technicalMessagePatterns.some((pattern) => pattern.test(message));
  return looksTechnical ? fallback : message;
};
