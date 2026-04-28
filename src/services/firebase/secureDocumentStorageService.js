import { ref, uploadBytesResumable } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './firebaseConfig';
import { recordDocumentUpload } from './documentUploadService';

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

const normalizeRawMimeType = (mimeType) => {
  const rawType = String(mimeType || '').trim().toLowerCase();
  return MIME_TYPE_ALIASES[rawType] || rawType;
};

/**
 * Returns a conservative file extension.
 *
 * @param {File} file
 * @returns {string}
 */
const getFileExtension = (file) => {
  const match = /\.([A-Za-z0-9]+)$/.exec(file?.name || '');

  if (match) {
    return `.${match[1].toLowerCase()}`;
  }

  return EXTENSION_BY_MIME_TYPE[normalizeRawMimeType(file?.type)] || '';
};

const normalizeFileMimeType = (file, extension) => {
  const aliasedType = normalizeRawMimeType(file?.type);

  if (aliasedType && aliasedType !== 'application/octet-stream') {
    return aliasedType;
  }

  return MIME_TYPE_BY_EXTENSION[extension] || 'application/octet-stream';
};

const toUploadError = (error) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '');

  if (code.includes('storage/unauthorized')) {
    const uploadError = new Error(
      'Secure upload is not allowed for this link. Refresh the desktop page, create a new upload link, and try again.'
    );
    uploadError.code = error.code;
    uploadError.userMessage = uploadError.message;
    uploadError.cause = error;
    return uploadError;
  }

  if (code.includes('storage/retry-limit-exceeded') || code.includes('storage/canceled')) {
    const uploadError = new Error('Upload was interrupted. Check your connection and retry.');
    uploadError.code = error.code;
    uploadError.userMessage = uploadError.message;
    uploadError.cause = error;
    return uploadError;
  }

  if (/storage|firebase/i.test(message)) {
    const uploadError = new Error('Secure upload failed before the file reached review. Please retry.');
    uploadError.code = error?.code;
    uploadError.userMessage = uploadError.message;
    uploadError.cause = error;
    return uploadError;
  }

  return error;
};

/**
 * Builds a secure provider document Storage path.
 *
 * @param {Object} params
 * @param {string} params.providerId
 * @param {string} params.sessionId
 * @param {string} params.documentType
 * @param {string} params.side
 * @param {string} params.safeFilename
 * @returns {string}
 */
export const buildSecureProviderDocumentPath = ({
  providerId,
  sessionId,
  documentType,
  side,
  safeFilename,
}) =>
  `provider-documents/${providerId}/${sessionId}/${documentType}/${side}/${safeFilename}`;

/**
 * Uploads a provider document to the private secure path and records metadata.
 *
 * @param {Object} params
 * @param {File} params.file
 * @param {string} params.providerId
 * @param {string} params.sessionId
 * @param {string} params.documentType
 * @param {'front'|'back'|'single'|'video'} params.side
 * @param {'desktop'|'mobile'} params.source
 * @param {(progress: {percent: number, bytesTransferred: number, totalBytes: number}) => void} [params.onProgress]
 * @returns {Promise<Object>}
 */
export const uploadProviderDocumentSecure = ({
  file,
  providerId,
  sessionId,
  documentType,
  side = 'single',
  source = 'mobile',
  onProgress,
}) => {
  if (!file || !providerId || !sessionId || !documentType) {
    return Promise.reject(
      new Error('File, provider, session, and document type are required.'),
    );
  }

  const extension = getFileExtension(file);
  const contentType = normalizeFileMimeType(file, extension);
  const safeFilename = `${uuidv4()}${extension}`;
  const storagePath = buildSecureProviderDocumentPath({
    providerId,
    sessionId,
    documentType,
    side,
    safeFilename,
  });
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType,
    customMetadata: {
      providerId,
      sessionId,
      documentType,
      side,
      source,
    },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (typeof onProgress === 'function' && snapshot.totalBytes > 0) {
          onProgress({
            percent: Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            ),
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
          });
        }
      },
      (error) => reject(toUploadError(error)),
      async () => {
        try {
          const result = await recordDocumentUpload({
            providerId,
            sessionId,
            documentType,
            side,
            originalName: file.name || safeFilename,
            safeFilename,
            mimeType: contentType,
            sizeBytes: file.size,
            storagePath,
            source,
          });
          resolve(result.document);
        } catch (error) {
          reject(toUploadError(error));
        }
      },
    );
  });
};
