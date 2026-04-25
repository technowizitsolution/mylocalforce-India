/**
 * @typedef {Object} ProviderDocument
 * @property {string} id
 * @property {string} providerId
 * @property {string} uploadSessionId
 * @property {string} documentType
 * @property {'front'|'back'|'single'|'video'|'other'} side
 * @property {string} originalName
 * @property {string} safeFilename
 * @property {string} mimeType
 * @property {number} sizeBytes
 * @property {string} storagePath
 * @property {'desktop'|'mobile'} source
 * @property {'pending'|'in_progress'|'uploaded'|'submitted'
 *   |'approved'|'rejected'|'reupload_required'} status
 * @property {import('firebase/firestore').Timestamp|number} uploadedAt
 * @property {import('firebase/firestore').Timestamp|number} updatedAt
 * @property {string} [reviewedBy]
 * @property {import('firebase/firestore').Timestamp|number} [reviewedAt]
 * @property {'pending_review'|'approved'|'rejected'} [reviewStatus]
 * @property {string} [rejectionReason]
 */

export {};
