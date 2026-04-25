import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  inMemoryPersistence,
  setPersistence,
  signInWithCustomToken,
} from 'firebase/auth';
import { FiAlertCircle, FiClock, FiShield } from 'react-icons/fi';
import { auth } from '../../../services/firebase/firebaseConfig';
import { validateMobileUploadToken } from '../../../services/firebase/documentUploadService';
import GuidedUploadFlow from './GuidedUploadFlow';

/**
 * Simple mobile token state screen.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.message
 * @param {'loading'|'error'} [props.tone]
 * @returns {JSX.Element}
 */
const TokenValidationScreen = ({ title, message, tone = 'loading' }) => {
  const Icon = tone === 'loading' ? FiShield : FiAlertCircle;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-5">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            tone === 'loading'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          <Icon className={tone === 'loading' ? 'h-7 w-7 animate-pulse' : 'h-7 w-7'} />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
      </div>
    </div>
  );
};

/**
 * Public mobile upload page bootstrapped by raw token validation.
 *
 * @returns {JSX.Element}
 */
const MobileUploadPage = () => {
  const { token } = useParams();
  const [state, setState] = useState({
    loading: true,
    error: '',
    status: '',
    data: null,
  });

  useEffect(() => {
    let cancelled = false;

    const validateToken = async () => {
      if (!token) {
        setState({
          loading: false,
          error: 'Upload link is missing.',
          status: 'invalid',
          data: null,
        });
        return;
      }

      try {
        const result = await validateMobileUploadToken(token);
        const { providerAuthToken, ...safeResult } = result;

        await setPersistence(auth, inMemoryPersistence);
        await signInWithCustomToken(auth, providerAuthToken);

        if (!cancelled) {
          setState({
            loading: false,
            error: '',
            status: 'valid',
            data: safeResult,
          });
        }
      } catch (validationError) {
        if (!cancelled) {
          setState({
            loading: false,
            error:
              validationError.message ||
              'This upload link is invalid or no longer active.',
            status: validationError.details?.status || validationError.code || 'invalid',
            data: null,
          });
        }
      }
    };

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.loading) {
    return (
      <TokenValidationScreen
        title="Opening secure upload"
        message="Checking this document upload link..."
      />
    );
  }

  if (state.status === 'expired' || state.error.includes('expired')) {
    return (
      <TokenValidationScreen
        title="Upload link expired"
        message="Return to the desktop registration page and create a new mobile upload link."
        tone="error"
      />
    );
  }

  if (state.status === 'submitted') {
    return (
      <TokenValidationScreen
        title="Already submitted"
        message="These documents have already been sent for review."
        tone="error"
      />
    );
  }

  if (state.status === 'revoked') {
    return (
      <TokenValidationScreen
        title="Session revoked"
        message="This upload session is no longer available. Contact support if you need help."
        tone="error"
      />
    );
  }

  if (state.error || !state.data?.session) {
    return (
      <TokenValidationScreen
        title="Upload unavailable"
        message={state.error || 'This upload link could not be opened.'}
        tone="error"
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-xl items-center gap-2 text-sm font-bold text-gray-950">
          <FiClock className="h-4 w-4 text-blue-600" />
          MyLocalForce document upload
        </div>
      </div>
      <GuidedUploadFlow
        session={state.data.session}
        settings={state.data.settings}
        uploadedDocuments={state.data.uploadedDocuments || []}
      />
    </div>
  );
};

export default MobileUploadPage;
