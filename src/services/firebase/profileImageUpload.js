import { auth, storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Upload a profile image using Firebase web SDK storage.
 * @param {string} uid - User UID
 * @param {File|Blob|string} imageInput - File/Blob from file input, or a URL/data URI string
 * @param {object} options - Optional: { previousUrl } to delete old image
 * @returns {Promise<string>} - Download URL
 */
export async function uploadProfileImage(uid, imageInput, options = {}) {
  if (!uid) throw new Error('UID required');
  if (!imageInput) throw new Error('imageInput required');
  const { previousUrl } = options || {};

  // Ensure user is authenticated
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('No authenticated user found. Ensure the user is signed in before uploading images.');
  }

  if (currentUser.uid !== uid) {
    console.warn(
      `uploadProfileImage: requested uid (${uid}) does not match current auth uid (${currentUser.uid}). Upload will still proceed.`,
    );
  }

  try {
    const filename = `profile_images/${uid}_${Date.now()}.jpg`;
    console.log('uploadProfileImage: uploading file to path:', filename);
    const storageRef = ref(storage, filename);

    // Convert input to blob if needed
    let blob;
    if (imageInput instanceof Blob || imageInput instanceof File) {
      blob = imageInput;
    } else if (typeof imageInput === 'string') {
      // Could be a URL or data URI - fetch it as blob
      const response = await fetch(imageInput);
      blob = await response.blob();
    } else {
      throw new Error('imageInput must be a File, Blob, or URL string');
    }

    // Upload blob
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });

    const downloadURL = await getDownloadURL(storageRef);
    console.log('Profile image uploaded:', downloadURL);

    // If a previous URL was provided, attempt to delete it to avoid orphaned files.
    if (previousUrl && previousUrl !== downloadURL) {
      try {
        const match = previousUrl.match(/\/o\/(.*?)\?/);
        if (match && match[1]) {
          const path = decodeURIComponent(match[1]);
          const prevRef = ref(storage, path);
          await deleteObject(prevRef);
          console.log('Previous profile image deleted from storage');
        }
      } catch (delErr) {
        console.warn('Could not delete previous profile image:', delErr.message || delErr);
      }
    }

    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile image:', error);
    if (error && error.code && error.code.includes('storage/unauthorized')) {
      throw new Error('Storage upload unauthorized. Ensure storage rules allow uploads for this user.');
    }
    throw error;
  }
}
