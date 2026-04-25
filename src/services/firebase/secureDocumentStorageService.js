import { ref, uploadBytesResumable } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './firebaseConfig';
import { recordDocumentUpload } from './documentUploadService';

/**
 * Returns a conservative file extension.
 *
 * @param {File} file
 * @returns {string}
 */
const getFileExtension = (file) => {
  const match = /\.([A-Za-z0-9]+)$/.exec(file?.name || '');
  return match ? `.${match[1].toLowerCase()}` : '';
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
    contentType: file.type || 'application/octet-stream',
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
      reject,
      async () => {
        try {
          const result = await recordDocumentUpload({
            providerId,
            sessionId,
            documentType,
            side,
            originalName: file.name || safeFilename,
            safeFilename,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            storagePath,
            source,
          });
          resolve(result.document);
        } catch (error) {
          reject(error);
        }
      },
    );
  });
};
