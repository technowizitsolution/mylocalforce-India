/**
 * Firebase Cloud Messaging (FCM) Notification Service for Web
 * Handles push notifications for booking events using the web Firebase SDK
 */

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { firestore } from './firebaseConfig';
import app from './firebaseConfig';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, orderBy, limit } from 'firebase/firestore';

// Lazily initialize messaging (only works in browsers that support it)
let messagingInstance = null;
async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (!supported) {
    console.warn('Firebase Messaging is not supported in this browser');
    return null;
  }
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Request notification permissions from user (Web Notification API)
 * @returns {Promise<boolean>} - True if permission granted
 */
export async function requestNotificationPermission() {
  try {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';

    if (enabled) {
      console.log('Notification permission granted');
      return true;
    } else {
      console.log('Notification permission denied');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Get FCM token for this browser
 * @returns {Promise<string|null>} - FCM token or null
 */
export async function getFCMToken() {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    // You may need to pass your VAPID key here for web push
    const token = await getToken(messaging, {
      // vapidKey: 'YOUR_VAPID_KEY_HERE', // Get from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
    });
    console.log('FCM Token obtained:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Save FCM token to Firestore for user
 * @param {string} userId - User ID
 * @param {string} token - FCM token
 */
export async function saveFCMToken(userId, token) {
  try {
    if (!userId || !token) {
      console.log('Missing userId or token');
      return;
    }

    const tokenRef = doc(firestore, 'fcmTokens', userId);
    await setDoc(tokenRef, {
      token: token,
      updatedAt: serverTimestamp(),
      platform: 'web',
    }, { merge: true });

    console.log('FCM token saved for user:', userId);
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
}

/**
 * Get FCM token for a specific user
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} - FCM token or null
 */
export async function getUserFCMToken(userId) {
  try {
    const tokenRef = doc(firestore, 'fcmTokens', userId);
    const tokenSnap = await getDoc(tokenRef);
    
    if (tokenSnap.exists()) {
      return tokenSnap.data().token;
    }
    return null;
  } catch (error) {
    console.error('Error getting user FCM token:', error);
    return null;
  }
}

/**
 * Check if a similar notification already exists for deduplication
 * Uses a simple query with just userId and then filters client-side
 * @param {string} userId - User ID
 * @param {string} type - Notification type (e.g., 'LEAD_OFFER', 'NEW_LEAD')
 * @param {string} referenceId - Reference ID (leadId or bookingId)
 * @returns {Promise<{exists: boolean, existingId: string|null}>}
 */
export async function checkDuplicateNotification(userId, type, referenceId) {
  try {
    if (!userId || !type || !referenceId) {
      return { exists: false, existingId: null };
    }

    const notificationsRef = collection(firestore, 'notifications');
    
    // Simple query with just userId - filter client-side to avoid index requirements
    // Note: orderBy removed to avoid permission/index issues - limit(50) is sufficient
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      limit(50) // Check recent notifications only
    );
    
    const snapshot = await getDocs(q);
    
    // Filter client-side for matching type and reference
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.data?.type === type) {
        if (data.data?.leadId === referenceId || data.data?.bookingId === referenceId) {
          console.log('Duplicate notification found:', docSnap.id, 'for type:', type, 'ref:', referenceId);
          return { exists: true, existingId: docSnap.id };
        }
      }
    }
    
    return { exists: false, existingId: null };
  } catch (error) {
    console.error('Error checking duplicate notification:', error);
    return { exists: false, existingId: null }; // Allow creation on error
  }
}

/**
 * Delete old notifications for the same task (keep only the latest)
 * Uses simple query with userId and filters client-side
 * @param {string} userId - User ID
 * @param {string} type - Notification type
 * @param {string} referenceId - Reference ID (leadId or bookingId)
 */
export async function cleanupDuplicateNotifications(userId, type, referenceId) {
  try {
    if (!userId || !type || !referenceId) return;

    const notificationsRef = collection(firestore, 'notifications');
    
    // Simple query with just userId
    const q = query(
      notificationsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    
    // Filter client-side for matching type and reference
    const matchingDocs = snapshot.docs.filter(docSnap => {
      const data = docSnap.data();
      return data.data?.type === type && 
             (data.data?.leadId === referenceId || data.data?.bookingId === referenceId);
    });
    
    if (matchingDocs.length > 1) {
      // Keep the first (newest), delete the rest
      const toDelete = matchingDocs.slice(1);
      console.log('Cleaning up', toDelete.length, 'duplicate notifications');
      
      for (const docToDelete of toDelete) {
        await deleteDoc(doc(firestore, 'notifications', docToDelete.id));
      }
    }
  } catch (error) {
    console.error('Error cleaning up duplicate notifications:', error);
  }
}

/**
 * Save notification to Firestore for user to view in app
 * With deduplication - replaces existing notification for the same task
 * @param {string} userId - User ID
 * @param {object} notificationData - Notification data
 * @param {boolean} allowDuplicate - If false (default), replaces existing similar notification
 */
export async function saveNotificationToFirestore(userId, notificationData, allowDuplicate = false) {
  try {
    const notificationsRef = collection(firestore, 'notifications');
    const type = notificationData.data?.type;
    const referenceId = notificationData.data?.leadId || notificationData.data?.bookingId;
    
    // Check for duplicates if not allowed
    if (!allowDuplicate && type && referenceId) {
      const { exists, existingId } = await checkDuplicateNotification(userId, type, referenceId);
      
      if (exists && existingId) {
        // Update existing notification instead of creating new one
        console.log('Updating existing notification instead of creating duplicate:', existingId);
        const existingRef = doc(firestore, 'notifications', existingId);
        await setDoc(existingRef, {
          userId: userId,
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data || {},
          read: false,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return existingId;
      }
    }
    
    const docRef = await addDoc(notificationsRef, {
      userId: userId,
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {},
      read: false,
      createdAt: serverTimestamp(),
    });
    console.log('Notification saved to Firestore for user:', userId, 'docId:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving notification to Firestore:', error?.message || error);
    throw error;
  }
}

/**
 * Send push notification using FCM REST API (Free Firebase Plan Compatible)
 * This sends actual push notifications WITHOUT Cloud Functions
 * 
 * IMPORTANT: This exposes your Server Key in the client app.
 * For production, ALWAYS use Cloud Functions instead.
 * This is ONLY for testing on free Firebase plan.
 * 
 * @param {string} userId - Target user ID
 * @param {object} notification - Notification content
 */
export async function sendPushNotification(userId, notification, options = { saveToFirestore: true }) {
  try {
    console.log('Preparing notification for user:', userId, 'options:', options);
    
    // Optionally save notification to Firestore for history (in-app notifications)
    if (options && options.saveToFirestore) {
      await saveNotificationToFirestore(userId, notification);
    }
    
    // Get user's FCM token for push notifications
    const fcmToken = await getUserFCMToken(userId);
    
    if (!fcmToken) {
      console.warn('No FCM token found for user:', userId);
      console.log('Notification saved for in-app delivery only');
      return true; // Still return true since in-app notification was saved
    }
    
    console.log('Sending push notification to token:', fcmToken.substring(0, 20) + '...');
    
    // Send push notification using FCM Legacy API
    // Since Firebase Console manual sending works, this should work too with the Server Key
    try {
      // TODO: Replace with your actual FCM Server Key
      // Get it from: Firebase Console → Project Settings → Cloud Messaging → Server key
      // It starts with "AAAA" and is ~150 characters long
      const FCM_SERVER_KEY = 'YOUR_SERVER_KEY_HERE'; // ⚠️ REPLACE THIS
      
      // Check if Server Key is set
      if (FCM_SERVER_KEY === 'YOUR_SERVER_KEY_HERE') {
        console.warn('FCM_SERVER_KEY not set!');
        console.log('Notification already saved for in-app delivery');
        console.log('To enable push notifications:');
        console.log('   1. Get Server Key: https://console.firebase.google.com/project/mylocalforce-295b8/settings/cloudmessaging');
        console.log('   2. Replace FCM_SERVER_KEY in notificationService.js');
        console.log('   3. Server Key starts with "AAAA" and is ~150 characters');
        return true;
      }
      
      // Send via FCM Legacy API
      const fcmEndpoint = 'https://fcm.googleapis.com/fcm/send';
      
      const payload = {
        to: fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
          sound: 'default',
          priority: 'high',
        },
        data: notification.data || {},
        priority: 'high',
        content_available: true,
      };
      
      console.log('Sending with FCM Server Key...');
      
      const response = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${FCM_SERVER_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      
      console.log('FCM Response Status:', response.status);
      
      // Parse response
      const responseData = await response.json();
      
      if (response.status === 200 && responseData.success === 1) {
        console.log('Push notification sent successfully!');
        console.log('Message ID:', responseData.results[0]?.message_id);
        return true;
      } else {
        console.error('FCM send failed:', responseData);
        if (responseData.results && responseData.results[0]?.error) {
          console.error('Error:', responseData.results[0].error);
        }
        
        // Fallback: Save as in-app notification
        await addDoc(collection(firestore, 'notifications'), {
          userId: userId,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          read: false,
          delivered: false,
          error: responseData.results?.[0]?.error || 'Unknown error',
          createdAt: serverTimestamp(),
        });
        
        return false;
      }
    } catch (sendError) {
      console.error('Error sending push notification:', sendError);
      
      // Fallback: Save as in-app notification
      try {
        await addDoc(collection(firestore, 'notifications'), {
          userId: userId,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          read: false,
          delivered: false,
          error: sendError.message,
          createdAt: serverTimestamp(),
        });
      } catch (fallbackError) {
        console.error('Fallback save also failed:', fallbackError);
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return false;
  }
}

/**
 * Check if provider and customer are the same user (multi-role scenario)
 * @param {string} providerId - Provider user ID
 * @param {string} customerId - Customer user ID
 * @returns {boolean} - True if same user
 */
function isSameUser(providerId, customerId) {
  return providerId === customerId;
}

/**
 * Send notification when a new booking is created (to provider)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error('FCM returned non-JSON response:', errorText.substring(0, 200));
        console.error('This usually means the Server Key is invalid or missing');
        console.error('Get your Server Key from: Firebase Console → Project Settings → Cloud Messaging');
        return false;
      }
      
      const responseData = await response.json();
      
      if (responseData.success === 1) {
        console.log('Push notification sent successfully!');
        console.log('Message ID:', responseData.results[0]?.message_id);
        return true;
      } else {
        console.error('FCM send failed:', responseData);
        if (responseData.results && responseData.results[0]?.error) {
          console.error('Error details:', responseData.results[0].error);
        }
        return false;
      }
    } catch (sendError) {
      console.error('Error sending push notification:', sendError);
      return false;
    }
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return false;
  }
}

/**
 * Send notification when a new booking is created (to provider)
 * @param {string} providerId - Provider user ID
 * @param {object} bookingData - Booking details
 */
export async function notifyProviderNewBooking(providerId, bookingData) {
  // Skip notification if provider is booking their own service (multi-role user)
  if (bookingData.customerId && isSameUser(providerId, bookingData.customerId)) {
    console.log('Skipping notification: User booked their own service (multi-role)');
    return false;
  }

  const notification = {
    title: 'New Booking Request!',
    body: `${bookingData.customerName} has booked ${bookingData.serviceName}`,
    data: {
      type: 'NEW_BOOKING',
      bookingId: bookingData.bookingId,
      screen: 'ClientBookings',
      role: 'provider', // Specify which role should handle this
      priority: 'high'
    }
  };

  return await sendPushNotification(providerId, notification);
}

/**
 * Send notification when booking is accepted (to customer)
 * @param {string} customerId - Customer user ID
 * @param {object} bookingData - Booking details
 */
export async function notifyCustomerBookingAccepted(customerId, bookingData) {
  // Skip notification if customer is the provider (multi-role user accepting their own booking)
  if (bookingData.providerId && isSameUser(customerId, bookingData.providerId)) {
    console.log('Skipping notification: User accepted their own booking (multi-role)');
    return false;
  }

  const notification = {
    title: 'Booking Accepted!',
    body: `Your booking for ${bookingData.serviceName} has been accepted by ${bookingData.providerName}`,
    data: {
      type: 'BOOKING_ACCEPTED',
      bookingId: bookingData.bookingId,
      screen: 'Bookings',
      role: 'customer', // Specify which role should handle this
      priority: 'high'
    }
  };

  return await sendPushNotification(customerId, notification);
}

/**
 * Send notification when booking is completed (to customer)
 * @param {string} customerId - Customer user ID
 * @param {object} bookingData - Booking details
 */
export async function notifyCustomerBookingCompleted(customerId, bookingData) {
  // Skip notification if customer is the provider (multi-role user)
  if (bookingData.providerId && isSameUser(customerId, bookingData.providerId)) {
    console.log('Skipping notification: User completed their own booking (multi-role)');
    return false;
  }

  const notification = {
    title: 'Service Completed!',
    body: `Your ${bookingData.serviceName} service has been completed. Please rate your experience!`,
    data: {
      type: 'BOOKING_COMPLETED',
      bookingId: bookingData.bookingId,
      screen: 'Bookings',
      role: 'customer', // Specify which role should handle this
      priority: 'normal'
    }
  };

  return await sendPushNotification(customerId, notification);
}

/**
 * Send notification when booking is cancelled (to customer)
 * @param {string} customerId - Customer user ID
 * @param {object} bookingData - Booking details
 */
export async function notifyCustomerBookingCancelled(customerId, bookingData) {
  // Skip notification if customer is the provider (multi-role user)
  if (bookingData.providerId && isSameUser(customerId, bookingData.providerId)) {
    console.log('Skipping notification: User cancelled their own booking (multi-role)');
    return false;
  }

  const notification = {
    title: 'Booking Cancelled',
    body: `Your booking for ${bookingData.serviceName} has been cancelled`,
    data: {
      type: 'BOOKING_CANCELLED',
      bookingId: bookingData.bookingId,
      screen: 'Bookings',
      role: 'customer', // Specify which role should handle this
      priority: 'normal'
    }
  };

  return await sendPushNotification(customerId, notification);
}

/**
 * Initialize notification listeners for web
 * Call this in App.jsx when app starts
 * @param {function} onNotificationReceived - Callback when foreground notification arrives
 */
export function setupNotificationListeners(onNotificationReceived) {
  let unsubscribe = () => {};

  // Set up foreground message listener asynchronously
  getMessagingInstance().then(messaging => {
    if (!messaging) return;

    unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground notification received:', payload);

      // Show browser notification
      if (Notification.permission === 'granted' && payload.notification) {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/favicon.ico',
        });
      }

      // Call callback if provided
      if (onNotificationReceived) {
        onNotificationReceived(payload);
      }
    });
  });

  // Return cleanup function
  return () => {
    unsubscribe();
  };
}

/**
 * Set up notification badge (optional)
 * @param {number} count - Badge count
 */
export async function setBadgeCount(count) {
  try {
    // Web Badge API (experimental, supported in some browsers)
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    }
    console.log('Badge count set to:', count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
}

/**
 * Delete a notification (manual deletion)
 * @param {string} notificationId - Notification ID to delete
 * @param {string} userId - User ID for verification
 * @returns {Promise<boolean>} - True if deleted successfully
 */
export async function deleteNotification(notificationId, userId) {
  try {
    console.log('Deleting notification:', notificationId);

    const CLOUD_FUNCTION_URL = 'https://us-central1-mylocalforce-295b8.cloudfunctions.net/deleteNotification';

    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notificationId,
        userId,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('Notification deleted successfully');
      return true;
    } else {
      console.error('Failed to delete notification:', data.error);
      return false;
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
}

export default {
  requestNotificationPermission,
  getFCMToken,
  saveFCMToken,
  getUserFCMToken,
  sendPushNotification,
  notifyProviderNewBooking,
  notifyCustomerBookingAccepted,
  notifyCustomerBookingCompleted,
  notifyCustomerBookingCancelled,
  setupNotificationListeners,
  setBadgeCount,
  deleteNotification
};
