import { firestore, storage, functions as functionsClient } from './firebaseConfig';
import { 
  collection, doc, getDoc, setDoc, updateDoc, getDocs,
  query, where, serverTimestamp, deleteField
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

// Toggle to skip attempting to disable services from the client (useful while developing)
// Set to true to skip calling the server callable and avoid permission errors.
export const SKIP_DISABLE_PROVIDER_SERVICES = true;

// Helper: parse visa expiry in various shapes to a JS Date or null
const parseVisaExpiryToDate = (visaExpiry) => {
  if (!visaExpiry) return null;
  try {
    if (visaExpiry instanceof Date) return visaExpiry;
    if (visaExpiry.seconds && typeof visaExpiry.toDate === 'function') return visaExpiry.toDate();
    if (typeof visaExpiry === 'string') {
      const d = new Date(visaExpiry);
      if (!isNaN(d)) return d;
    }
    if (visaExpiry.day || visaExpiry.month || visaExpiry.year) {
      const day = parseInt(visaExpiry.day || 1, 10);
      const month = parseInt(visaExpiry.month || 1, 10) - 1;
      const year = parseInt(visaExpiry.year || new Date().getFullYear(), 10);
      const d = new Date(year, month, day);
      if (!isNaN(d)) return d;
    }
  } catch (e) {
    // ignore
  }
  return null;
};

/**
 * Upload provider document to Firebase Storage
 * @param {string} userId - User ID
 * @param {object} file - File object from DocumentPicker
 * @param {string} docType - Document type (id_proof, resume, certificates, verification_video)
 * @param {function} onProgress - Progress callback
 * @returns {Promise<string>} Download URL
 */
export const uploadProviderDocument = async (userId, file, docType, onProgress) => {
  try {
    console.log('Upload document - userId:', userId, 'docType:', docType);
    console.log('Upload document - file:', file);
    
    if (!userId || !file) {
      throw new Error('User ID and file are required');
    }

    // Create unique filename with timestamp
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${docType}_${timestamp}.${extension}`;
    
    // Create storage reference: provider_documents/{userId}/{docType}_{timestamp}.{ext}
    const storagePath = `provider_documents/${userId}/${filename}`;
    console.log('Storage path:', storagePath);
    
    const storageRef = ref(storage, storagePath);

    // Upload file as blob
    const blob = file instanceof Blob ? file : await (await fetch(file.uri || file)).blob();
    
    console.log('Uploading document...');
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: file.type || 'application/octet-stream',
    });

    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (typeof onProgress === 'function' && snapshot.totalBytes > 0) {
            const percent = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            );
            onProgress(percent);
          }
        },
        reject,
        resolve,
      );
    });

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    console.log(`Document uploaded successfully: ${docType}`, downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading provider document:', error);
    throw error;
  }
};

/**
 * Save provider details to Firestore subcollection
 * @param {string} userId - User ID
 * @param {object} providerDetails - Provider details object
 * @returns {Promise<void>}
 */
export const saveProviderDetails = async (userId, providerDetails) => {
  try {
    console.log('saveProviderDetails - Starting save for userId:', userId);
    console.log('saveProviderDetails - Provider details:', JSON.stringify(providerDetails, null, 2));
    
    if (!userId || !providerDetails) {
      throw new Error('User ID and provider details are required');
    }

    // Save to users/{userId}/details subcollection in mylocalforce database
    const detailsRef = doc(firestore, 'users', userId, 'details', 'provider_onboarding');

    console.log('saveProviderDetails - Firestore path:', `users/${userId}/details/provider_onboarding`);

    const dataToSave = {
      ...providerDetails,
      updatedAt: serverTimestamp(),
    };

    console.log('saveProviderDetails - Attempting to save...');
    await setDoc(detailsRef, dataToSave);

    // Also ensure the user document contains onboarding flags.
    // Use set with merge to create the field even if the top-level user doc is missing.
    const userRef = doc(firestore, 'users', userId);
    const topLevelUpdates = {
      onboardingDocuments: true,
      onboardingSubmittedAt: serverTimestamp(),
    };

    // If provider supplied visa details in the saved payload, mark account as pending approval
    try {
      const visaExpiry = providerDetails?.profile?.visaExpiry || providerDetails?.visaExpiry || null;
      const visaDate = parseVisaExpiryToDate(visaExpiry);
      if (visaDate) {
        topLevelUpdates.visaExpiryTimestamp = visaDate;
        topLevelUpdates.visaStatus = 'blocked';
        // Use provider-scoped disabled flag so customer access isn't blocked
        topLevelUpdates.providerAccountDisabled = true;
        // Mark account as pending review so the app shows the under-review screen
        topLevelUpdates.approvalStatus = 'pending';
        topLevelUpdates.status = 'pending';
        topLevelUpdates.visaRemindersSentCount = 0;
        topLevelUpdates.visaReminderLastSentAt = null;
      }
    } catch (e) {
      // ignore parse errors
    }

    await setDoc(userRef, topLevelUpdates, { merge: true });

    // If the account was marked disabled due to visa update, disable or remove provider from services
    try {
      if (topLevelUpdates.accountDisabled === true) {
        console.log('saveProviderDetails: requesting service disable for userId:', userId);
        if (SKIP_DISABLE_PROVIDER_SERVICES) {
          console.warn('SKIP_DISABLE_PROVIDER_SERVICES is true - skipping disableProviderServices call');
        } else {
          try {
            await disableProviderServices(userId);
          } catch (err) {
            const msg = err && err.message ? err.message : String(err);
            console.error('disableProviderServices failed during saveProviderDetails:', msg);
            if (msg.includes('providerId is required') || msg.includes('Cloud Functions client not initialized') || msg.includes('disableProviderServices failed')) {
              console.warn('Skipping service disable due to callable configuration issue. Deploy functions or set SKIP_DISABLE_PROVIDER_SERVICES=true to suppress this message.');
            } else {
              console.error('Unexpected error disabling provider services:', err);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to disable provider services after saving details (outer):', e);
    }

    console.log('saveProviderDetails - top-level user doc updated with onboardingDocuments=true');

    console.log('✅ Provider details saved successfully for user:', userId);
  } catch (error) {
    console.error('❌ Error saving provider details:', error);
    console.error('Error details:', error.code, error.message);
    throw error;
  }
};

/**
 * Saves a non-submitted provider onboarding draft before secure upload starts.
 *
 * @param {string} userId - User ID
 * @param {object} providerDetails - Draft provider details
 * @returns {Promise<void>}
 */
export const saveProviderOnboardingDraft = async (userId, providerDetails) => {
  if (!userId || !providerDetails) {
    throw new Error('User ID and provider details are required');
  }

  const detailsRef = doc(
    firestore,
    'users',
    userId,
    'details',
    'provider_onboarding',
  );

  await setDoc(
    detailsRef,
    {
      ...providerDetails,
      status:
        providerDetails.status && providerDetails.status !== 'under_review'
          ? providerDetails.status
          : 'draft',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

/**
 * Saves provider onboarding details after secure document upload.
 *
 * @param {string} userId - User ID
 * @param {object} providerDetails - Provider details object
 * @param {{ sessionId: string, documentsMetadata?: Object.<string, *> }} uploadSummary
 * @returns {Promise<void>}
 */
export const saveProviderDetailsWithSecureDocuments = async (
  userId,
  providerDetails,
  uploadSummary,
) => {
  if (!userId || !providerDetails || !uploadSummary?.sessionId) {
    throw new Error('User ID, provider details, and upload session are required');
  }

  const sessionRef = doc(
    firestore,
    'providerUploadSessions',
    uploadSummary.sessionId,
  );
  let sessionSnap = await getDoc(sessionRef);

  if (!sessionSnap.exists()) {
    throw new Error('Secure document upload session was not found.');
  }

  let sessionData = sessionSnap.data() || {};
  let documentsMetadata =
    uploadSummary.documentsMetadata || sessionData.documentsMetadata || {};

  if (sessionData.status !== 'submitted') {
    const submitFn = httpsCallable(functionsClient, 'submitMobileDocuments');
    const submitResult = await submitFn({ sessionId: uploadSummary.sessionId });
    const submitData = submitResult.data || {};

    if (submitData.success === false) {
      const missingLabels = (submitData.missing || [])
        .map((item) => item.label)
        .join(', ');
      throw new Error(
        missingLabels
          ? `Please upload missing secure documents: ${missingLabels}.`
          : 'Please finish secure document upload before submitting.',
      );
    }

    documentsMetadata = submitData.documentsMetadata || documentsMetadata;
    sessionSnap = await getDoc(sessionRef);
    sessionData = sessionSnap.data() || {};
  }

  if (sessionData.status !== 'submitted') {
    throw new Error('Secure document upload session is not submitted yet.');
  }

  const detailsRef = doc(
    firestore,
    'users',
    userId,
    'details',
    'provider_onboarding',
  );

  await setDoc(
    detailsRef,
    {
      ...providerDetails,
      documents: providerDetails.documents || {},
      documentUploadMode: 'secure_v2',
      latestDocumentUploadSessionId: uploadSummary.sessionId,
      documentsMetadata,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const userRef = doc(firestore, 'users', userId);
  const topLevelUpdates = {
    onboardingDocuments: true,
    onboardingSubmittedAt: serverTimestamp(),
    approvalStatus: 'pending',
    status: 'pending',
    documentUploadMode: 'secure_v2',
    latestDocumentUploadSessionId: uploadSummary.sessionId,
  };

  try {
    const visaExpiry =
      providerDetails?.profile?.visaExpiry || providerDetails?.visaExpiry || null;
    const visaDate = parseVisaExpiryToDate(visaExpiry);
    if (visaDate) {
      topLevelUpdates.visaExpiryTimestamp = visaDate;
      topLevelUpdates.visaStatus = 'blocked';
      topLevelUpdates.providerAccountDisabled = true;
      topLevelUpdates.visaRemindersSentCount = 0;
      topLevelUpdates.visaReminderLastSentAt = null;
    }
  } catch (error) {
    console.warn('Could not normalize visa expiry during secure save:', error);
  }

  await setDoc(userRef, topLevelUpdates, { merge: true });
};

/**
 * Fetch provider details from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Provider details or null
 */
export const fetchProviderDetails = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('fetchProviderDetails - userId:', userId);
    console.log('fetchProviderDetails - Firestore path:', `users/${userId}/details/provider_onboarding`);

    const detailsRef = doc(firestore, 'users', userId, 'details', 'provider_onboarding');

    const detailsSnap = await getDoc(detailsRef);

    console.log('fetchProviderDetails - Document exists:', detailsSnap.exists());
    
    if (detailsSnap.exists()) {
      const data = detailsSnap.data();
      console.log('fetchProviderDetails - Document data:', JSON.stringify(data, null, 2));
      return { id: detailsSnap.id, ...data };
    }

    console.log('fetchProviderDetails - No document found, returning null');
    return null;
  } catch (error) {
    console.error('❌ Error fetching provider details:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    throw error;
  }
};

/**
 * Update provider details
 * @param {string} userId - User ID
 * @param {object} updates - Updates object
 * @returns {Promise<void>}
 */
export const updateProviderDetails = async (userId, updates) => {
  try {
    if (!userId || !updates) {
      throw new Error('User ID and updates are required');
    }

    const detailsRef = doc(firestore, 'users', userId, 'details', 'provider_onboarding');

    // Use set with merge so the details doc is created if it doesn't exist
    await setDoc(detailsRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Also ensure user document has onboarding flags. Use set with merge to avoid
    // firestore/not-found errors if the user document doesn't exist for some reason.
    const userRef = doc(firestore, 'users', userId);
    const topLevelUpdates = {
      onboardingDocuments: true,
      onboardingSubmittedAt: serverTimestamp(),
    };

    // If updates include a new visa expiry or visa-related documents, mark account pending
    try {
      const visaExpiry = updates?.profile?.visaExpiry || updates?.visaExpiry || null;
      const visaDate = parseVisaExpiryToDate(visaExpiry);
      if (visaDate) {
        topLevelUpdates.visaExpiryTimestamp = visaDate;
        topLevelUpdates.visaStatus = 'blocked';
        topLevelUpdates.accountDisabled = true;
        // Mark account as pending review so the app shows the under-review screen
        topLevelUpdates.approvalStatus = 'pending';
        topLevelUpdates.status = 'pending';
        topLevelUpdates.visaRemindersSentCount = 0;
        topLevelUpdates.visaReminderLastSentAt = null;
      }

      // If documents are updated (e.g., idProofUrl), also set to pending admin approval
      if (updates.documents && Object.keys(updates.documents).length > 0) {
        topLevelUpdates.visaStatus = 'blocked';
        topLevelUpdates.providerAccountDisabled = true;
        topLevelUpdates.approvalStatus = 'pending';
        topLevelUpdates.status = 'pending';
        // Do not overwrite visaExpiryTimestamp here unless explicitly provided
      }
    } catch (e) {
      // ignore
    }

    await setDoc(userRef, topLevelUpdates, { merge: true });

    // If the account was marked disabled due to visa update or new documents, disable or remove provider from services
    try {
      if (topLevelUpdates.accountDisabled === true) {
        console.log('updateProviderDetails: requesting service disable for userId:', userId);
        if (SKIP_DISABLE_PROVIDER_SERVICES) {
          console.warn('SKIP_DISABLE_PROVIDER_SERVICES is true - skipping disableProviderServices call');
        } else {
          try {
            await disableProviderServices(userId);
          } catch (err) {
            const msg = err && err.message ? err.message : String(err);
            console.error('disableProviderServices failed during updateProviderDetails:', msg);
            if (msg.includes('providerId is required') || msg.includes('Cloud Functions client not initialized') || msg.includes('disableProviderServices failed')) {
              console.warn('Skipping service disable due to callable configuration issue. Deploy functions or set SKIP_DISABLE_PROVIDER_SERVICES=true to suppress this message.');
            } else {
              console.error('Unexpected error disabling provider services:', err);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to disable provider services after updating details (outer):', e);
    }

    console.log('Provider details updated successfully for user:', userId);
  } catch (error) {
    console.error('Error updating provider details:', error);
    throw error;
  }
};

// Disable provider's services: mark owner services inactive and remove provider from assigned services
const disableProviderServices = async (userId) => {
  if (!userId) return;
  console.log('Disabling services for provider due to VISA pause (client request):', userId);

  // Prefer to call the server-side callable function which has admin privileges
  try {
    if (!userId) {
      throw new Error('disableProviderServices called without userId');
    }

    if (functionsClient) {
      console.log('disableProviderServices: invoking callable with providerId:', userId);
      const disableFn = httpsCallable(functionsClient, 'disableProviderServices');
      const payload = { providerId: String(userId) };
      const resp = await disableFn(payload);
      console.log('disableProviderServices: callable result', resp && resp.data);
      return;
    }
    // If functions client isn't initialized, throw so caller can handle gracefully
    throw new Error('Cloud Functions client not initialized');
  } catch (err) {
    console.error('disableProviderServices: callable failed', err?.message || err);
    // Surface clearer error for caller
    const message = err?.message || 'disableProviderServices callable failed';
    throw new Error(`disableProviderServices failed: ${message}`);
  }
};

// Re-enable provider services when admin approves VISA: restore owner services and re-add provider to assigned services
const enableProviderServices = async (userId) => {
  try {
    if (!userId) return;
    console.log('Re-enabling services for provider after VISA approval:', userId);

    // Owner services: find those flagged disabledByVisa and set back to active
    const servicesCol = collection(firestore, 'services');
    const ownerQuery = query(servicesCol, where('ownerId', '==', userId));
    const ownerSnap = await getDocs(ownerQuery);
    ownerSnap.forEach(docSnap => {
      const data = docSnap.data();
      const docRef = docSnap.ref;
      if (data && data.disabledByVisa) {
        setDoc(docRef, { status: 'active', disabledByVisa: deleteField() }, { merge: true }).catch(err => console.error('Failed to re-enable owner service', docRef.path, err));
      }
    });

    // Assigned services: re-add provider from removedProvidersByVisa
    const removedQuery = query(servicesCol, where('removedProvidersByVisa', 'array-contains', userId));
    const removedSnap = await getDocs(removedQuery);
    const { arrayUnion, arrayRemove } = await import('firebase/firestore');
    removedSnap.forEach(docSnap => {
      const docRef = docSnap.ref;
      updateDoc(docRef, {
        providers: arrayUnion(userId),
        removedProvidersByVisa: arrayRemove(userId)
      }).catch(err => console.error('Failed to restore provider to assigned service', docRef.path, err));
    });

    console.log('Service re-enable completed for provider:', userId);
  } catch (error) {
    console.error('Error re-enabling provider services:', error);
  }
};

/**
 * Delete provider document from Storage
 * @param {string} documentUrl - Document URL to delete
 * @returns {Promise<void>}
 */
export const deleteProviderDocument = async (documentUrl) => {
  try {
    if (!documentUrl) {
      console.log('No document URL provided, skipping delete');
      return;
    }

    console.log('Attempting to delete document:', documentUrl);
    // Parse storage path from download URL
    const match = documentUrl.match(/\/o\/(.*?)\?/);
    if (!match || !match[1]) {
      throw new Error('Could not parse storage path from URL');
    }
    const storagePath = decodeURIComponent(match[1]);
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);

    console.log('✅ Document deleted successfully:', documentUrl);
  } catch (error) {
    // If file doesn't exist, just log and continue
    if (error.code === 'storage/object-not-found') {
      console.log('⚠️ Document not found (may have been deleted already):', documentUrl);
    } else {
      console.error('❌ Error deleting provider document:', error);
    }
    // Don't throw error for delete operations - continue with upload
  }
};

/**
 * Update provider onboarding status
 * @param {string} userId - User ID
 * @param {string} status - Status (under_review, approved, rejected)
 * @param {string} rejectionReason - Optional rejection reason
 * @returns {Promise<void>}
 */
export const updateProviderOnboardingStatus = async (userId, status, rejectionReason = null) => {
  try {
    if (!userId || !status) {
      throw new Error('User ID and status are required');
    }

    const detailsRef = doc(firestore, 'users', userId, 'details', 'provider_onboarding');

    const updates = {
      status,
      statusUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (rejectionReason) {
      updates.rejectionReason = rejectionReason;
    }

    // Use set with merge to avoid not-found errors when the onboarding doc is missing
    await setDoc(detailsRef, updates, { merge: true });

    // Also reflect status on top-level user doc so admin approval affects account access
    try {
      const userRef = doc(firestore, 'users', userId);
      if (status === 'approved' || status === 'approved_by_admin' || status === 'approved_admin') {
        await setDoc(userRef, { visaStatus: 'active', providerAccountDisabled: false, onboardingApprovedAt: serverTimestamp() }, { merge: true });
        // Restore services previously disabled/removed by visa pause
        try {
          await enableProviderServices(userId);
        } catch (e) {
          console.error('Failed to re-enable provider services after approval:', e);
        }
      } else if (status === 'rejected') {
        await setDoc(userRef, { visaStatus: 'blocked', providerAccountDisabled: true, onboardingRejectedAt: serverTimestamp(), rejectionReason: rejectionReason || null }, { merge: true });
      } else if (status === 'under_review' || status === 'pending') {
        await setDoc(userRef, { visaStatus: 'blocked', providerAccountDisabled: true }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to update top-level user doc when changing onboarding status:', e);
    }

    console.log(`Provider onboarding status updated to ${status} for user:`, userId);
  } catch (error) {
    console.error('Error updating provider onboarding status:', error);
    throw error;
  }
};
