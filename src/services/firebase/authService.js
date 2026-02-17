import { auth, firestore } from './firebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signInWithCredential,
  linkWithCredential,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { doc, runTransaction } from 'firebase/firestore';

import { PhoneAuthProvider, EmailAuthProvider } from 'firebase/auth';

/**
 * Helper: create or update user document in Firestore with profile and roles
 * Ensures roles is an object map, e.g. { customer: true }
 * Handles role-specific fields when adding new roles to existing users
 */
export async function createOrUpdateUserProfile(uid, profileData = {}, role) {
  const userRef = doc(firestore, 'users', uid);
  try {
    await runTransaction(firestore, async (tx) => {
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists()) {
        // Creating new user profile
        const roles = role ? { [role]: true } : {};
        
        // Set approval status based on role
        let approvalStatus = 'approved'; // Default for customers and admins
        if (role === 'client') {
          approvalStatus = 'pending'; // Clients need admin approval
        }
        
        tx.set(userRef, { 
          ...profileData, 
          roles,
          approvalStatus,
          createdAt: new Date().toISOString() 
        });
      } else {
        // Updating existing user profile
        const existingData = userDoc.data();
        const existingRoles = existingData.roles || {};
        const updatedRoles = { ...existingRoles, ...(role ? { [role]: true } : {}) };
        
        // Merge profile data intelligently - don't overwrite existing data unless explicitly provided
        const mergedProfileData = { ...existingData };
        
        // Update fields that are provided in profileData
        Object.keys(profileData).forEach(key => {
          if (profileData[key] !== undefined && profileData[key] !== null && profileData[key] !== '') {
            mergedProfileData[key] = profileData[key];
          }
        });
        
        // Set approval status if adding client role to existing user
        const updateData = {
          ...mergedProfileData,
          roles: updatedRoles, 
          updatedAt: new Date().toISOString()
        };
        
        // If adding client role, set approval status to pending
        if (role === 'client' && !existingRoles.client) {
          updateData.approvalStatus = 'pending';
        }
        
        tx.update(userRef, updateData);
      }
    });
  } catch (err) {
    throw err;
  }
}

/**
 * signUpWithEmailPassword
 * - Creates Firebase Auth user with email/password
 * - Sends email verification
 * - Creates/updates Firestore user profile and roles
 */
/**
 * signUpWithEmailPassword
 * - Handles both new account creation and adding roles to existing accounts
 * - Creates Firebase Auth user with email/password if new
 * - Adds role to existing user if account already exists
 * - Sends email verification for new accounts
 */
export async function signUpWithEmailPassword(email, password, userData = {}, role = 'customer') {
  try {
    // First, try to create a new account
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // New account created successfully
      await sendEmailVerification(user);
      await createOrUpdateUserProfile(user.uid, { email, ...userData }, role);

      return { success: true, user, isNewAccount: true };
      
    } catch (authError) {
      // If account already exists, handle role addition
      if (authError.code === 'auth/email-already-in-use') {
        // Try to sign in to get the existing user
        try {
          const loginResult = await signInWithEmailAndPassword(auth, email, password);
          const existingUser = loginResult.user;
          
          // Add the new role to the existing user
          await createOrUpdateUserProfile(existingUser.uid, { email, ...userData }, role);
          
          // Sign out after adding role so user can login normally later
          await signOut(auth);
          
          return { 
            success: true, 
            user: existingUser, 
            isNewAccount: false,
            roleAdded: true,
            message: `${role === 'client' ? 'Service Provider' : 'Customer'} role has been added to your existing account!`
          };
          
        } catch (loginError) {
          // If login fails, it means email exists but password is wrong
          if (loginError.code === 'auth/wrong-password') {
            return {
              existing: true,
              error: 'An account with this email already exists. Please login with your existing password to add this role, or use the "Forgot Password" option.',
              needsLogin: true
            };
          }
          throw loginError;
        }
      }
      // Re-throw other auth errors
      throw authError;
    }
    
  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle other Firebase Auth errors
    if (error.code === 'auth/weak-password') {
      throw error; // Let SignupScreen handle this
    } else if (error.code === 'auth/invalid-email') {
      throw error; // Let SignupScreen handle this
    }
    
    throw error; // Let the calling function handle other errors
  }
}

/**
 * loginWithEmail
 * - Signs in with email/password
 * - Returns user credential
 */
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  
  // Just return the user - let AuthContext handle navigation
  return user;
}

/**
 * PHONE AUTH NOTES
 * For phone authentication on the web, use RecaptchaVerifier + signInWithPhoneNumber.
 * Add <div id="recaptcha-container"></div> to your page.
 * Once you have an SMS code and verificationId, create a credential with
 * PhoneAuthProvider.credential(verificationId, code) and call signInWithCredential.
 *
 * The rnfbPhoneService.js file provides convenience wrappers (sendPhoneVerificationNative,
 * confirmNativeOtp) that handle RecaptchaVerifier setup automatically.
 */

/**
 * signUpWithPhone
 * - Accepts a verificationId (from native send) and otp code
 * - Signs in/creates the user credential
 * - Creates/updates Firestore user profile and roles
 */
export async function signUpWithPhone(verificationId, otp, userData = {}, role = 'customer') {
  // Phone flow: caller provides verificationId and otp obtained via native send
  const phoneCredential = PhoneAuthProvider.credential(verificationId, otp);

  const userCredential = await signInWithCredential(auth, phoneCredential);
  const user = userCredential.user;

  // create or update profile
  await createOrUpdateUserProfile(user.uid, { phone: user.phoneNumber, ...userData }, role);

  return user;
}

/**
 * loginWithPhone
 * - Signs in with verificationId + otp
 */
export async function loginWithPhone(verificationId, otp) {
  const phoneCredential = PhoneAuthProvider.credential(verificationId, otp);
  const userCredential = await signInWithCredential(auth, phoneCredential);
  const user = userCredential.user;

  // Just return the user - let AuthContext handle navigation
  return user;
}

/**
 * linkEmailToPhoneUser
 * - Links email/password to an existing signed-in user (phone user)
 * - Returns updated user
 */
export async function linkEmailToPhoneUser(user, email, password) {
  if (!user) throw new Error('No user to link');
  const emailCredential = EmailAuthProvider.credential(email, password);
  const linked = await linkWithCredential(user, emailCredential);
  // update profile email in firestore
  await createOrUpdateUserProfile(linked.user.uid, { email }, null);
  return linked.user;
}

/**
 * linkPhoneToEmailUser
 * - Links phone credential to an existing signed-in user (email user)
 * - Caller must provide verificationId and otp obtained via native send
 */
export async function linkPhoneToEmailUser(user, verificationId, otp) {
  if (!user) throw new Error('No user to link');
  const phoneCredential = PhoneAuthProvider.credential(verificationId, otp);
  const linked = await linkWithCredential(user, phoneCredential);
  // update profile phone in firestore
  await createOrUpdateUserProfile(linked.user.uid, { phone: linked.user.phoneNumber }, null);
  return linked.user;
}

/**
 * signOutUser
 * - Signs out the current user
 */
export async function signOutUser() {
  await signOut(auth);
}

/**
 * Utility: observe auth changes (UI can subscribe)
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
