/**
 * @typedef {Object} UploadSession
 * @property {string} id
 * @property {string} providerId
 * @property {string} tokenHash
 * @property {'sms'|'qr'|'both'} deliveryMethod
 * @property {'active'|'expired'|'submitted'|'revoked'} status
 * @property {string} [mobileNumber]
 * @property {import('firebase/firestore').Timestamp|number} expiresAt
 * @property {import('firebase/firestore').Timestamp|number} createdAt
 * @property {import('firebase/firestore').Timestamp|number} [lastSentAt]
 * @property {number} sendCount
 * @property {import('firebase/firestore').Timestamp|number} [resendCooldownUntil]
 * @property {string} registrationStep
 * @property {Object.<string, string>} [metadata]
 */

/**
 * @typedef {Object} DocumentUploadSettings
 * @property {boolean} smsEnabled
 * @property {boolean} qrEnabled
 * @property {boolean} desktopFallbackEnabled
 * @property {number} sessionExpiryMinutes
 * @property {number} resendCooldownSeconds
 * @property {number} maxResendCount
 * @property {DocumentRequirement[]} requirements
 */

/**
 * @typedef {Object} DocumentRequirement
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {number} order
 * @property {boolean} required
 * @property {Array<'front'|'back'|'single'|'video'>} sides
 * @property {string[]} allowedMimeTypes
 * @property {string[]} allowedExtensions
 * @property {number} maxSizeBytes
 * @property {'camera'|'file'|'video'|'any'} captureHint
 */

/**
 * @typedef {'session_created'|'sms_sent'|'qr_generated'|'upload_started'
 *   |'file_uploaded'|'file_replaced'|'session_submitted'
 *   |'session_revoked'|'admin_approved'|'admin_rejected'
 *   |'reupload_requested'} AuditAction
 */

/**
 * @typedef {Object} AuditLog
 * @property {string} id
 * @property {AuditAction} action
 * @property {string} actorId
 * @property {'provider'|'admin'|'system'} actorType
 * @property {string} [targetId]
 * @property {string} [targetCollection]
 * @property {Object.<string, *>} [metadata]
 * @property {import('firebase/firestore').Timestamp} createdAt
 * @property {string} [ipAddress]
 */

export {};
