import { useState } from 'react';
import { FiCheckCircle } from 'react-icons/fi';
import { submitMobileDocuments } from '../../../services/firebase/documentUploadService';

/**
 * Final mobile upload submission screen.
 *
 * @param {Object} props
 * @param {string} props.sessionId
 * @param {string} props.registrationStep
 * @param {(missing: Object[]) => void} props.onMissing
 * @returns {JSX.Element}
 */
const SubmitScreen = ({ sessionId, registrationStep, onMissing }) => {
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const result = await submitMobileDocuments(sessionId);
      if (result.success === false) {
        onMissing(result.missing || []);
        setError('Some required documents are still missing.');
        return;
      }
      setComplete(true);
    } catch (submitError) {
      setError(submitError.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (complete) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <FiCheckCircle className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-950">Documents sent</h2>
        <p className="text-sm leading-6 text-gray-600">
          {registrationStep === 'provider_onboarding_documents'
            ? 'Return to your desktop page to finish submitting your provider registration.'
            : 'Your updated documents have been sent for review.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-950">Submit documents</h2>
      <p className="text-sm leading-6 text-gray-600">
        Send your uploaded documents to MyLocalForce for review.
      </p>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Submit for review'}
      </button>
    </div>
  );
};

export default SubmitScreen;
