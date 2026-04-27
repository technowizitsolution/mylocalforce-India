import { useState } from 'react';
import { FiCheckCircle, FiFileText, FiUpload } from 'react-icons/fi';
import { submitMobileDocuments } from '../../../services/firebase/documentUploadService';
import { uploadProviderDocumentSecure } from '../../../services/firebase/secureDocumentStorageService';
import { notify, getUserFacingError } from '../../../utils/toast';

const IDENTITY_DOCUMENT_REQUIREMENTS = new Set([
  'passport',
  'driving_licence',
  'driving_license',
  'drivingLicence',
]);

const DOCUMENT_TYPE_ALIASES = {
  driving_license: 'driving_licence',
  drivingLicence: 'driving_licence',
  drivingLicense: 'driving_licence',
  resume: 'resume_cv',
  cv: 'resume_cv',
  verificationVideo: 'verification_video',
};

const normalizeDocumentType = (value) => {
  const raw = String(value || '');
  const snake = raw.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).toLowerCase();
  return DOCUMENT_TYPE_ALIASES[raw] || DOCUMENT_TYPE_ALIASES[snake] || snake;
};

/**
 * Expands document requirements into upload steps.
 *
 * @param {Object[]} requirements
 * @returns {Object[]}
 */
const expandRequirements = (requirements = []) =>
  requirements
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap((requirement) =>
      (requirement.sides || ['single']).map((side) => ({
        key: `${requirement.id}:${side}`,
        requirement,
        side,
      }))
    );

/**
 * Lets providers upload secure documents from desktop when enabled.
 *
 * @param {Object} props
 * @param {string} props.providerId
 * @param {Object|null} props.settings
 * @param {Object|null} props.session
 * @param {Object[]} props.documents
 * @param {Object[]} [props.carriedForwardDocuments]
 * @param {string[]} [props.requestedReuploadTypes]
 * @param {Function} props.createSession
 * @param {Function} [props.onSubmitted]
 * @returns {JSX.Element|null}
 */
const DesktopFallbackUpload = ({
  providerId,
  settings,
  session,
  documents = [],
  carriedForwardDocuments = [],
  requestedReuploadTypes = [],
  createSession,
  onSubmitted,
}) => {
  const [progress, setProgress] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (!settings?.desktopFallbackEnabled) {
    return null;
  }

  const uploaded = new Set(
    documents
      .filter((document) => ['uploaded', 'submitted', 'approved'].includes(document.status))
      .map((document) => `${normalizeDocumentType(document.documentType)}:${document.side}`)
  );
  const requestedTypes = new Set(requestedReuploadTypes.map(normalizeDocumentType));
  const carriedForward = new Set(
    carriedForwardDocuments
      .filter((document) => !requestedTypes.has(normalizeDocumentType(document.documentType)))
      .map((document) => `${normalizeDocumentType(document.documentType)}:${document.side}`)
  );
  const steps = expandRequirements(settings.requirements);

  const uploadFile = async (step, file) => {
    if (!file) {
      return;
    }

    setErrors((current) => ({ ...current, [step.key]: '' }));

    try {
      let activeSession = session;
      if (!activeSession?.id) {
        const result = await createSession('qr');
        activeSession = result.session;
      }

      await uploadProviderDocumentSecure({
        file,
        providerId,
        sessionId: activeSession.id,
        documentType: step.requirement.id,
        side: step.side,
        source: 'desktop',
        onProgress: (uploadProgress) => {
          setProgress((current) => ({
            ...current,
            [step.key]: uploadProgress.percent,
          }));
        },
      });
    } catch (error) {
      const message = getUserFacingError(error, 'File upload failed. Please try again.');
      setErrors((current) => ({
        ...current,
        [step.key]: message,
      }));
      notify.error(message, { id: `desktop-upload-${step.key}` });
    }
  };

  const submitSecureDocuments = async () => {
    if (!session?.id) {
      setErrors((current) => ({
        ...current,
        submit: 'Upload at least one secure document first.',
      }));
      notify.warning('Upload at least one secure document first.', {
        id: 'desktop-upload-submit',
      });
      return;
    }

    setSubmitting(true);
    setErrors((current) => ({ ...current, submit: '' }));

    try {
      const result = await submitMobileDocuments(session.id);
      if (result.success === false) {
        const missing = (result.missing || []).map((item) => item.label).join(', ');
        setErrors((current) => ({
          ...current,
          submit: missing
            ? `Missing required documents: ${missing}.`
            : 'Required documents are missing.',
        }));
        notify.warning(
          missing ? `Missing required documents: ${missing}.` : 'Required documents are missing.',
          { id: 'desktop-upload-submit' }
        );
        return;
      }

      onSubmitted?.(result);
      notify.success('Document uploads finished.', { id: 'desktop-upload-submit' });
    } catch (error) {
      const message = getUserFacingError(error, 'Secure document submission failed.');
      setErrors((current) => ({
        ...current,
        submit: message,
      }));
      notify.error(message, { id: 'desktop-upload-submit' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-950">Upload from this device</h3>
          <p className="mt-1 text-sm text-gray-500">
            Attach each file from your computer and finish this checklist.
          </p>
        </div>
        {session?.status === 'submitted' && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <FiCheckCircle className="h-3.5 w-3.5" />
            Submitted
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {steps.map((step) => {
          const accept = (step.requirement.allowedMimeTypes || []).join(',');
          const normalizedStepKey = `${normalizeDocumentType(step.requirement.id)}:${step.side}`;
          const done = uploaded.has(normalizedStepKey) || carriedForward.has(normalizedStepKey);
          const isCarriedForward =
            !uploaded.has(normalizedStepKey) && carriedForward.has(normalizedStepKey);
          const percent = progress[step.key];
          const isIdentityProof = IDENTITY_DOCUMENT_REQUIREMENTS.has(step.requirement.id);

          return (
            <div key={step.key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FiFileText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-950">
                    {(step.requirement.sides || []).length > 1
                      ? `${step.requirement.label} (${step.side})`
                      : step.requirement.label}
                    {step.requirement.required ? ' *' : ''}
                  </p>
                  {isIdentityProof && (
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      Passport or driving licence is required.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">{step.requirement.description}</p>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50">
                <FiUpload className="h-4 w-4" />
                {done ? 'Replace file' : 'Upload file'}
                <input
                  type="file"
                  className="hidden"
                  accept={accept}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    event.target.value = '';
                    uploadFile(step, file);
                  }}
                />
              </label>

              {typeof percent === 'number' && percent > 0 && percent < 100 && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}

              {done && (
                <p
                  className={`mt-3 inline-flex items-center gap-1 text-xs font-bold ${
                    isCarriedForward ? 'text-blue-700' : 'text-emerald-700'
                  }`}
                >
                  <FiCheckCircle className="h-3.5 w-3.5" />
                  {isCarriedForward ? 'Already on file' : 'Uploaded'}
                </p>
              )}

              {errors[step.key] && <p className="mt-3 text-sm text-red-600">{errors[step.key]}</p>}
            </div>
          );
        })}
      </div>

      {errors.submit && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors.submit}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={submitSecureDocuments}
          disabled={submitting || session?.status === 'submitted'}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? 'Finishing...' : 'Finish uploads'}
        </button>
      </div>
    </section>
  );
};

export default DesktopFallbackUpload;
