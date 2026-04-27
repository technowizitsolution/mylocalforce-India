import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { auth, firestore, functions as functionsClient } from './firebaseConfig';

const AUTH_READY_TIMEOUT_MS = 6000;

const waitForAuthUser = (timeoutMs = AUTH_READY_TIMEOUT_MS) =>
  new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    let settled = false;
    let unsubscribe = () => {};

    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(null);
    }, timeoutMs);

    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      unsubscribe();
      resolve(user || null);
    });
  });

const ensureCallableAuth = async () => {
  const user = auth.currentUser || (await waitForAuthUser());

  if (!user) {
    throw new Error('Please sign in again to use secure document upload.');
  }

  const idToken = await user.getIdToken();
  return { user, idToken };
};

const isUnauthenticatedCallableError = (error) =>
  error?.code === 'functions/unauthenticated' ||
  String(error?.message || '')
    .toLowerCase()
    .includes('authentication required');

const IDENTITY_DOCUMENT_REQUIREMENTS = new Set([
  'passport',
  'driving_licence',
  'driving_license',
  'drivingLicence',
]);

const identityDescriptions = {
  passport: 'Upload a clear JPEG image of your passport if it is your identity document.',
  driving_licence:
    'Upload a clear JPEG image of your driving licence if it is your identity document.',
  driving_license:
    'Upload a clear JPEG image of your driving licence if it is your identity document.',
  drivingLicence:
    'Upload a clear JPEG image of your driving licence if it is your identity document.',
};

const normalizeUploadRequirement = (requirement) => {
  if (!IDENTITY_DOCUMENT_REQUIREMENTS.has(requirement?.id)) {
    return requirement;
  }

  return {
    ...requirement,
    required: false,
    description: identityDescriptions[requirement.id] || requirement.description,
  };
};

const normalizeUploadSettings = (settings) => {
  if (!settings) {
    return settings;
  }

  return {
    ...settings,
    requirements: (settings.requirements || []).map(normalizeUploadRequirement),
  };
};

const normalizeUploadSettingsResponse = (response) => {
  if (!response?.settings) {
    return response;
  }

  const settings = normalizeUploadSettings(response.settings);

  return {
    ...response,
    settings,
    requirements: settings.requirements,
  };
};

/**
 * Calls a secure document upload Cloud Function.
 *
 * @param {string} name
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
const callDocumentUploadFunction = async (
  name,
  payload = {},
  options = {},
) => {
  const { requireAuth = true } = options;
  let authToken = '';

  if (requireAuth) {
    const authState = await ensureCallableAuth();
    authToken = authState.idToken;
  }

  const callable = httpsCallable(functionsClient, name);
  const callablePayload = requireAuth
    ? { ...payload, idToken: authToken }
    : payload;

  try {
    const result = await callable(callablePayload);
    return result.data || {};
  } catch (error) {
    if (
      requireAuth &&
      isUnauthenticatedCallableError(error) &&
      auth.currentUser?.getIdToken
    ) {
      // Retry once with a forced token refresh to recover from stale auth state.
      const refreshedIdToken = await auth.currentUser.getIdToken(true);
      const retryResult = await callable({
        ...payload,
        idToken: refreshedIdToken,
      });
      return retryResult.data || {};
    }

    throw error;
  }
};

/**
 * Creates a provider upload session.
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const createUploadSession = (payload) =>
  callDocumentUploadFunction('createUploadSession', payload).then(
    normalizeUploadSettingsResponse,
  );

/**
 * Sends or resends a provider upload session SMS.
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const sendUploadSessionSms = (payload) =>
  callDocumentUploadFunction('sendUploadSessionSms', payload);

/**
 * Validates a mobile upload token.
 *
 * @param {string} token
 * @returns {Promise<Object>}
 */
export const validateMobileUploadToken = (token) =>
  callDocumentUploadFunction(
    'validateMobileUploadToken',
    { token },
    { requireAuth: false },
  ).then(normalizeUploadSettingsResponse);

/**
 * Gets upload session status.
 *
 * @param {string} sessionId
 * @returns {Promise<Object>}
 */
export const getUploadSessionStatus = (sessionId) =>
  callDocumentUploadFunction('getUploadSessionStatus', { sessionId });

/**
 * Records a completed secure Storage upload.
 *
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export const recordDocumentUpload = (payload) =>
  callDocumentUploadFunction('recordDocumentUpload', payload);

/**
 * Submits secure provider documents for review.
 *
 * @param {string} sessionId
 * @returns {Promise<Object>}
 */
export const submitMobileDocuments = (sessionId) =>
  callDocumentUploadFunction('submitMobileDocuments', { sessionId });

/**
 * Gets global document upload settings.
 *
 * @returns {Promise<Object>}
 */
export const getDocumentUploadSettings = () =>
  callDocumentUploadFunction('getDocumentUploadSettings').then(
    normalizeUploadSettingsResponse,
  );

/**
 * Subscribes to a specific upload session and its documents.
 *
 * @param {string} sessionId
 * @param {string} providerId
 * @param {(summary: Object) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void}
 */
export const subscribeToUploadSessionProgress = (
  sessionId,
  providerId,
  onChange,
  onError,
) => {
  if (!sessionId || !providerId) {
    return () => {};
  }

  let latestSession = null;
  let latestDocuments = [];

  const emit = () => {
    onChange({
      session: latestSession,
      documents: latestDocuments,
    });
  };

  const sessionUnsubscribe = onSnapshot(
    doc(firestore, 'providerUploadSessions', sessionId),
    (snapshot) => {
      latestSession = snapshot.exists()
        ? { id: snapshot.id, ...snapshot.data() }
        : null;
      emit();
    },
    onError,
  );

  const documentsQuery = query(
    collection(firestore, 'providerDocuments'),
    where('providerId', '==', providerId),
    where('uploadSessionId', '==', sessionId),
  );
  const documentsUnsubscribe = onSnapshot(
    documentsQuery,
    (snapshot) => {
      latestDocuments = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      emit();
    },
    onError,
  );

  return () => {
    sessionUnsubscribe();
    documentsUnsubscribe();
  };
};

/**
 * Subscribes to a provider's latest active or submitted upload session.
 *
 * @param {string} providerId
 * @param {string} registrationStep
 * @param {(summary: Object) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @param {{ includeSubmitted?: boolean }} [options]
 * @returns {() => void}
 */
export const subscribeToLatestProviderUploadSession = (
  providerId,
  registrationStep,
  onChange,
  onError,
  options = {},
) => {
  if (!providerId) {
    return () => {};
  }

  const includeSubmitted = options.includeSubmitted !== false;

  const sessionsQuery = query(
    collection(firestore, 'providerUploadSessions'),
    where('providerId', '==', providerId),
    where('registrationStep', '==', registrationStep),
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const sessions = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((session) =>
          includeSubmitted
            ? ['active', 'submitted'].includes(session.status)
            : session.status === 'active'
        )
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
          const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
          return bTime - aTime;
        });

      onChange(sessions[0] || null);
    },
    onError,
  );
};
