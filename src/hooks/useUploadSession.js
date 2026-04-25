import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createUploadSession,
  sendUploadSessionSms,
  subscribeToLatestProviderUploadSession,
  subscribeToUploadSessionProgress,
} from '../services/firebase/documentUploadService';

/**
 * Tracks and manages a provider upload session.
 *
 * @param {Object} params
 * @param {string} params.providerId
 * @param {string} params.registrationStep
 * @param {string} [params.verifiedMobileNumber]
 * @param {(summary: Object) => void} [params.onSummaryChange]
 * @returns {Object}
 */
export const useUploadSession = ({
  providerId,
  registrationStep,
  verifiedMobileNumber,
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
        setError(snapshotError.message || 'Upload session could not be loaded.');
      },
    );
  }, [providerId, registrationStep]);

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
        setError(snapshotError.message || 'Upload progress could not be loaded.');
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
    async (deliveryMethod = 'qr') => {
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
        });
        setSession(result.session || null);
        setMobileUrl(result.mobileUrl || '');
        setRawToken(result.rawToken || '');
        return result;
      } catch (createError) {
        setError(createError.message || 'Could not create upload session.');
        throw createError;
      } finally {
        setLoading(false);
      }
    },
    [providerId, registrationStep, verifiedMobileNumber],
  );

  const sendSms = useCallback(
    async (mobileNumber = verifiedMobileNumber) => {
      let activeSession = session;

      if (!activeSession?.id) {
        const result = await createSession('sms');
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
        return result;
      } catch (smsError) {
        setError(smsError.message || 'Could not send upload link.');
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
