import { FiCamera, FiUpload, FiVideo } from 'react-icons/fi';

/**
 * Resolves file input attributes from capture hint.
 *
 * @param {Object} requirement
 * @returns {{accept: string, capture: string|undefined, Icon: Function}}
 */
const getCaptureAttributes = (requirement) => {
  if (requirement.captureHint === 'camera') {
    return { accept: 'image/*', capture: 'environment', Icon: FiCamera };
  }
  if (requirement.captureHint === 'video') {
    return { accept: 'video/*', capture: 'user', Icon: FiVideo };
  }
  return {
    accept: (requirement.allowedMimeTypes || []).join(','),
    capture: undefined,
    Icon: FiUpload,
  };
};

/**
 * Hidden file input wrapped in a mobile-friendly action.
 *
 * @param {Object} props
 * @param {Object} props.requirement
 * @param {(file: File|null) => void} props.onFile
 * @param {boolean} [props.disabled]
 * @returns {JSX.Element}
 */
const FileCapture = ({ requirement, onFile, disabled }) => {
  const { accept, capture, Icon } = getCaptureAttributes(requirement);

  return (
    <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">
      <Icon className="h-4 w-4" />
      Select file
      <input
        type="file"
        className="hidden"
        accept={accept}
        capture={capture}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          event.target.value = '';
          onFile(file);
        }}
      />
    </label>
  );
};

export default FileCapture;
