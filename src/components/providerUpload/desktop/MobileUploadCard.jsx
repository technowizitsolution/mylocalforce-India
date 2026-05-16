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

const formatSmsPhoneNumber = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('+')) {
    return `+${raw.replace(/[^\d]/g, '')}`;
  }

  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return '';

  if (digits.startsWith('61') && digits.length >= 11) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `+61${digits.slice(1)}`;
  }

  if (digits.startsWith('4') && digits.length === 9) {
    return `+61${digits}`;
  }

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }

  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
};

const sessionMatchesMetadata = (session, metadata = {}) =>
  Object.entries(metadata).every(
    ([key, value]) => String(session?.metadata?.[key] || '') === String(value || ''),
  );

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
 * @param {boolean} [props.allowSms]
 * @param {'qr'|'sms'|'desktop'|''} [props.forcedMode]
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
  allowSms = true,
  forcedMode = '',
}) => {
  const { settings, loading: settingsLoading, error: settingsError } = useDocumentUploadSettings();
  const [activeMode, setActiveMode] = useState(forcedMode || 'qr');
  const [notice, setNotice] = useState('');
  const [smsNumber, setSmsNumber] = useState(verifiedMobileNumber || '');
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
  const canUseSms = allowSms && Boolean(settings?.smsEnabled);
  const canUseDesktop = Boolean(settings?.desktopFallbackEnabled);
  const isEnabled = canUseQr || canUseSms || canUseDesktop;
  const hasAuthSettingsError = /auth|unauth|unauthorized|sign in/i.test(
    String(settingsError || '')
  );
  const qrRefreshSoon = useMemo(() => {
    if (!session?.expiresAt) return false;
    return toMillis(session.expiresAt) - Date.now() < 10 * 60 * 1000;
  }, [session?.expiresAt]);
  const uploadMetadata = useMemo(
    () => ({
      requestedReuploadTypes: requestedReuploadTypes.join(','),
      reuploadOnly: requestedReuploadTypes.length > 0 ? 'true' : 'false',
    }),
    [requestedReuploadTypes],
  );
  const canReuseCurrentQr = Boolean(
    mobileUrl &&
      session?.status === 'active' &&
      !qrRefreshSoon &&
      (!session?.expiresAt || toMillis(session.expiresAt) > Date.now()) &&
      sessionMatchesMetadata(session, uploadMetadata),
  );

  useEffect(() => {
    setSmsNumber(verifiedMobileNumber || '');
  }, [verifiedMobileNumber]);

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

    if (forcedMode) {
      setActiveMode(forcedMode);
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
  }, [activeMode, canUseDesktop, canUseQr, canUseSms, forcedMode, settingsLoading]);

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
    return createSession(deliveryMethod, uploadMetadata);
  };

  const handleQr = async () => {
    setActiveMode('qr');
    if (canReuseCurrentQr) {
      setNotice('Current QR upload link is still active.');
      return;
    }
    try {
      await prepareAndCreateSession('qr');
    } catch (createError) {
      setError(getUserFacingError(createError, 'Could not create QR upload link.'));
    }
  };

  const handleSms = async () => {
    setActiveMode('sms');
    const mobileNumber = formatSmsPhoneNumber(smsNumber);
    if (!/^\+\d{8,15}$/.test(mobileNumber)) {
      setError(
        'A valid mobile number is required to send the upload SMS. Use international format, for example +61412345678 or +918569051234.'
      );
      return;
    }

    try {
      await onBeforeCreateSession?.();
      await sendSms(mobileNumber, uploadMetadata);
      setNotice('Upload link sent by SMS.');
    } catch (smsError) {
      const message = getUserFacingError(smsError, 'Could not send upload SMS.');
      setError(
        /failed to send upload sms/i.test(message)
          ? 'SMS sending failed on the server. Check Twilio configuration and the provider mobile number.'
          : message
      );
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

      {!forcedMode ? (
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
                disabled={loading || !smsNumber}
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
      ) : null}

      {forcedMode === 'qr' && (
        <button
          type="button"
          onClick={handleQr}
          disabled={loading || !canUseQr}
          className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          <FiSmartphone className="h-4 w-4" />
          {mobileUrl ? 'Show QR upload link' : 'Generate QR upload link'}
        </button>
      )}

      {forcedMode === 'sms' && (
        <div className="grid gap-3 sm:max-w-md">
          <label className="grid gap-1.5">
            <span className="text-sm font-bold text-gray-700">SMS mobile number</span>
            <input
              type="tel"
              value={smsNumber}
              onChange={(event) => setSmsNumber(event.target.value)}
              placeholder="+61412345678 or +918569051234"
              className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-blue-500"
            />
          </label>
          <button
            type="button"
            onClick={handleSms}
            disabled={loading || !canUseSms || !smsNumber}
            className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <FiMessageSquare className="h-4 w-4" />
            Send SMS upload link
          </button>
        </div>
      )}

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
