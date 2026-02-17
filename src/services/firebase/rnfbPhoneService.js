// Helpers that wrap Firebase web SDK phone auth flows using RecaptchaVerifier
// These are convenience wrappers for sending OTP and confirming codes in the browser.
import { auth } from './firebaseConfig';
import { RecaptchaVerifier, signInWithPhoneNumber, signOut } from 'firebase/auth';

// Singleton recaptcha verifier - will be attached to a DOM element
let recaptchaVerifier = null;

/**
 * Get or create a RecaptchaVerifier instance.
 * Requires a DOM element with id="recaptcha-container" in the page.
 * Uses invisible reCAPTCHA by default for seamless UX.
 */
function getRecaptchaVerifier() {
  if (recaptchaVerifier) return recaptchaVerifier;

  const container = document.getElementById('recaptcha-container');
  if (!container) {
    throw new Error('Missing DOM element with id="recaptcha-container". Add <div id="recaptcha-container"></div> to your page.');
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {
      console.log('reCAPTCHA solved');
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired, resetting...');
      recaptchaVerifier = null;
    },
  });

  return recaptchaVerifier;
}

/**
 * Reset the recaptcha verifier (call after errors or when component unmounts)
 */
export function resetRecaptcha() {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (e) {
      // ignore
    }
    recaptchaVerifier = null;
  }
}

/**
 * sendPhoneVerificationNative
 * - Uses Firebase web SDK to send an SMS via RecaptchaVerifier.
 * - Returns a confirmationResult that can be used to confirm OTP: confirmationResult.confirm(code)
 */
export async function sendPhoneVerificationNative(phoneNumber) {
  try {
    // Format and validate phone number
    let formattedPhone = phoneNumber.trim();

    // Remove any non-digit characters except +
    formattedPhone = formattedPhone.replace(/[^\d+]/g, '');

    if (!formattedPhone.startsWith('+')) {
      // Assume Indian numbers and add +91 prefix
      formattedPhone = formattedPhone.replace(/^0+/, '');
      formattedPhone = '+91' + formattedPhone;
    }

    // Validate format (should be +91 followed by 10 digits)
    if (!formattedPhone.match(/^\+91\d{10}$/)) {
      throw new Error('Please enter a valid 10-digit mobile number');
    }

    console.log('Sending OTP to:', formattedPhone);

    const appVerifier = getRecaptchaVerifier();
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);

    console.log('OTP sent successfully');
    return confirmationResult;
  } catch (error) {
    console.error('Phone verification error:', error);
    resetRecaptcha();
    throw new Error(error.message || 'Failed to send OTP');
  }
}

/**
 * confirmNativeOtp
 * - Accepts a confirmationResult (from sendPhoneVerificationNative) and the otp code
 * - Returns the userCredential
 */
export async function confirmNativeOtp(confirmationResult, code) {
  try {
    if (!confirmationResult || typeof confirmationResult.confirm !== 'function') {
      throw new Error('Invalid confirmation object');
    }
    if (!code || code.length < 4) {
      throw new Error('Please enter a valid OTP code');
    }

    console.log('Confirming OTP...');
    const userCredential = await confirmationResult.confirm(code);
    console.log('OTP confirmed successfully');
    return userCredential;
  } catch (error) {
    console.error('OTP confirmation error:', error);
    throw new Error(error.message || 'Invalid OTP code');
  }
}

/**
 * validateOtpForSignup
 * - Validates OTP during signup without creating a permanent auth user
 * - Returns validation result and immediately signs out to prevent duplicate UIDs
 */
export async function validateOtpForSignup(confirmationResult, code) {
  try {
    if (!confirmationResult || typeof confirmationResult.confirm !== 'function') {
      throw new Error('Invalid confirmation object');
    }
    if (!code || code.length < 4) {
      throw new Error('Please enter a valid OTP code');
    }

    console.log('Validating OTP for signup...');
    const userCredential = await confirmationResult.confirm(code);

    // Get the phone number before signing out
    const phoneNumber = userCredential.user.phoneNumber;

    // Immediately sign out to prevent this from becoming the active user
    await signOut(auth);

    console.log('OTP validated successfully for signup, user signed out');

    return {
      success: true,
      phoneNumber: phoneNumber,
      message: 'Phone number verified successfully',
    };
  } catch (error) {
    console.error('OTP validation error:', error);
    throw new Error(error.message || 'Invalid OTP code');
  }
}
