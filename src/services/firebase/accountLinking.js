// Account linking utilities for Firebase Auth
// Handles linking phone authentication to existing email accounts

import { 
  linkWithCredential, 
  PhoneAuthProvider,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  signInWithCredential
} from 'firebase/auth';
import { auth, firestore } from './firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Check if an email address is already registered
 * @param {string} email - Email to check
 * @returns {Promise<string[]>} Array of sign-in methods for the email
 */
export async function checkEmailExists(email) {
  try {
    const signInMethods = await fetchSignInMethodsForEmail(auth, email);
    return signInMethods;
  } catch (error) {
    console.error('Error checking email:', error);
    return [];
  }
}

/**
 * Link phone number to existing email account
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {object} phoneCredential - Phone auth credential from OTP verification
 * @returns {Promise<object>} Result with success status and user data
 */
export async function linkPhoneToEmailAccount(email, password, phoneCredential) {
  try {
    // First, sign in with email/password
    const emailCredential = EmailAuthProvider.credential(email, password);
    const userCredential = await signInWithCredential(auth, emailCredential);
    const user = userCredential.user;

    // Link the phone credential to the existing account
    const linkedResult = await linkWithCredential(user, phoneCredential);
    
    console.log('Phone number linked successfully to email account');
    
    // Update the user profile in Firestore with phone number
    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      await updateDoc(userDocRef, {
        phoneNumber: linkedResult.user.phoneNumber,
        linkedProviders: linkedResult.user.providerData.map(p => p.providerId),
        updatedAt: new Date().toISOString()
      });
    }

    return {
      success: true,
      user: linkedResult.user,
      message: 'Phone number successfully linked to your account'
    };
  } catch (error) {
    console.error('Error linking phone to email account:', error);
    
    let errorMessage = 'Failed to link phone number';
    if (error.code === 'auth/wrong-password') {
      errorMessage = 'Invalid password. Please enter the correct password for your email account.';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email address.';
    } else if (error.code === 'auth/credential-already-in-use') {
      errorMessage = 'This phone number is already linked to another account.';
    } else if (error.code === 'auth/provider-already-linked') {
      errorMessage = 'A phone number is already linked to this account.';
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Sign in with phone and check if it should be linked to an existing email account
 * @param {object} phoneCredential - Phone auth credential from OTP verification
 * @param {string} userEmail - Email address from signup (if available)
 * @returns {Promise<object>} Result with success status and linking info
 */
export async function signInWithPhoneAndCheckLinking(phoneCredential, userEmail = null) {
  try {
    // Sign in with phone credential
    const result = await signInWithCredential(auth, phoneCredential);
    const user = result.user;

    // Check if this is a new account (no email linked)
    const hasEmailProvider = user.providerData.some(provider => provider.providerId === 'password');
    
    if (!hasEmailProvider && userEmail) {
      // This is a phone-only account, but we have an email from signup
      // Check if the email exists as a separate account
      const emailMethods = await checkEmailExists(userEmail);
      
      if (emailMethods.length > 0) {
        // Email account exists - we need to prompt for password to link
        return {
          success: true,
          user: user,
          requiresLinking: true,
          emailToLink: userEmail,
          message: 'An account with this email already exists. Please enter your password to link accounts.'
        };
      }
    }

    return {
      success: true,
      user: user,
      requiresLinking: false,
      message: 'Successfully signed in with phone number'
    };
  } catch (error) {
    console.error('Error signing in with phone:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign in with phone number'
    };
  }
}

/**
 * Create phone credential from confirmation and OTP
 * @param {object} confirmation - Phone auth confirmation from signInWithPhoneNumber
 * @param {string} otp - OTP code entered by user
 * @returns {Promise<object>} Phone auth credential
 */
export async function createPhoneCredential(confirmation, otp) {
  try {
    // Confirm the OTP to get the credential
    const result = await confirmation.confirm(otp);
    
    // Extract phone credential for linking
    const phoneCredential = PhoneAuthProvider.credential(
      result.user.phoneNumber,
      otp // This might need adjustment based on RNFB structure
    );
    
    return phoneCredential;
  } catch (error) {
    console.error('Error creating phone credential:', error);
    throw error;
  }
}

/**
 * Check if current user has multiple auth providers linked
 * @param {object} user - Firebase user object
 * @returns {object} Information about linked providers
 */
export function getLinkedProviders(user) {
  if (!user) return { hasEmail: false, hasPhone: false, providers: [] };

  const providers = user.providerData.map(p => p.providerId);
  
  return {
    hasEmail: providers.includes('password'),
    hasPhone: providers.includes('phone'),
    providers: providers,
    isLinked: providers.length > 1
  };
}