import { storage } from './firebaseConfig';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

/**
 * Upload service image to Firebase Storage
 * @param {string} serviceId - Unique service identifier
 * @param {string} imageUri - Local file URI from image picker
 * @param {string} contentType - Image content type
 * @returns {Promise<string>} - Firebase Storage download URL
 */
export async function uploadServiceImage(serviceId, imageUri, contentType = 'image/jpeg') {
  if (!serviceId) throw new Error('serviceId required');
  if (!imageUri) throw new Error('imageUri required');
  
  try {
    // Create a reference to Firebase Storage
    const fileExtension = contentType === 'image/png' ? 'png' : 'jpg';
    const fileName = `service_${serviceId}_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `service_images/${fileName}`);
    
    // Fetch the image as blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Upload to Firebase Storage
    console.log('📤 Uploading service image to Firebase Storage...');
    await uploadBytes(storageRef, blob, {
      contentType: contentType
    });
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Service image uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading service image to Firebase Storage:', error);
    throw new Error('Failed to upload service image');
  }
}

/**
 * Get service image URL from Firestore
 * Note: The image URL is stored in the service document in Firestore
 * @param {string} serviceId - Service identifier
 * @returns {Promise<string|null>} - Firebase Storage URL or null
 */
export async function getServiceImagePath(serviceId) {
  if (!serviceId) return null;
  
  try {
    // The image URL is stored in Firestore service document as 'imageUrl'
    // This function is kept for compatibility but actual URL should be fetched from Firestore
    console.log('ℹ️ Image URL should be retrieved from Firestore service document');
    return null;
  } catch (error) {
    console.error('Error retrieving service image URL:', error);
    return null;
  }
}

/**
 * Delete service image from Firebase Storage
 * @param {string} imageUrl - Firebase Storage URL or path
 */
export async function deleteServiceImage(imageUrl) {
  if (!imageUrl) return;
  
  try {
    // Extract the path from the URL if it's a full URL
    let imagePath = imageUrl;
    
    // If it's a full Firebase Storage URL, extract the path
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
      const urlParts = imageUrl.split('/o/');
      if (urlParts.length > 1) {
        imagePath = decodeURIComponent(urlParts[1].split('?')[0]);
      }
    }
    
    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);
    console.log('✅ Service image deleted from Firebase Storage');
  } catch (error) {
    console.error('Error deleting service image from Firebase Storage:', error);
    // Don't throw error if image doesn't exist
    if (error.code !== 'storage/object-not-found') {
      throw error;
    }
  }
}
