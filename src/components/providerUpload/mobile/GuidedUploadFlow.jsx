import { useMemo, useState } from 'react';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import SubmitScreen from './SubmitScreen';
import UploadStep from './UploadStep';

/**
 * Returns completion key for a requirement side.
 *
 * @param {string} documentType
 * @param {string} side
 * @returns {string}
 */
const completionKey = (documentType, side) => `${documentType}:${side}`;

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

const normalizeRequirement = (requirement) => {
  if (!IDENTITY_DOCUMENT_REQUIREMENTS.has(requirement.id)) {
    return requirement;
  }

  return {
    ...requirement,
    required: false,
    description: identityDescriptions[requirement.id] || requirement.description,
  };
};

/**
 * Guided mobile upload flow.
 *
 * @param {Object} props
 * @param {Object} props.session
 * @param {Object} props.settings
 * @param {Object[]} props.uploadedDocuments
 * @returns {JSX.Element}
 */
const GuidedUploadFlow = ({ session, settings, uploadedDocuments = [] }) => {
  const steps = useMemo(
    () =>
      (settings.requirements || [])
        .map(normalizeRequirement)
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .flatMap((requirement) =>
          (requirement.sides || ['single']).map((side) => ({
            key: completionKey(requirement.id, side),
            requirement,
            side,
          })),
        ),
    [settings.requirements],
  );
  const initialCompleted = useMemo(() => {
    const completed = {};
    uploadedDocuments.forEach((document) => {
      if (['uploaded', 'submitted', 'approved'].includes(document.status)) {
        completed[completionKey(document.documentType, document.side)] = document;
      }
    });
    return completed;
  }, [uploadedDocuments]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(initialCompleted);
  const isSubmitStep = currentIndex >= steps.length;
  const currentStep = steps[currentIndex];
  const currentComplete = currentStep ? Boolean(completed[currentStep.key]) : false;
  const canGoNext =
    isSubmitStep ||
    !currentStep?.requirement.required ||
    currentComplete;

  const handleMissing = (missing) => {
    const firstMissing = missing
      .map((item) =>
        steps.findIndex((step) => {
          if (item.documentType === 'identity') {
            return IDENTITY_DOCUMENT_REQUIREMENTS.has(step.requirement.id);
          }

          return step.requirement.id === item.documentType && step.side === item.side;
        }),
      )
      .find((index) => index >= 0);

    if (typeof firstMissing === 'number') {
      setCurrentIndex(firstMissing);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden bg-white px-5 pt-6">
      <div className="mb-6 shrink-0">
        <p className="text-sm font-semibold text-blue-600">
          Step {Math.min(currentIndex + 1, steps.length + 1)} of {steps.length + 1}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{
              width: `${((currentIndex + 1) / (steps.length + 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {isSubmitStep ? (
          <SubmitScreen
            sessionId={session.id}
            registrationStep={session.registrationStep}
            onMissing={handleMissing}
          />
        ) : (
          <UploadStep
            step={currentStep}
            providerId={session.providerId}
            sessionId={session.id}
            completed={currentComplete}
            onUploaded={(document) => {
              setCompleted((current) => ({
                ...current,
                [currentStep.key]: document,
              }));
            }}
          />
        )}
      </div>

      {!isSubmitStep && (
        <div className="-mx-5 flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-4 shadow-[0_-12px_24px_rgba(15,23,42,0.08)]">
          <button
            type="button"
            onClick={() => setCurrentIndex((current) => Math.max(current - 1, 0))}
            disabled={currentIndex === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 disabled:opacity-50"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentIndex((current) => Math.min(current + 1, steps.length))
            }
            disabled={!canGoNext}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {currentStep?.requirement.required ? 'Next' : 'Skip / Next'}
            <FiArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default GuidedUploadFlow;
