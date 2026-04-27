import { useEffect, useMemo, useState } from 'react';
import { FiMessageSquare, FiMonitor, FiSmartphone } from 'react-icons/fi';
import { useDocumentUploadSettings } from '../../../hooks/useDocumentUploadSettings';
import { useUploadSession } from '../../../hooks/useUploadSession';
import DesktopFallbackUpload from './DesktopFallbackUpload';
import QrCodeDisplay from './QrCodeDisplay';
import SessionExpiryCountdown from './SessionExpiryCountdown';
import UploadProgressTracker from './UploadProgressTracker';
import { getUserFacingError } from '../../../utils/toast';

/**
 * Converts Firestore/callable timestamp shapes to milliseconds.
 *
 * @param {*} value
 * @returns {number}
 */
const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return new Date(value).getTime() || 0;
};

/**
 * Desktop card for QR/SMS cross-device provider document upload.
 *
 * @param {Object} props
 * @param {string} props.providerId
 * @param {string} props.registrationStep
 * @param {string} [props.verifiedMobileNumber]
 * @param {boolean} [props.ignoreSubmittedSessions]
 * @param {Object[]} [props.carriedForwardDocuments]
 * @param {string[]} [props.requestedReuploadTypes]
 * @param {Function} [props.onSummaryChange]
 * @param {Function} [props.onAvailabilityChange]
 * @param {Function} [props.onBeforeCreateSession]
 * @returns {JSX.Element|null}
 */
const MobileUploadCard = ({
  providerId,
  registrationStep,
  verifiedMobileNumber,
  ignoreSubmittedSessions = false,
  carriedForwardDocuments = [],
  requestedReuploadTypes = [],
  onSummaryChange,
  onAvailabilityChange,
  onBeforeCreateSession,
}) => {
  const { settings, loading: settingsLoading, error: settingsError } = useDocumentUploadSettings();
  const [activeMode, setActiveMode] = useState('qr');
  const [notice, setNotice] = useState('');
  const {
    createSession,
    documents,
    error,
    loading,
    mobileUrl,
    sendSms,
    session,
    setError,
    summary,
  } = useUploadSession({
    providerId,
    registrationStep,
    verifiedMobileNumber,
    ignoreSubmittedSessions,
    onSummaryChange,
  });

  const canUseQr = Boolean(settings?.qrEnabled);
  const canUseSms = Boolean(settings?.smsEnabled);
  const canUseDesktop = Boolean(settings?.desktopFallbackEnabled);
  const isEnabled = canUseQr || canUseSms || canUseDesktop;
  const hasAuthSettingsError = /auth|unauth|unauthorized|sign in/i.test(
    String(settingsError || '')
  );
  const qrRefreshSoon = useMemo(() => {
    if (!session?.expiresAt) return false;
    return toMillis(session.expiresAt) - Date.now() < 10 * 60 * 1000;
  }, [session?.expiresAt]);

  useEffect(() => {
    onAvailabilityChange?.({
      loading: settingsLoading,
      enabled: isEnabled,
      error: settingsError || '',
      canUseQr,
      canUseSms,
      canUseDesktop,
    });
  }, [
    canUseDesktop,
    canUseQr,
    canUseSms,
    isEnabled,
    onAvailabilityChange,
    settingsError,
    settingsLoading,
  ]);

  useEffect(() => {
    if (settingsLoading) {
      return;
    }

    const activeModeAvailable =
      (activeMode === 'qr' && canUseQr) ||
      (activeMode === 'sms' && canUseSms) ||
      (activeMode === 'desktop' && canUseDesktop);

    if (activeModeAvailable) {
      return;
    }

    if (canUseQr) {
      setActiveMode('qr');
    } else if (canUseSms) {
      setActiveMode('sms');
    } else if (canUseDesktop) {
      setActiveMode('desktop');
    }
  }, [activeMode, canUseDesktop, canUseQr, canUseSms, settingsLoading]);

  if (settingsLoading) {
    return (
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Loading secure upload options...
      </section>
    );
  }

  if (settingsError && !settings) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <h3 className="text-base font-bold text-red-900">Secure document upload unavailable</h3>
        <p className="mt-1">
          {hasAuthSettingsError
            ? 'Your secure session is not authenticated. Please log in again and retry.'
            : 'Mobile upload options could not be loaded. Please try again.'}
        </p>
        <p className="mt-2">{settingsError}</p>
      </section>
    );
  }

  if (!isEnabled) {
    return (
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        Secure document upload is disabled in admin settings.
      </section>
    );
  }

  const prepareAndCreateSession = async (deliveryMethod) => {
    setNotice('');
    setError('');
    await onBeforeCreateSession?.();
    return createSession(deliveryMethod);
  };

  const handleQr = async () => {
    setActiveMode('qr');
    try {
      await prepareAndCreateSession(canUseSms ? 'both' : 'qr');
    } catch (createError) {
      setError(getUserFacingError(createError, 'Could not create QR upload link.'));
    }
  };

  const handleSms = async () => {
    setActiveMode('sms');
    try {
      await onBeforeCreateSession?.();
      await sendSms(verifiedMobileNumber);
      setNotice('Upload link sent by SMS.');
    } catch (smsError) {
      setError(getUserFacingError(smsError, 'Could not send upload SMS.'));
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-950">Secure upload checklist</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            Pick one upload method. Progress updates here as files are received.
          </p>
        </div>
        {session?.status === 'active' && <SessionExpiryCountdown expiresAt={session.expiresAt} />}
      </div>

      {(settingsError || error) && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {settingsError || error}
        </p>
      )}

      {notice && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </p>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
          Upload method
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {canUseQr && (
            <button
              type="button"
              onClick={handleQr}
              disabled={loading}
              className={`flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${
                activeMode === 'qr'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
              } disabled:opacity-60`}
            >
              <FiSmartphone className="h-4 w-4" />
              Mobile camera
            </button>
          )}
          {canUseSms && (
            <button
              type="button"
              onClick={handleSms}
              disabled={loading || !verifiedMobileNumber}
              className={`flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${
                activeMode === 'sms'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
              } disabled:opacity-60`}
            >
              <FiMessageSquare className="h-4 w-4" />
              Text link
            </button>
          )}
          {canUseDesktop && (
            <button
              type="button"
              onClick={() => setActiveMode('desktop')}
              className={`flex h-12 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${
                activeMode === 'desktop'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
              }`}
            >
              <FiMonitor className="h-4 w-4" />
              This device
            </button>
          )}
        </div>
      </div>

      {activeMode === 'qr' && (
        <QrCodeDisplay
          mobileUrl={mobileUrl}
          canRefresh={qrRefreshSoon || session?.status !== 'active'}
          loading={loading}
          onRefresh={handleQr}
        />
      )}

      <UploadProgressTracker
        requirements={settings?.requirements || []}
        documents={documents}
        carriedForwardDocuments={carriedForwardDocuments}
        requestedReuploadTypes={requestedReuploadTypes}
        session={session}
      />

      {activeMode === 'desktop' && (
        <DesktopFallbackUpload
          providerId={providerId}
          settings={settings}
          session={session}
          documents={documents}
          carriedForwardDocuments={carriedForwardDocuments}
          requestedReuploadTypes={requestedReuploadTypes}
          createSession={async (...args) => {
            await onBeforeCreateSession?.();
            return createSession(...args);
          }}
          onSubmitted={(result) => {
            onSummaryChange?.({
              ...summary,
              isSubmitted: true,
              sessionId: session?.id || result.sessionId,
              documentsMetadata: result.documentsMetadata || {},
            });
          }}
        />
      )}
    </section>
  );
};

export default MobileUploadCard;
