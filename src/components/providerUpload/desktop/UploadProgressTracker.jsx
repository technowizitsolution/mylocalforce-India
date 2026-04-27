import { FiCheckCircle, FiClock, FiFileText } from 'react-icons/fi';

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
 * Builds a key from a provider document.
 *
 * @param {Object} document
 * @returns {string}
 */
const documentKey = (document) => `${normalizeDocumentType(document.documentType)}:${document.side}`;

/**
 * Shows upload progress for the current session.
 *
 * @param {Object} props
 * @param {Object[]} props.requirements
 * @param {Object[]} props.documents
 * @param {Object[]} [props.carriedForwardDocuments]
 * @param {string[]} [props.requestedReuploadTypes]
 * @param {Object|null} props.session
 * @returns {JSX.Element|null}
 */
const UploadProgressTracker = ({
  requirements = [],
  documents = [],
  carriedForwardDocuments = [],
  requestedReuploadTypes = [],
  session,
}) => {
  if (!requirements.length) {
    return null;
  }

  const requestedTypes = new Set(requestedReuploadTypes.map(normalizeDocumentType));
  const uploaded = new Set(
    documents
      .filter((document) => ['uploaded', 'submitted', 'approved'].includes(document.status))
      .map(documentKey)
  );
  const carriedForward = new Set(
    carriedForwardDocuments
      .filter((document) => !requestedTypes.has(normalizeDocumentType(document.documentType)))
      .map(documentKey)
  );
  const steps = requirements
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap((requirement) =>
      (requirement.sides || ['single']).map((side) => ({
        key: `${normalizeDocumentType(requirement.id)}:${side}`,
        label:
          (requirement.sides || []).length > 1
            ? `${requirement.label} (${side})`
            : requirement.label,
        identityProof: IDENTITY_DOCUMENT_REQUIREMENTS.has(requirement.id),
        required: requirement.required,
      }))
    );
  const completedCount = steps.filter(
    (step) => uploaded.has(step.key) || carriedForward.has(step.key)
  ).length;
  const status = session?.status || 'not_started';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-950">Upload checklist</p>
          <p className="mt-1 text-xs text-gray-500">
            {completedCount} of {steps.length} files received
          </p>
        </div>
        {status === 'submitted' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <FiCheckCircle className="h-3.5 w-3.5" />
            Complete
          </span>
        ) : session?.id ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            <FiClock className="h-3.5 w-3.5" />
            In progress
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            <FiClock className="h-3.5 w-3.5" />
            Not started
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {steps.map((step) => {
          const done = uploaded.has(step.key) || carriedForward.has(step.key);
          const isCarriedForward = !uploaded.has(step.key) && carriedForward.has(step.key);
          return (
            <div
              key={step.key}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                isCarriedForward
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              {done ? (
                <FiCheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <FiFileText className="h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{step.label}</span>
              {step.identityProof ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-500">
                  {isCarriedForward ? 'On file' : 'One required'}
                </span>
              ) : step.required ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-500">
                  {isCarriedForward ? 'On file' : 'Required'}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-500">
                  {isCarriedForward ? 'On file' : 'Optional'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UploadProgressTracker;
