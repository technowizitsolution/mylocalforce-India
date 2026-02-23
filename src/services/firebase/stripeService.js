/**
 * Stripe Service
 * Handles all Stripe-related operations including:
 * - Payment processing
 * - Connected accounts for providers
 * - Payment intents and confirmations
 */

import { collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { firestore, functions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { fetchProviderCommissionRate } from './serviceService';
import { calculatePaymentBreakdown, calculateSettlement, PaymentConfig } from '../../config/paymentConfig';

// Stripe test keys (Replace with your actual keys)
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51R92yQAXJUehG7joQMfEdnpJR4aeOpr5o4j5QDH9IWJN6VikSGq3VbuScuuMPjMnFBJURctybNVi6BvkroaeDXwa00Q67gWp8F';

// Commission rate (10%)
export const COMMISSION_RATE = 0.10;

/**
 * Create a connected Stripe account for a provider
 * This should be called from a Cloud Function for security
 * @param {string} providerId - The provider's user ID
 * @param {object} providerData - Provider information (email, name, etc.)
 * @returns {Promise<string>} - The connected account ID
 */
export const createProviderStripeAccount = async (providerId, providerData) => {
  try {
    // This will call a Cloud Function to create the connected account
    const createConnectedAccount = httpsCallable(functions, 'createConnectedAccount');
    
    const result = await createConnectedAccount({
      providerId,
      email: providerData.email,
      name: providerData.name,
      phone: providerData.phone,
    });

    const stripeAccountId = result.data.accountId;

    // Save the Stripe account ID in Firestore
    await setDoc(doc(firestore, 'providers', providerId), {
      stripeAccountId,
      stripeAccountStatus: 'pending',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return stripeAccountId;
  } catch (error) {
    console.error('Error creating provider Stripe account:', error);
    throw error;
  }
};

/**
 * Get provider's Stripe account ID
 * @param {string} providerId 
 * @returns {Promise<string|null>}
 */
export const getProviderStripeAccount = async (providerId) => {
  try {
    const providerDoc = await getDoc(doc(firestore, 'providers', providerId));
    
    if (providerDoc.exists()) {
      return providerDoc.data().stripeAccountId || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting provider Stripe account:', error);
    return null;
  }
};

/**
 * Create a Stripe Checkout Session (opens Stripe's hosted payment page)
 * DIRECT HTTPS ENDPOINT - No Firebase SDK region issues!
 * @param {object} bookingData - Booking information
 * @returns {Promise<object>} - Checkout session URL and metadata
 */
export const createCheckoutSession = async ({
  bookingId,
  customerId,
  customerEmail,
  providerId,
  serviceName,
  price,
  description,
}) => {
  try {
    console.log('Creating Stripe Checkout session with bookingId:', bookingId);

    // Direct HTTPS endpoint - bypasses Firebase SDK completely!
    const response = await fetch('https://us-central1-mylocalforce-295b8.cloudfunctions.net/createCheckoutSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bookingId,
        customerId,
        customerEmail,
        providerId,
        serviceName,
        price,
        description,
        successUrl: `${window.location.origin}/customer/payment-success?status=success&booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/customer/payment-success?status=cancelled&booking_id=${bookingId}`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Server error:', errorData);
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const result = await response.json();
    console.log('✅ Checkout session created:', result);
    return result;
  } catch (error) {
    console.error('❌ Error creating checkout session:', error);
    throw error;
  }
};

/**
 * Create a payment intent for a booking
 * @param {object} bookingData - Booking information
 * @returns {Promise<object>} - Payment intent client secret and metadata
 */
export const createPaymentIntent = async (bookingData) => {
  try {
    const createPaymentIntentFn = httpsCallable(functions, 'createPaymentIntent');
    
    const result = await createPaymentIntentFn({
      amount: bookingData.amount,
      currency: 'aud', // Australian Dollar
      bookingId: bookingData.bookingId,
      customerId: bookingData.customerId,
      providerId: bookingData.providerId,
      description: bookingData.description,
    });

    return result.data;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

/**
 * Record a transaction in Firestore
 * @param {object} transactionData 
 * @returns {Promise<string>} - Transaction ID
 */
export const recordTransaction = async (transactionData) => {
  try {
    const transactionRef = doc(collection(firestore, 'transactions'));
    // Determine provider-specific commission rate (percentage)
    const commissionRatePercent = await fetchProviderCommissionRate(transactionData.providerId).catch(() => COMMISSION_RATE * 100);
    const amount = Number(transactionData.amount || 0);
    const commission = Math.round(amount * (commissionRatePercent / 100));
    const providerPayout = Math.max(0, amount - commission - (Number(transactionData.stripeFee || 0)));

    const transaction = {
      ...transactionData,
      commission,
      commissionRatePercent,
      providerPayout,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    await setDoc(transactionRef, transaction);
    
    return transactionRef.id;
  } catch (error) {
    console.error('Error recording transaction:', error);
    throw error;
  }
};

/**
 * Get transactions for a provider
 * @param {string} providerId 
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>}
 */
export const getProviderTransactions = async (providerId, status = null) => {
  try {
    let q = query(
      collection(firestore, 'transactions'),
      where('providerId', '==', providerId)
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error('Error getting provider transactions:', error);
    return [];
  }
};

/**
 * Get provider's wallet summary
 * @param {string} providerId 
 * @returns {Promise<object>}
 */
export const getProviderWalletSummary = async (providerId) => {
  try {
    const transactions = await getProviderTransactions(providerId);
    // We'll prefer Stripe-provided post-fee fields when present. Fields that may be
    // available on the transaction documents (from webhook processing):
    // - stripeFee (number, cents)
    // - platformCommissionAfterFees (number, cents)
    // - providerPayoutAfterFees (number, cents)
    // Fallback to existing fields if the above are not present.

    // Fetch provider-specific commission rate (percentage like 10 or 20). Default to COMMISSION_RATE*100 if not set.
    const commissionRatePercent = await fetchProviderCommissionRate(providerId).catch(() => COMMISSION_RATE * 100);

    const summary = {
      totalGross: 0, // total amount paid by customers (gross)
      totalStripeFees: 0,
      totalCommissionAfterFees: 0,
      netPayoutAfterFees: 0,
      pendingPayouts: 0,
      completedPayouts: 0,
      transactionCount: transactions.length,
      commissionRatePercent,
    };

    transactions.forEach(txn => {
      const gross = Number(txn.amount || 0);
      const stripeFee = Number(txn.stripeFee ?? txn.stripe_fee ?? 0);

      // Commission as provided by webhook after Stripe fees, otherwise fall back to stored commission
      const defaultCommission = Math.round(gross * (commissionRatePercent / 100));
      const commissionAfterFees = Number(
        txn.platformCommissionAfterFees ?? txn.platform_commission_after_fees ?? txn.commission ?? defaultCommission
      );

      // Provider payout after fees provided by webhook, otherwise prefer stored providerPayout
      const providerPayoutAfterFees = Number(
        txn.providerPayoutAfterFees ?? txn.provider_payout_after_fees ?? txn.providerPayout ?? Math.max(0, gross - commissionAfterFees - stripeFee)
      );

      summary.totalGross += gross;
      summary.totalStripeFees += stripeFee;
      summary.totalCommissionAfterFees += commissionAfterFees;
      summary.netPayoutAfterFees += providerPayoutAfterFees;

      if (txn.status === 'pending') {
        summary.pendingPayouts += providerPayoutAfterFees;
      } else if (txn.status === 'completed') {
        summary.completedPayouts += providerPayoutAfterFees;
      }
    });

    return summary;
  } catch (error) {
    console.error('Error getting provider wallet summary:', error);
    return null;
  }
};

/**
 * Get all payouts for a provider
 * @param {string} providerId 
 * @returns {Promise<Array>}
 */
export const getProviderPayouts = async (providerId) => {
  try {
    const q = query(
      collection(firestore, 'payouts'),
      where('providerId', '==', providerId)
    );

    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error('Error getting provider payouts:', error);
    return [];
  }
};

/**
 * Get all transactions for admin dashboard
 * @returns {Promise<Array>}
 */
export const getAllTransactions = async () => {
  try {
    const snapshot = await getDocs(collection(firestore, 'transactions'));
    
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error('Error getting all transactions:', error);
    return [];
  }
};

/**
 * Get all payouts for admin dashboard
 * @returns {Promise<Array>}
 */
export const getAllPayouts = async () => {
  try {
    const snapshot = await getDocs(collection(firestore, 'payouts'));
    
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error('Error getting all payouts:', error);
    return [];
  }
};

/**
 * Calculate commission breakdown
 * @param {number} amount - The total amount
 * @returns {object} - Breakdown of amount, commission, and payout
 */
export const calculateCommission = (amount) => {
  const commission = amount * COMMISSION_RATE;
  const providerPayout = amount - commission;
  
  return {
    amount,
    commission,
    providerPayout,
    commissionRate: COMMISSION_RATE * 100, // As percentage
  };
};

/**
 * Get enhanced wallet summary with settlement breakdown
 * @param {string} providerId 
 * @returns {Promise<object>}
 */
export const getEnhancedWalletSummary = async (providerId) => {
  try {
    // Get earnings data (includes settlement breakdown)
    const earningsQuery = query(
      collection(firestore, 'earnings'),
      where('providerId', '==', providerId)
    );
    
    const earningsSnapshot = await getDocs(earningsQuery);
    const earnings = earningsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    const summary = {
      totalGross: 0,
      totalGatewayFees: 0,
      totalPlatformFees: 0,
      totalTaxes: 0,
      totalProviderPayout: 0,
      pendingAmount: 0,
      settledAmount: 0,
      transactionCount: earnings.length,
      transactions: [],
    };
    
    earnings.forEach(earning => {
      const breakdown = earning.settlementBreakdown;
      
      if (breakdown) {
        summary.totalGross += breakdown.grossAmount || 0;
        summary.totalGatewayFees += breakdown.gatewayFee || 0;
        summary.totalPlatformFees += breakdown.platformFeeGross || 0;
        summary.totalTaxes += breakdown.platformFeeTax || 0;
        summary.totalProviderPayout += breakdown.providerPayout || 0;
        
        if (earning.status === 'completed' || earning.status === 'settled') {
          summary.settledAmount += breakdown.providerPayout || 0;
        } else {
          summary.pendingAmount += breakdown.providerPayout || 0;
        }
        
        summary.transactions.push({
          id: earning.id,
          bookingId: earning.bookingId,
          date: earning.createdAt,
          status: earning.status,
          breakdown,
        });
      }
    });
    
    return summary;
  } catch (error) {
    console.error('Error getting enhanced wallet summary:', error);
    return null;
  }
};

/**
 * Get settlement details for a specific transaction
 * @param {string} transactionId 
 * @returns {Promise<object>}
 */
export const getSettlementDetails = async (transactionId) => {
  try {
    const docRef = doc(firestore, 'earnings', transactionId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = docSnap.data();
    
    return {
      id: docSnap.id,
      bookingId: data.bookingId,
      totalAmount: data.totalAmount,
      currency: data.currency,
      status: data.status,
      createdAt: data.createdAt,
      settlementBreakdown: data.settlementBreakdown || null,
    };
  } catch (error) {
    console.error('Error getting settlement details:', error);
    return null;
  }
};

export default {
  createProviderStripeAccount,
  getProviderStripeAccount,
  createPaymentIntent,
  recordTransaction,
  getProviderTransactions,
  getProviderWalletSummary,
  getEnhancedWalletSummary,
  getSettlementDetails,
  getProviderPayouts,
  getAllTransactions,
  getAllPayouts,
  calculateCommission,
  STRIPE_PUBLISHABLE_KEY,
  COMMISSION_RATE,
};
