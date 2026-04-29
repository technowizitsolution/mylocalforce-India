// Firebase services barrel export
// Note: Using selective exports to avoid conflicts

// Core Firebase config
export { auth, firestore, storage } from './firebaseConfig';

// Authentication services
export { 
  signOutUser,
  loginWithEmail,
  signUpWithEmailPassword,
  createOrUpdateUserProfile,
  signUpWithPhone,
  loginWithPhone,
  linkEmailToPhoneUser,
  linkPhoneToEmailUser,
  onAuthChange
} from './authService';

// User management services
export { 
  fetchUserProfile, 
  switchActiveRole, 
  fetchUserRoles,
  getActiveRole,
  addRoleToUser,
  findUserByEmail,
  updateApprovalStatus,
  getApprovalStatus,
  getPendingClientApplications,
  normalizeRoles,
  isAccountDeactivated,
  isRoleDeactivated,
  hasAnyRoleDeactivated,
  isSelfDeactivatedAccount,
  isSelfDeactivatedRole,
  deactivateCurrentUserAccount,
  reactivateCurrentUserAccount,
  deleteCurrentUserAccount
} from './userService';

// Phone authentication services
export { 
  sendPhoneVerificationNative,
  confirmNativeOtp,
  validateOtpForSignup,
  resetRecaptcha
} from './rnfbPhoneService';

// Account linking services (includes findUserByPhone, but findUserByEmail moved to userService)
export { 
  findUserByPhone,
  checkAccountConflict,
  handleAccountMerging,
  mergeUserAccounts,
  linkPhoneToEmailDuringSignup,
  cleanupPhoneAuth,
  loginWithPhoneProfile,
  authenticateLinkedAccount
} from './accountMerging';

// Service management services
export {
  fetchServicesByCategory,
  fetchAllServices,
  subscribeToAllServices,
  subscribeToProviderServices,
  subscribeToProviderDashboard,
  subscribeToProviderBookings,
  subscribeToProviderEarnings,
  subscribeToBusinessProfile,
  createBooking,
  fetchUserBookings,
  subscribeToUserBookings,
  getServiceById,
  fetchCategories,
  fetchCategoryById
} from './serviceService';

// Notification services
export {
  requestNotificationPermission,
  isAppPushPermissionEnabled,
  getFCMToken,
  saveFCMToken,
  getUserFCMToken,
  updatePushNotificationPreference,
  sendPushNotification,
  notifyProviderNewBooking,
  notifyCustomerBookingAccepted,
  notifyCustomerBookingCompleted,
  notifyCustomerBookingCancelled,
  setupNotificationListeners,
  setBadgeCount
} from './notificationService';

// Service image upload
export {
  uploadServiceImage,
  getServiceImagePath,
  deleteServiceImage
} from './serviceImageUpload';

// Provider onboarding services
export {
  uploadProviderDocument,
  saveProviderDetails,
  saveProviderOnboardingDraft,
  saveProviderDetailsWithSecureDocuments,
  fetchProviderDetails,
  updateProviderDetails,
  deleteProviderDocument,
  updateProviderOnboardingStatus
} from './providerOnboardingService';

// Secure provider document uploads
export * from './documentUploadService';
export * from './secureDocumentStorageService';

// Other services
export * from './storageService';
export * from './guard';
export * from './clientService';

// Usage notes:
// import { signUpWithEmailPassword, loginWithPhone, fetchUserRoles, checkAuthAndRedirect } from 'src/services/firebase'
// For phone auth flows, the web SDK uses RecaptchaVerifier + signInWithPhoneNumber.
// Add <div id="recaptcha-container"></div> to your page for phone auth to work.
