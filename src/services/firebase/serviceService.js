import { firestore } from './firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  setDoc,
} from 'firebase/firestore';
import { notifyProviderNewBooking } from './notificationService';

function formatOrderDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
}

function resolveServiceCode(bookingData = {}) {
  const source = String(
    bookingData.serviceName || bookingData.subcategory || bookingData.category || 'Service'
  ).trim();

  const words = source
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .map((word) => word.toUpperCase());

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`;
  }

  if (words.length === 1) {
    const word = words[0];
    if (word.length >= 2) return word.slice(0, 2);
    return `${word}X`;
  }

  return 'SV';
}

async function generateUniqueOrderNumber(bookingData = {}) {
  const datePart = formatOrderDate(new Date());
  const serviceCode = resolveServiceCode(bookingData);
  const randomThreeDigits = String(Math.floor(100 + Math.random() * 900));
  return `MLF${datePart}${serviceCode}${randomThreeDigits}`;
}

/**
 * Fetch provider's commission rate from users collection
 */

export async function fetchProviderCommissionRate(providerId) {
  try {
    if (!providerId) return 0; // Default 0% commission if no provider

    const userDoc = await getDoc(doc(firestore, 'users', providerId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const commissionRate = parseFloat(userData.commissionRate) || 0;
      console.log(`Provider ${providerId} commission rate:`, commissionRate);
      return commissionRate;
    }

    console.log(`No commission rate found for provider ${providerId}, using 0%`);
    return 0; // Default 0% if no commission rate set
  } catch (error) {
    console.error('Error fetching provider commission rate:', error);
    return 0; // Default 0% on error
  }
}

/**
 * Calculate provider earnings after commission
 * @param {number} amount - The booking amount
 * @param {number} commissionRate - The commission rate (e.g., 20 for 20%)
 * @returns {object} - { originalAmount, commission, providerEarnings }
 */
function calculateCommissionDeduction(amount, commissionRate) {
  const originalAmount = parseFloat(amount) || 0;
  const commission = (originalAmount * commissionRate) / 100;
  const providerEarnings = originalAmount - commission;

  return {
    originalAmount,
    commission,
    providerEarnings,
    commissionRate,
  };
}

/**
 * Fetch services by category for customer screens
 */
export async function fetchServicesByCategory(category) {
  try {
    const servicesCol = collection(firestore, 'services');
    const q = query(
      servicesCol,
      where('category', '==', category),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);
    // Only return services that have at least one provider or an explicit owner
    return querySnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((s) => (Array.isArray(s.providers) && s.providers.length > 0) || !!s.ownerId);
  } catch (error) {
    console.error('Error fetching services by category:', error);
    throw error;
  }
}

/**
 * Fetch all active services
 */
export async function fetchAllServices() {
  try {
    const servicesCol = collection(firestore, 'services');
    const q = query(servicesCol, where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((s) => (Array.isArray(s.providers) && s.providers.length > 0) || !!s.ownerId);
  } catch (error) {
    console.error('Error fetching all services:', error);
    throw error;
  }
}

/**
 * Create a booking in top-level bookings collection
 */
export async function createBooking(userId, bookingData) {
  try {
    if (!userId) throw new Error('User ID is required');

    const initialStatus = bookingData.status || 'upcoming';

    let bookingRef = null;
    let orderNumber = null;
    let lastError = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      orderNumber = await generateUniqueOrderNumber(bookingData);
      bookingRef = doc(firestore, 'bookings', orderNumber);

      try {
        await setDoc(bookingRef, {
          ...bookingData,
          orderNumber,
          customerId: userId, // Add customer ID for filtering
          status: initialStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        lastError = null;
        break;
      } catch (writeError) {
        lastError = writeError;
        if (attempt === 9) {
          throw writeError;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    console.log('✅ Booking created:', bookingRef.id);

    // Send provider notification only for bookings that are actually ready for the provider.
    // Web checkout creates pending_payment records first, then PaymentSuccess promotes them.
    try {
      const isProviderReadyBooking =
        bookingData.paymentStatus === 'paid' || ['upcoming', 'accepted'].includes(initialStatus);

      if (bookingData.providerId && isProviderReadyBooking) {
        await notifyProviderNewBooking(bookingData.providerId, {
          bookingId: bookingRef.id,
          customerId: userId, // Pass customer ID for multi-role check
          customerName: bookingData.customerName || 'A customer',
          serviceName: bookingData.serviceName || 'a service',
        });
        console.log('📤 Notification sent to provider:', bookingData.providerId);
      }
    } catch (notifError) {
      // Log the full error object so we can see Firestore permission errors or other causes
      console.error('⚠️ Could not send notification (non-critical):', notifError);
      // Don't fail the booking if notification fails
    }

    return bookingRef.id;
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
}

/**
 * Fetch user's bookings from top-level collection
 */
export async function fetchUserBookings(userId) {
  try {
    if (!userId) throw new Error('User ID is required');

    const bookingsCol = collection(firestore, 'bookings');
    const q = query(bookingsCol, where('customerId', '==', userId));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .sort((a, b) => {
        // Sort by createdAt descending (newest first)
        if (a.createdAt && b.createdAt) {
          return b.createdAt.toDate() - a.createdAt.toDate();
        }
        return 0;
      });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for user's bookings
 * Returns an unsubscribe function
 */
export function subscribeToUserBookings(userId, callback) {
  try {
    if (!userId) throw new Error('User ID is required');
    if (!callback) throw new Error('Callback function is required');

    const bookingsCol = collection(firestore, 'bookings');
    const q = query(bookingsCol, where('customerId', '==', userId), orderBy('createdAt', 'desc'));

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const bookings = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        callback(bookings);
      },
      (error) => {
        console.error('Error in real-time booking subscription:', error);
        // Fallback to one-time fetch on error
        fetchUserBookings(userId)
          .then((bookings) => callback(bookings))
          .catch((fallbackError) => {
            console.error('Fallback fetch also failed:', fallbackError);
            callback([]); // Return empty array as last resort
          });
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up booking subscription:', error);
    throw error;
  }
}

/**
 * Get service details by ID
 */
export async function getServiceById(serviceId) {
  try {
    const serviceDoc = doc(firestore, 'services', serviceId);
    const serviceSnap = await getDoc(serviceDoc);

    if (serviceSnap.exists()) {
      return { id: serviceSnap.id, ...serviceSnap.data() };
    } else {
      throw new Error('Service not found');
    }
  } catch (error) {
    console.error('Error fetching service by ID:', error);
    throw error;
  }
}

/**
 * Fetch bookings for service provider (where they are the provider)
 */
export async function fetchProviderBookings(providerId) {
  try {
    if (!providerId) throw new Error('Provider ID is required');

    const bookingsCol = collection(firestore, 'bookings');
    const q = query(bookingsCol, where('providerId', '==', providerId));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .sort((a, b) => {
        // Sort by createdAt descending (newest first)
        if (a.createdAt && b.createdAt) {
          return b.createdAt.toDate() - a.createdAt.toDate();
        }
        return 0;
      });
  } catch (error) {
    console.error('Error fetching provider bookings:', error);
    throw error;
  }
}

/**
 * Fetch services by provider ID
 */
export async function fetchServicesByProvider(providerId) {
  try {
    if (!providerId) throw new Error('Provider ID is required');

    const servicesCol = collection(firestore, 'services');
    // Fetch services where provider is the owner
    const qOwner = query(servicesCol, where('ownerId', '==', providerId));
    const ownerSnap = await getDocs(qOwner);
    const ownerServices = ownerSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Fetch services where provider is assigned in the `providers` array
    const qAssigned = query(servicesCol, where('providers', 'array-contains', providerId));
    const assignedSnap = await getDocs(qAssigned);
    const assignedServices = assignedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Merge unique services (by id)
    const map = {};
    [...ownerServices, ...assignedServices].forEach((s) => {
      map[s.id] = s;
    });
    return Object.keys(map).map((id) => ({ id, ...map[id] }));
  } catch (error) {
    console.error('Error fetching services by provider:', error);
    throw error;
  }
}

/**
 * Calculate provider statistics
 */
export async function calculateProviderStats(providerId) {
  try {
    if (!providerId) throw new Error('Provider ID is required');

    // Fetch provider's commission rate and data
    const [services, bookings, commissionRate] = await Promise.all([
      fetchServicesByProvider(providerId),
      fetchProviderBookings(providerId),
      fetchProviderCommissionRate(providerId),
    ]);

    // Calculate stats
    const totalServices = services.length;
    const activeServices = services.filter((s) => s.status === 'active').length;

    const completedBookings = bookings.filter((b) => b.status === 'completed');
    const upcomingBookings = bookings.filter(
      (b) => b.status === 'upcoming' || b.status === 'accepted'
    );
    const totalBookings = bookings.length;

    // Calculate monthly earnings (current month) - with commission deduction
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyEarnings = completedBookings
      .filter((booking) => {
        if (booking.createdAt) {
          const bookingDate = booking.createdAt.toDate();
          return (
            bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear
          );
        }
        return false;
      })
      .reduce((total, booking) => {
        const amount = parseFloat(booking.price) || 0;
        const { providerEarnings } = calculateCommissionDeduction(amount, commissionRate);
        return total + providerEarnings;
      }, 0);

    // Calculate total earnings - with commission deduction
    const totalEarnings = completedBookings.reduce((total, booking) => {
      const amount = parseFloat(booking.price) || 0;
      const { providerEarnings } = calculateCommissionDeduction(amount, commissionRate);
      return total + providerEarnings;
    }, 0);

    // Get actual average rating from user profile
    let averageRating = 0;
    let ratingCount = 0;
    try {
      const userDoc = await getDoc(doc(firestore, 'users', providerId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        averageRating = parseFloat(userData.avgRating) || 0;
        ratingCount = parseInt(userData.ratingCount) || 0;
      }
    } catch (err) {
      console.error('Error fetching provider rating:', err);
    }

    return {
      totalServices,
      activeServices,
      totalBookings,
      upcomingBookings: upcomingBookings.length,
      completedBookings: completedBookings.length,
      monthlyEarnings,
      totalEarnings,
      averageRating,
      ratingCount,
      commissionRate, // Include commission rate in return for reference
    };
  } catch (error) {
    console.error('Error calculating provider stats:', error);
    throw error;
  }
}

/**
 * Update booking status (for providers to manage their bookings)
 */
export async function updateBookingStatus(bookingId, newStatus, providerId) {
  try {
    if (!bookingId || !newStatus || !providerId) {
      throw new Error('Booking ID, status, and provider ID are required');
    }

    // Validate status transition
    const validStatuses = [
      'pending_payment',
      'upcoming',
      'accepted',
      'arrived',
      'in_progress',
      'rejected',
      'completed',
      'cancelled',
    ];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    // Define valid status transitions
    const validTransitions = {
      pending_payment: ['cancelled'],
      upcoming: ['accepted', 'rejected', 'cancelled'], // Can accept, reject, or cancel
      accepted: ['arrived', 'cancelled'], // Can mark as arrived or cancel after accepting
      arrived: ['in_progress', 'cancelled'], // Can start service (via OTP) or cancel
      in_progress: ['completed', 'cancelled'], // Can complete or cancel while in progress
      completed: [], // Final state
      cancelled: [], // Final state
      rejected: [], // Final state
    };

    const bookingDoc = doc(firestore, 'bookings', bookingId);

    // First check if the booking exists and belongs to this provider
    const bookingSnap = await getDoc(bookingDoc);
    if (!bookingSnap.exists()) {
      throw new Error('Booking not found');
    }

    const bookingData = bookingSnap.data();
    if (bookingData.providerId !== providerId) {
      throw new Error('You can only update your own bookings');
    }

    // Validate the status transition is allowed
    const currentStatus = bookingData.status || 'pending';
    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(`Cannot change status from ${currentStatus} to ${newStatus}`);
    }

    // Prepare update data
    const updateData = {
      status: newStatus,
      updatedAt: serverTimestamp(),
      [`${newStatus}At`]: serverTimestamp(), // Track when each status was set
    };

    // Calculate service duration if completing
    if (newStatus === 'completed' && bookingData.serviceStartedAt) {
      const now = new Date();
      const startTime = bookingData.serviceStartedAt.toDate();
      const durationMinutes = Math.round((now - startTime) / (1000 * 60));
      updateData.actualServiceDuration = durationMinutes;
      updateData.serviceDurationHours = (durationMinutes / 60).toFixed(2);
      console.log(
        `Service duration: ${durationMinutes} minutes (${updateData.serviceDurationHours} hours)`
      );
    }

    // Update the booking status
    await updateDoc(bookingDoc, updateData);

    console.log('✅ Booking status updated:', bookingId, '→', newStatus);

    // Send email notification for accepted/cancelled/rejected/completed status
    if (
      newStatus === 'accepted' ||
      newStatus === 'cancelled' ||
      newStatus === 'rejected' ||
      newStatus === 'completed'
    ) {
      try {
        console.log(`📧 Sending ${newStatus} email notification...`);
        const response = await fetch(
          'https://us-central1-mylocalforce-295b8.cloudfunctions.net/sendBookingStatusEmail',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bookingId: bookingId,
              newStatus: newStatus,
            }),
          }
        );

        if (response.ok) {
          console.log('✅ Email notification sent successfully');
        } else {
          console.log('⚠️ Email notification failed:', await response.text());
        }
      } catch (emailError) {
        console.log('⚠️ Could not send email notification (non-critical):', emailError.message);
        // Don't fail the status update if email fails
      }
    }

    // Send push notifications based on status change
    try {
      const {
        notifyCustomerBookingAccepted,
        notifyCustomerBookingCompleted,
        notifyCustomerBookingCancelled,
      } = require('./notificationService');

      const customerId = bookingData.customerId;
      const notificationData = {
        bookingId: bookingId,
        providerId: providerId, // Pass provider ID for multi-role check
        serviceName: bookingData.serviceName || 'Service',
        providerName: bookingData.providerName || 'Provider',
      };

      // Notify customer based on new status
      if (newStatus === 'accepted' && customerId) {
        await notifyCustomerBookingAccepted(customerId, notificationData);
        console.log('📤 Acceptance notification sent to customer:', customerId);
      } else if (newStatus === 'completed' && customerId) {
        await notifyCustomerBookingCompleted(customerId, notificationData);
        console.log('📤 Completion notification sent to customer:', customerId);
      } else if ((newStatus === 'cancelled' || newStatus === 'rejected') && customerId) {
        await notifyCustomerBookingCancelled(customerId, notificationData);
        console.log('📤 Cancellation/Rejection notification sent to customer:', customerId);
      }
    } catch (notifError) {
      console.log('⚠️ Could not send notification (non-critical):', notifError.message);
      // Don't fail the status update if notification fails
    }

    return { success: true, message: `Booking status updated to ${newStatus}` };
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}

/**
 * Get booking details by ID (for verification before status updates)
 */
export async function getBookingById(bookingId) {
  try {
    if (!bookingId) throw new Error('Booking ID is required');

    const bookingDoc = doc(firestore, 'bookings', bookingId);
    const bookingSnap = await getDoc(bookingDoc);

    if (bookingSnap.exists()) {
      return { id: bookingSnap.id, ...bookingSnap.data() };
    } else {
      throw new Error('Booking not found');
    }
  } catch (error) {
    console.error('Error fetching booking by ID:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for all active services
 * @param {Function} callback - Function to call with updated services array
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToAllServices(callback) {
  try {
    const servicesCol = collection(firestore, 'services');
    const q = query(servicesCol, where('status', '==', 'active'), orderBy('createdAt', 'desc'));

    return onSnapshot(
      q,
      (querySnapshot) => {
        const services = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        callback(services);
      },
      (error) => {
        console.log('Real-time services listener error:', error);
        // Error handling will be done in the component
      }
    );
  } catch (error) {
    console.error('Error setting up services subscription:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for provider's services (all statuses)
 * @param {string} providerId - Provider user ID
 * @param {Function} callback - Function to call with updated services array
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToProviderServices(providerId, callback) {
  try {
    if (!providerId) throw new Error('Provider ID is required');

    const servicesCol = collection(firestore, 'services');
    // We need to listen to both services where the provider is owner
    // and services where the provider is in the `providers` array.
    const qOwner = query(
      servicesCol,
      where('ownerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );
    const qAssigned = query(
      servicesCol,
      where('providers', 'array-contains', providerId),
      orderBy('createdAt', 'desc')
    );

    const servicesMap = {};

    const emit = () => {
      const merged = Object.keys(servicesMap).map((id) => ({ id, ...servicesMap[id] }));
      // Sort by createdAt desc if possible
      merged.sort((a, b) => {
        const aTime = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt) : 0;
        const bTime = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt) : 0;
        return bTime - aTime;
      });
      callback(merged);
    };

    const ownerUnsub = onSnapshot(
      qOwner,
      (querySnapshot) => {
        querySnapshot.docs.forEach((docSnap) => {
          servicesMap[docSnap.id] = docSnap.data();
        });
        emit();
      },
      (error) => console.log('Owner services listener error:', error)
    );

    const assignedUnsub = onSnapshot(
      qAssigned,
      (querySnapshot) => {
        querySnapshot.docs.forEach((docSnap) => {
          servicesMap[docSnap.id] = docSnap.data();
        });
        emit();
      },
      (error) => console.log('Assigned services listener error:', error)
    );

    // Return combined unsubscribe
    return () => {
      try {
        ownerUnsub();
      } catch (e) {}
      try {
        assignedUnsub();
      } catch (e) {}
    };
  } catch (error) {
    console.error('Error setting up provider services subscription:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for provider dashboard stats
 * @param {string} providerId - Provider user ID
 * @param {Function} callback - Function to call with updated stats
 * @returns {Function} - Unsubscribe function
 */
export async function subscribeToProviderDashboard(providerId, callback) {
  try {
    if (!providerId) throw new Error('Provider ID is required');

    // Fetch commission rate FIRST before setting up subscriptions
    const commissionRate = await fetchProviderCommissionRate(providerId);
    console.log('Dashboard commission rate loaded:', commissionRate);

    // Set up listeners for both services and bookings
    const servicesCol = collection(firestore, 'services');
    const bookingsCol = collection(firestore, 'bookings');

    // We need to listen to services where provider is owner or assigned in `providers` array
    const servicesQueryOwner = query(servicesCol, where('ownerId', '==', providerId));
    const servicesQueryAssigned = query(
      servicesCol,
      where('providers', 'array-contains', providerId)
    );

    const bookingsQuery = query(
      bookingsCol,
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );

    let servicesData = [];
    let bookingsData = [];
    let activeListeners = 0;

    // Function to calculate and send stats when both datasets are ready
    const updateStats = () => {
      if (activeListeners === 2) {
        // Calculate stats from real-time data
        const stats = {
          totalServices: servicesData.length,
          activeBookings: bookingsData.filter((b) =>
            ['upcoming', 'accepted', 'arrived', 'in_progress'].includes(b.status)
          ).length,
          monthlyEarnings: bookingsData
            .filter((b) => {
              if (!b.createdAt) return false;
              const bookingDate = b.createdAt.toDate();
              const currentDate = new Date();
              return (
                bookingDate.getMonth() === currentDate.getMonth() &&
                bookingDate.getFullYear() === currentDate.getFullYear() &&
                b.status === 'completed'
              );
            })
            .reduce((sum, b) => {
              const amount = parseFloat(b.price) || 0;
              const { providerEarnings } = calculateCommissionDeduction(amount, commissionRate);
              return sum + providerEarnings;
            }, 0),
          averageRating: 4.5, // TODO: Calculate from reviews
          recentBookings: bookingsData
            .filter((booking) =>
              ['upcoming', 'accepted', 'arrived', 'in_progress'].includes(booking.status)
            )
            .slice(0, 3)
            .map((booking) => {
              const originalAmount = parseFloat(booking.price) || 0;
              const { providerEarnings, commission } = calculateCommissionDeduction(
                originalAmount,
                commissionRate
              );

              return {
                id: booking.id,
                customer: booking.customerName || 'Customer',
                service: booking.serviceName || 'Service',
                date:
                  booking.selectedDate ||
                  booking.requestedDate ||
                  (booking.createdAt
                    ? booking.createdAt.toDate().toISOString().split('T')[0]
                    : 'TBD'),
                time:
                  booking.selectedTime || booking.requestedTime || booking.scheduledTime || 'TBD',
                rawStatus: booking.status,
                status:
                  booking.status === 'completed'
                    ? 'Completed'
                    : booking.status === 'upcoming'
                      ? 'Upcoming'
                      : booking.status === 'accepted'
                        ? 'Accepted'
                        : booking.status,
                amount: providerEarnings, // Show provider's earnings after commission
                originalAmount: originalAmount, // Keep original for reference
                commission: commission, // Commission amount
                selectedDate: booking.selectedDate || booking.requestedDate || null,
                selectedTime:
                  booking.selectedTime || booking.requestedTime || booking.scheduledTime || null,
                scheduledTime:
                  booking.scheduledTime || booking.selectedTime || booking.requestedTime || null,
              };
            }),
          weeklyStats: (() => {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weeklyBookings = bookingsData.filter((booking) => {
              if (!booking.createdAt) return false;
              const bookingDate = booking.createdAt.toDate();
              return bookingDate >= weekAgo && bookingDate <= now;
            });
            const completedThisWeek = weeklyBookings.filter((booking) =>
              ['completed', 'paid'].includes(booking.status)
            );
            const weeklyEarnings = completedThisWeek.reduce((sum, booking) => {
              const amount = parseFloat(booking.price) || 0;
              const { providerEarnings } = calculateCommissionDeduction(amount, commissionRate);
              return sum + providerEarnings;
            }, 0);

            return {
              newBookings: weeklyBookings.length,
              completionRate:
                weeklyBookings.length > 0
                  ? Math.round((completedThisWeek.length / weeklyBookings.length) * 100)
                  : 0,
              weeklyEarnings: Math.round(weeklyEarnings),
            };
          })(),
        };

        callback(stats);
      }
    };

    // Services listeners (owner and assigned) - merge results into servicesData
    const servicesMap = {};
    const emitServices = () => {
      servicesData = Object.keys(servicesMap).map((id) => ({ id, ...servicesMap[id] }));
      activeListeners = Math.max(activeListeners, 1);
      updateStats();
    };

    const ownerUnsub = onSnapshot(
      servicesQueryOwner,
      (querySnapshot) => {
        querySnapshot.docs.forEach((docSnap) => {
          servicesMap[docSnap.id] = docSnap.data();
        });
        emitServices();
      },
      (error) => console.log('Dashboard owner services listener error:', error)
    );

    const assignedUnsub = onSnapshot(
      servicesQueryAssigned,
      (querySnapshot) => {
        querySnapshot.docs.forEach((docSnap) => {
          servicesMap[docSnap.id] = docSnap.data();
        });
        emitServices();
      },
      (error) => console.log('Dashboard assigned services listener error:', error)
    );

    // Bookings listener
    const bookingsUnsubscribe = onSnapshot(
      bookingsQuery,
      (querySnapshot) => {
        bookingsData = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        activeListeners = 2; // Mark bookings as ready
        updateStats();
      },
      (error) => {
        console.log('Real-time dashboard bookings listener error:', error);
      }
    );

    // Return combined unsubscribe function
    return () => {
      try {
        ownerUnsub();
      } catch (e) {}
      try {
        assignedUnsub();
      } catch (e) {}
      try {
        bookingsUnsubscribe();
      } catch (e) {}
    };
  } catch (error) {
    console.error('Error setting up provider dashboard subscription:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for provider bookings
 * @param {string} providerId - Provider user ID
 * @param {Function} callback - Function to call with updated bookings array
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToProviderBookings(providerId, callback) {
  try {
    if (!providerId) throw new Error('Provider ID is required');

    const bookingsCol = collection(firestore, 'bookings');
    const q = query(
      bookingsCol,
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        const bookings = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        callback(bookings);
      },
      (error) => {
        console.log('Real-time provider bookings listener error:', error);
        // Error handling will be done in the component
      }
    );
  } catch (error) {
    console.error('Error setting up provider bookings subscription:', error);
    throw error;
  }
}

// Subscribe to provider earnings data with real-time updates
export async function subscribeToProviderEarnings(providerId, callback) {
  try {
    console.log('Setting up real-time provider earnings subscription for:', providerId);

    // Fetch commission rate FIRST before setting up subscriptions
    const commissionRate = await fetchProviderCommissionRate(providerId);
    console.log('Provider commission rate loaded:', commissionRate);

    // Query earnings collection first (new system)
    const earningsQuery = query(
      collection(firestore, 'earnings'),
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );

    // Also subscribe to bookings for backward compatibility
    const bookingsQuery = query(
      collection(firestore, 'bookings'),
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );

    let earningsData = [];
    let bookingsData = [];

    const processData = () => {
      console.log(
        'Processing earnings data...',
        earningsData.length,
        'earnings records,',
        bookingsData.length,
        'bookings'
      );
      console.log('Using commission rate:', commissionRate);

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      let totalEarnings = 0;
      let receivedEarnings = 0;
      let monthlyEarnings = 0;
      let pendingAmount = 0;
      let completedJobs = 0;

      // ALWAYS use bookings data (has service name, customer name, proper status)
      const earningsTransactions = [];

      bookingsData.forEach((booking) => {
        const amount = parseFloat(booking.price) || 0;
        const bookingDate = booking.createdAt ? booking.createdAt.toDate() : new Date();
        const isCurrentMonth =
          bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;

        // Calculate commission deduction
        const { originalAmount, commission, providerEarnings } = calculateCommissionDeduction(
          amount,
          commissionRate
        );

        // Calculate stats based on actual booking status
        if (booking.status === 'completed') {
          totalEarnings += providerEarnings; // Provider gets amount after commission
          receivedEarnings += providerEarnings;
          completedJobs++;
          if (isCurrentMonth) {
            monthlyEarnings += providerEarnings;
          }
        } else if (booking.status === 'accepted' || booking.status === 'upcoming') {
          pendingAmount += providerEarnings; // Show pending amount after commission
        }

        earningsTransactions.push({
          id: booking.id,
          date: bookingDate.toISOString().split('T')[0],
          description: booking.serviceName || 'Service',
          customer: booking.customerName || 'Customer',
          amount: providerEarnings, // Provider earnings after commission
          originalAmount: originalAmount, // Original booking amount
          commission: commission, // Commission amount deducted
          commissionRate: commissionRate, // Commission rate percentage
          status: booking.status, // Use actual booking status (completed, pending, accepted, rejected, etc.)
          category: getCategoryFromService(booking.serviceName || ''),
          paymentStatus: booking.paymentStatus,
          stripePaymentIntentId: booking.stripePaymentIntentId,
        });
      });

      const stats = {
        monthlyEarnings,
        totalEarnings,
        receivedEarnings,
        pendingAmount,
        completedJobs,
        avgPerJob: completedJobs > 0 ? Math.round(totalEarnings / completedJobs) : 0,
      };

      console.log('Earnings stats calculated:', stats);
      callback({ transactions: earningsTransactions, stats });
    };

    // Subscribe to earnings
    const unsubscribeEarnings = onSnapshot(
      earningsQuery,
      (querySnapshot) => {
        earningsData = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt,
          receivedAt: docSnap.data().receivedAt,
        }));
        processData();
      },
      (error) => {
        console.log('Earnings collection query failed (may not exist yet):', error.message);
        // Continue with bookings only
      }
    );

    // Subscribe to bookings (fallback)
    const unsubscribeBookings = onSnapshot(
      bookingsQuery,
      (querySnapshot) => {
        console.log('Real-time earnings data updated, processing...');

        bookingsData = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt,
        }));

        processData();
      },
      (error) => {
        console.log('Real-time provider bookings listener error:', error);
      }
    );

    // Return combined unsubscribe function
    return () => {
      unsubscribeEarnings();
      unsubscribeBookings();
    };
  } catch (error) {
    console.error('Error setting up provider earnings subscription:', error);
    throw error;
  }
}

// Subscribe to business profile data with real-time updates
export function subscribeToBusinessProfile(providerId, callback) {
  try {
    console.log('Setting up real-time business profile subscription for:', providerId);

    // Query for provider bookings to calculate business stats
    const bookingsQuery = query(
      collection(firestore, 'bookings'),
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );

    // Query for provider user profile
    const userDoc = doc(firestore, 'users', providerId);

    let bookingsData = [];
    let userProfileData = null;
    let activeListeners = 0;

    const updateBusinessProfile = () => {
      if (activeListeners >= 2) {
        console.log('Real-time business profile data updated, processing...');

        // Calculate business statistics
        const completedBookings = bookingsData.filter((booking) => booking.status === 'completed');
        const totalEarnings = completedBookings.reduce(
          (sum, booking) => sum + (parseFloat(booking.price) || 0),
          0
        );
        const averageRating =
          completedBookings.length > 0
            ? (
                completedBookings.reduce((sum, booking) => sum + (booking.rating || 4.9), 0) /
                completedBookings.length
              ).toFixed(1)
            : '4.9';

        // Calculate monthly earnings
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        const monthlyEarnings = completedBookings
          .filter((booking) => {
            const bookingDate = booking.createdAt ? booking.createdAt.toDate() : new Date();
            return (
              bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear
            );
          })
          .reduce((sum, booking) => sum + (parseFloat(booking.price) || 0), 0);

        const businessStats = {
          jobsCompleted: completedBookings.length,
          averageRating: averageRating,
          monthlyEarnings: monthlyEarnings,
          totalEarnings: totalEarnings,
          totalBookings: bookingsData.length,
          pendingBookings: bookingsData.filter(
            (booking) => booking.status === 'accepted' || booking.status === 'upcoming'
          ).length,
        };

        callback({
          userProfile: userProfileData,
          businessStats: businessStats,
          recentBookings: bookingsData.slice(0, 5), // Last 5 bookings for quick reference
        });
      }
    };

    // Bookings listener
    const bookingsUnsubscribe = onSnapshot(
      bookingsQuery,
      (querySnapshot) => {
        bookingsData = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt,
        }));
        activeListeners = Math.max(activeListeners, 1);
        updateBusinessProfile();
      },
      (error) => {
        console.log('Real-time business profile bookings listener error:', error);
      }
    );

    // User profile listener
    const userUnsubscribe = onSnapshot(
      userDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          userProfileData = {
            id: docSnap.id,
            ...docSnap.data(),
          };
        } else {
          userProfileData = null;
        }
        activeListeners = 2; // Mark user profile as ready
        updateBusinessProfile();
      },
      (error) => {
        console.log('Real-time business profile user listener error:', error);
      }
    );

    // Return combined unsubscribe function
    return () => {
      bookingsUnsubscribe();
      userUnsubscribe();
    };
  } catch (error) {
    console.error('Error setting up business profile subscription:', error);
    throw error;
  }
}

// Helper function to categorize services (moved from component)
function getCategoryFromService(serviceName) {
  const name = serviceName.toLowerCase();
  if (name.includes('clean')) return 'Beauty Therapy';
  if (name.includes('salon') || name.includes('hair') || name.includes('beauty')) return 'salon';
  if (
    name.includes('repair') ||
    name.includes('fix') ||
    name.includes('plumb') ||
    name.includes('electric')
  )
    return 'repair';
  return 'other';
}

/**
 * Fetch all categories and attempt to include subcategories (if stored as a subcollection)
 * Returns an array of { id, ...data, subcategories: [] }
 */
export async function fetchCategories() {
  try {
    const categoriesCol = collection(firestore, 'categories');
    const q = query(categoriesCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const categories = [];

    for (const docSnap of snap.docs) {
      const data = { id: docSnap.id, ...docSnap.data() };
      // attempt to read subcollection `subcategories` if it exists
      try {
        // Prefer explicit path segments to be robust across environments
        const subcol = collection(firestore, 'categories', docSnap.id, 'subcategories');
        const subSnap = await getDocs(subcol);
        if (subSnap && subSnap.docs && subSnap.docs.length > 0) {
          data.subcategories = subSnap.docs.map((s) => ({ id: s.id, ...s.data() }));
        } else {
          // ensure there's at least an empty array
          data.subcategories = data.subcategories || [];
        }
      } catch (subErr) {
        // If subcollection doesn't exist or fails (eg. rules), log the error and fall back to inline field
        console.warn(
          `Could not read subcollection for category ${docSnap.id}:`,
          subErr.message || subErr
        );
        data.subcategories = data.subcategories || [];
      }

      categories.push(data);
    }

    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

/**
 * Fetch a single category by id and its subcategories (if present)
 */
export async function fetchCategoryById(categoryId) {
  try {
    if (!categoryId) throw new Error('Category ID is required');
    const docRef = doc(firestore, 'categories', categoryId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = { id: snap.id, ...snap.data() };

    try {
      const subcol = collection(firestore, `categories/${snap.id}/subcategories`);
      const subSnap = await getDocs(subcol);
      if (subSnap && subSnap.docs && subSnap.docs.length > 0) {
        data.subcategories = subSnap.docs.map((s) => ({ id: s.id, ...s.data() }));
      } else {
        data.subcategories = data.subcategories || [];
      }
    } catch (subErr) {
      data.subcategories = data.subcategories || [];
    }

    return data;
  } catch (error) {
    console.error('Error fetching category by id:', error);
    throw error;
  }
}
