import { FiCheckCircle, FiClock, FiFileText } from 'react-icons/fi';

/**
 * Builds a key from a provider document.
 *
 * @param {Object} document
 * @returns {string}
 */
const documentKey = (document) => `${document.documentType}:${document.side}`;

/**
 * Shows upload progress for the current session.
 *
 * @param {Object} props
 * @param {Object[]} props.requirements
 * @param {Object[]} props.documents
 * @param {Object|null} props.session
 * @returns {JSX.Element|null}
 */
const UploadProgressTracker = ({ requirements = [], documents = [], session }) => {
  if (!requirements.length) {
    return null;
  }

  const uploaded = new Set(
    documents
      .filter((document) => ['uploaded', 'submitted', 'approved'].includes(document.status))
      .map(documentKey)
  );
  const steps = requirements
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap((requirement) =>
      (requirement.sides || ['single']).map((side) => ({
        key: `${requirement.id}:${side}`,
        label:
          (requirement.sides || []).length > 1
            ? `${requirement.label} (${side})`
            : requirement.label,
        required: requirement.required,
      }))
    );
  const completedCount = steps.filter((step) => uploaded.has(step.key)).length;
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
          const done = uploaded.has(step.key);
          return (
            <div
              key={step.key}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                done
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
              {step.required ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-500">
                  Required
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-500">
                  Optional
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
