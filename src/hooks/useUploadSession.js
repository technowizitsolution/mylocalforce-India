import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createUploadSession,
  sendUploadSessionSms,
  subscribeToLatestProviderUploadSession,
  subscribeToUploadSessionProgress,
} from '../services/firebase/documentUploadService';
import { notify, getUserFacingError } from '../utils/toast';

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return new Date(value).getTime() || 0;
};

const sessionMatchesMetadata = (session, metadata = {}) =>
  Object.entries(metadata).every(
    ([key, value]) => String(session?.metadata?.[key] || '') === String(value || ''),
  );

const canReuseSmsSession = (session, metadata = {}) =>
  Boolean(
    session?.id &&
      session.status === 'active' &&
      (!session.expiresAt || toMillis(session.expiresAt) > Date.now()) &&
      sessionMatchesMetadata(session, metadata),
  );

/**
 * Tracks and manages a provider upload session.
 *
 * @param {Object} params
 * @param {string} params.providerId
 * @param {string} params.registrationStep
 * @param {string} [params.verifiedMobileNumber]
 * @param {boolean} [params.ignoreSubmittedSessions]
 * @param {(summary: Object) => void} [params.onSummaryChange]
 * @returns {Object}
 */
export const useUploadSession = ({
  providerId,
  registrationStep,
  verifiedMobileNumber,
  ignoreSubmittedSessions = false,
  onSummaryChange,
}) => {
  const [session, setSession] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [mobileUrl, setMobileUrl] = useState('');
  const [rawToken, setRawToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!providerId || !registrationStep) {
      return undefined;
    }

    return subscribeToLatestProviderUploadSession(
      providerId,
      registrationStep,
      (latestSession) => {
        setSession((current) => latestSession || current);
      },
      (snapshotError) => {
        const message = getUserFacingError(
          snapshotError,
          'Upload session could not be loaded.',
        );
        setError(message);
        notify.error(message, { id: 'upload-session-load' });
      },
      { includeSubmitted: !ignoreSubmittedSessions },
    );
  }, [ignoreSubmittedSessions, providerId, registrationStep]);

  useEffect(() => {
    if (!session?.id) {
      setDocuments([]);
      return undefined;
    }

    return subscribeToUploadSessionProgress(
      session.id,
      providerId,
      (summary) => {
        setSession(summary.session || null);
        setDocuments(summary.documents || []);
      },
      (snapshotError) => {
        const message = getUserFacingError(
          snapshotError,
          'Upload progress could not be loaded.',
        );
        setError(message);
        notify.error(message, { id: 'upload-progress-load' });
      },
    );
  }, [providerId, session?.id]);

  const summary = useMemo(
    () => ({
      session,
      documents,
      sessionId: session?.id || '',
      documentsMetadata: session?.documentsMetadata || {},
      isSubmitted: session?.status === 'submitted',
      hasUploadedDocuments: documents.some((item) =>
        ['uploaded', 'submitted', 'approved'].includes(item.status),
      ),
    }),
    [documents, session],
  );

  useEffect(() => {
    if (typeof onSummaryChange === 'function') {
      onSummaryChange(summary);
    }
  }, [onSummaryChange, summary]);

  const createSession = useCallback(
    async (deliveryMethod = 'qr', metadata = {}) => {
      if (!providerId) {
        throw new Error('Provider is required.');
      }

      setLoading(true);
      setError('');

      try {
        const result = await createUploadSession({
          providerId,
          registrationStep,
          deliveryMethod,
          mobileNumber: verifiedMobileNumber || '',
          metadata,
        });
        setSession(result.session || null);
        setMobileUrl(result.mobileUrl || '');
        setRawToken(result.rawToken || '');
        notify.success('Upload session created.', { id: 'upload-session-create' });
        return result;
      } catch (createError) {
        const message = getUserFacingError(
          createError,
          'Could not create upload session.',
        );
        setError(message);
        notify.error(message, { id: 'upload-session-create' });
        throw createError;
      } finally {
        setLoading(false);
      }
    },
    [providerId, registrationStep, verifiedMobileNumber],
  );

  const sendSms = useCallback(
    async (mobileNumber = verifiedMobileNumber, metadata = {}) => {
      let activeSession = session;

      if (!canReuseSmsSession(activeSession, metadata)) {
        const result = await createSession('sms', metadata);
        activeSession = result.session;
      }

      if (!activeSession?.id) {
        throw new Error('Upload session could not be created.');
      }

      setLoading(true);
      setError('');

      try {
        const result = await sendUploadSessionSms({
          sessionId: activeSession.id,
          mobileNumber,
          forceBoth: true,
        });
        setSession(result.session || activeSession);
        setMobileUrl(result.mobileUrl || '');
        setRawToken('');
        notify.success('Upload link sent by SMS.', { id: 'upload-session-sms' });
        return result;
      } catch (smsError) {
        const message = getUserFacingError(smsError, 'Could not send upload link.');
        setError(message);
        notify.error(message, { id: 'upload-session-sms' });
        throw smsError;
      } finally {
        setLoading(false);
      }
    },
    [createSession, session, verifiedMobileNumber],
  );

  return {
    createSession,
    documents,
    error,
    loading,
    mobileUrl,
    rawToken,
    sendSms,
    session,
    setError,
    summary,
  };
};
