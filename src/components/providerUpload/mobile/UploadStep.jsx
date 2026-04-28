import { useState } from 'react';
import { FiCheckCircle, FiRotateCcw } from 'react-icons/fi';
import { uploadProviderDocumentSecure } from '../../../services/firebase/secureDocumentStorageService';
import { notify, getUserFacingError } from '../../../utils/toast';
import FileCapture from './FileCapture';

const IDENTITY_DOCUMENT_REQUIREMENTS = new Set([
  'passport',
  'driving_licence',
  'driving_license',
  'drivingLicence',
]);

const MIME_TYPE_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
};

const MIME_TYPE_BY_EXTENSION = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.webm': 'video/webm',
};

const EXTENSION_BY_MIME_TYPE = Object.entries(MIME_TYPE_BY_EXTENSION).reduce(
  (lookup, [extension, mimeType]) => ({
    ...lookup,
    [mimeType]: extension === '.jpeg' ? '.jpg' : extension,
  }),
  {}
);

const getFileExtension = (file) => {
  const match = /\.([A-Za-z0-9]+)$/.exec(file?.name || '');

  if (match) {
    return `.${match[1].toLowerCase()}`;
  }

  const rawType = String(file?.type || '').trim().toLowerCase();
  return EXTENSION_BY_MIME_TYPE[MIME_TYPE_ALIASES[rawType] || rawType] || '';
};

const normalizeMimeType = (file, extension) => {
  const rawType = String(file?.type || '').trim().toLowerCase();
  const aliasedType = MIME_TYPE_ALIASES[rawType] || rawType;

  if (aliasedType && aliasedType !== 'application/octet-stream') {
    return aliasedType;
  }

  return MIME_TYPE_BY_EXTENSION[extension] || aliasedType;
};

const isAllowedMimeType = (allowedMimeTypes, mimeType) =>
  allowedMimeTypes.some((allowed) => {
    if (allowed.endsWith('/*')) {
      return mimeType.startsWith(allowed.slice(0, -1));
    }

    return mimeType === allowed;
  });

const validateFileForRequirement = (file, requirement) => {
  const extension = getFileExtension(file);
  const mimeType = normalizeMimeType(file, extension);
  const allowedExtensions = (requirement.allowedExtensions || []).map((item) =>
    String(item || '').toLowerCase()
  );
  const allowedMimeTypes = (requirement.allowedMimeTypes || []).map((item) =>
    String(item || '').toLowerCase()
  );

  if (Number(requirement.maxSizeBytes) > 0 && file.size > Number(requirement.maxSizeBytes)) {
    const maxMb = Math.round(Number(requirement.maxSizeBytes) / (1024 * 1024));
    return `File is too large. Maximum size is ${maxMb}MB.`;
  }

  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
    return `File extension is not allowed. Use ${allowedExtensions.join(', ')}.`;
  }

  if (allowedMimeTypes.length > 0 && !isAllowedMimeType(allowedMimeTypes, mimeType)) {
    return 'File type is not allowed for this document.';
  }

  return '';
};

/**
 * Renders a single guided upload step.
 *
 * @param {Object} props
 * @param {Object} props.step
 * @param {string} props.providerId
 * @param {string} props.sessionId
 * @param {boolean} props.completed
 * @param {(document: Object) => void} props.onUploaded
 * @returns {JSX.Element}
 */
const UploadStep = ({ step, providerId, sessionId, completed, onUploaded }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const { requirement, side } = step;
  const isIdentityProof = IDENTITY_DOCUMENT_REQUIREMENTS.has(requirement.id);

  const uploadFile = async (file) => {
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setProgress(0);
    setError('');

    const validationMessage = validateFileForRequirement(file, requirement);
    if (validationMessage) {
      setError(validationMessage);
      notify.error(validationMessage, { id: `mobile-upload-${step.key}` });
      return;
    }

    setUploading(true);

    try {
      const document = await uploadProviderDocumentSecure({
        file,
        providerId,
        sessionId,
        documentType: requirement.id,
        side,
        source: 'mobile',
        onProgress: (uploadProgress) => setProgress(uploadProgress.percent),
      });
      onUploaded(document);
      setProgress(100);
    } catch (uploadError) {
      const message = getUserFacingError(uploadError, 'File upload failed. Please try again.');
      setError(message);
      notify.error(message, { id: `mobile-upload-${step.key}` });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-950">
            {(requirement.sides || []).length > 1
              ? `${requirement.label} (${side})`
              : requirement.label}
          </h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              requirement.required || isIdentityProof
                ? 'bg-red-50 text-red-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isIdentityProof ? 'One required' : requirement.required ? 'Required' : 'Optional'}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {requirement.description}
        </p>
      </div>

      <FileCapture
        requirement={requirement}
        disabled={uploading}
        onFile={uploadFile}
      />

      {(selectedFile || completed) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold text-gray-800">
              {selectedFile?.name || 'Uploaded file'}
            </p>
            {completed && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <FiCheckCircle className="h-3.5 w-3.5" />
                Done
              </span>
            )}
          </div>

          {progress > 0 && progress < 100 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => selectedFile && uploadFile(selectedFile)}
            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-red-700"
          >
            <FiRotateCcw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadStep;
