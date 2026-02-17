/**
 * Profile image local storage service for web.
 * Uses browser localStorage to track profile image URLs
 * and object URLs / data URIs for local caching.
 */

/**
 * uploadProfileImage(uid, imageFile, contentType)
 * - Stores profile image as a data URL in localStorage
 * - imageFile: File or Blob from file input / camera
 * - Returns the data URL string
 */
export async function uploadProfileImage(uid, imageFile, contentType = 'image/jpeg') {
  if (!uid) throw new Error('uid required');
  if (!imageFile) throw new Error('imageFile required');

  try {
    // Convert the file/blob to a data URL for persistent local storage
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    // Store the data URL in localStorage for easy retrieval
    localStorage.setItem(`profile_image_${uid}`, dataUrl);

    return dataUrl;
  } catch (error) {
    console.error('Error saving profile image locally:', error);
    throw new Error('Failed to save profile image');
  }
}

/**
 * getProfileImagePath(uid)
 * - Retrieves the stored data URL for a user's profile image
 * - Returns null if no profile image exists
 */
export async function getProfileImagePath(uid) {
  if (!uid) return null;

  try {
    const dataUrl = localStorage.getItem(`profile_image_${uid}`);
    return dataUrl || null;
  } catch (error) {
    console.error('Error retrieving profile image path:', error);
    return null;
  }
}

/**
 * deleteProfileImage(uid)
 * - Deletes a user's profile image from localStorage
 */
export async function deleteProfileImage(uid) {
  if (!uid) return;

  try {
    localStorage.removeItem(`profile_image_${uid}`);
  } catch (error) {
    console.error('Error deleting profile image:', error);
  }
}
