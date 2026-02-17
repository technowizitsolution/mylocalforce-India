// User account merging utilities
// Handles merging duplicate accounts at the Firestore level

import { auth, firestore } from './firebaseConfig';
import { 
  signInWithEmailAndPassword,
  updateProfile,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  arrayUnion 
} from 'firebase/firestore';
import { findUserByEmail } from './userService';

/**
 * Find user account by phone number in Firestore
 * @param {string} phoneNumber - Phone number to search for
 * @returns {Promise<object|null>} User document if found
 */
export async function findUserByPhone(phoneNumber) {
  try {
    console.log('Searching for user with phone:', phoneNumber);
    const usersRef = collection(firestore, 'users');
    
    // Search by 'phone' field first
    let q = query(usersRef, where('phone', '==', phoneNumber));
    let querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      console.log('Found user by phone field');
      const userDoc = querySnapshot.docs[0];
      return {
        uid: userDoc.id,
        ...userDoc.data()
      };
    }
    
    // If not found, also try searching by 'phoneNumber' field
    q = query(usersRef, where('phoneNumber', '==', phoneNumber));
    querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      console.log('Found user by phoneNumber field');
      const userDoc = querySnapshot.docs[0];
      return {
        uid: userDoc.id,
        ...userDoc.data()
      };
    }
    
    console.log('No user found with phone number:', phoneNumber);
    return null;
  } catch (error) {
    console.error('Error finding user by phone:', error);
    return null;
  }
}

// findUserByEmail is now imported from userService.js to avoid duplication

/**
 * Merge two user accounts - keep the email account and add phone data
 * @param {string} emailUid - UID of the email account (to keep)
 * @param {string} phoneUid - UID of the phone account (to merge and delete)
 * @param {string} phoneNumber - Phone number to add to email account
 * @returns {Promise<object>} Result of merge operation
 */
export async function mergeUserAccounts(emailUid, phoneUid, phoneNumber) {
  try {
    // Get both user documents
    const emailUserDoc = await getDoc(doc(firestore, 'users', emailUid));
    const phoneUserDoc = await getDoc(doc(firestore, 'users', phoneUid));
    
    if (!emailUserDoc.exists()) {
      throw new Error('Email account not found');
    }
    
    const emailUserData = emailUserDoc.data();
    const phoneUserData = phoneUserDoc.exists() ? phoneUserDoc.data() : {};
    
    // Merge the data - email account takes priority, but add phone info
    const mergedData = {
      ...emailUserData,
      phone: phoneNumber,
      phoneVerified: true,
      authMethods: arrayUnion('email', 'phone'),
      mergedAccounts: arrayUnion(phoneUid),
      updatedAt: new Date().toISOString()
    };
    
    // Update the email account with merged data
    await updateDoc(doc(firestore, 'users', emailUid), mergedData);
    
    // Copy any additional data from phone account that doesn't exist in email account
    if (phoneUserDoc.exists()) {
      const additionalData = {};
      
      // Add any bookings, preferences, etc. from phone account
      if (phoneUserData.bookings && !emailUserData.bookings) {
        additionalData.bookings = phoneUserData.bookings;
      }
      
      if (Object.keys(additionalData).length > 0) {
        await updateDoc(doc(firestore, 'users', emailUid), additionalData);
      }
    }
    
    // Note: We can't delete the phone-authenticated user automatically
    // because Firebase doesn't allow deleting users from client SDK
    // The phone UID will be stored in mergedAccounts array for reference
    
    return {
      success: true,
      mergedUid: emailUid,
      message: 'Accounts successfully merged'
    };
    
  } catch (error) {
    console.error('Error merging accounts:', error);
    return {
      success: false,
      error: error.message || 'Failed to merge accounts'
    };
  }
}

/**
 * Check if phone login should prompt for account linking
 * @param {string} phoneNumber - Phone number that was used to sign in
 * @param {string} currentUid - Current user's UID from phone auth
 * @returns {Promise<object>} Information about potential account conflicts
 */
export async function checkAccountConflict(phoneNumber, currentUid) {
  try {
    // Check if there's an existing user with this phone number but different UID
    const existingUser = await findUserByPhone(phoneNumber);
    
    if (existingUser && existingUser.uid !== currentUid) {
      // There's a conflict - phone number is associated with a different account
      return {
        hasConflict: true,
        existingUid: existingUser.uid,
        existingEmail: existingUser.email,
        conflictType: 'phone_already_linked',
        message: 'This phone number is already associated with another account'
      };
    }
    
    // Check if current user (phone auth) has an email that matches an existing account
    const currentUserDoc = await getDoc(doc(firestore, 'users', currentUid));
    if (currentUserDoc.exists()) {
      const currentUserData = currentUserDoc.data();
      
      if (currentUserData.email) {
        const emailMatch = await findUserByEmail(currentUserData.email);
        if (emailMatch && emailMatch.uid !== currentUid) {
          return {
            hasConflict: true,
            existingUid: emailMatch.uid,
            existingEmail: emailMatch.email,
            conflictType: 'email_already_exists',
            message: 'An account with this email already exists. Would you like to merge them?'
          };
        }
      }
    }
    
    return {
      hasConflict: false,
      message: 'No account conflicts detected'
    };
    
  } catch (error) {
    console.error('Error checking account conflict:', error);
    return {
      hasConflict: false,
      error: error.message
    };
  }
}

/**
 * Clean up temporary phone authentication user
 * @returns {Promise<void>}
 */
export async function cleanupPhoneAuth() {
  try {
    // Sign out any currently authenticated user (likely the phone auth user)
    await signOut(auth);
  } catch (error) {
    console.error('Error Beauty Therapy up phone auth:', error);
    // Don't throw error, this is just cleanup
  }
}

/**
 * Login with phone number by checking user profile first
 * @param {string} phoneNumber - Phone number to login with
 * @param {object} phoneConfirmation - Phone verification confirmation
 * @param {string} otp - OTP code
 * @returns {Promise<object>} Login result
 */
export async function loginWithPhoneProfile(phoneNumber, phoneConfirmation, otp) {
  try {
    console.log('Attempting phone login for:', phoneNumber);
    
    // First check if there's a user profile with this phone number
    const existingUser = await findUserByPhone(phoneNumber);
    console.log('Found existing user:', existingUser ? 'Yes' : 'No');
    
    if (existingUser) {
      console.log('User data:', { 
        hasEmail: !!existingUser.email, 
        phoneVerified: existingUser.phoneVerified,
        phone: existingUser.phone,
        phoneNumber: existingUser.phoneNumber
      });
    }
    
    if (existingUser && existingUser.email && existingUser.phoneVerified) {
      // User exists with linked phone number - allow phone OTP login
      console.log('Linked account found, verifying OTP...');
      
      // Verify OTP first to confirm phone ownership
      await phoneConfirmation.confirm(otp);
      console.log('OTP verified successfully for linked account');
      
      // Sign out the temporary phone user
      await signOut(auth);
      
      // For linked accounts, we'll return success and handle login in the UI
      // The UI will need to trigger a silent login with the email account
      return {
        success: true,
        requiresEmailLogin: false,
        isLinkedAccount: true,
        linkedEmail: existingUser.email,
        userData: existingUser,
        message: 'Phone verified! Logging you in with your linked account...'
      };
    } else if (existingUser && existingUser.email && !existingUser.phoneVerified) {
      // User exists but phone is not verified
      console.log('User found but phone not verified');
      return {
        success: false,
        error: 'Phone number found but not verified. Please verify your phone number first.'
      };
    } else {
      // No existing linked profile, proceed with normal phone authentication
      console.log('No linked account, proceeding with normal phone auth');
      const result = await phoneConfirmation.confirm(otp);
      console.log('Normal phone auth successful');
      
      return {
        success: true,
        requiresEmailLogin: false,
        isLinkedAccount: false,
        user: result.user,
        message: 'Successfully signed in with phone number'
      };
    }
  } catch (error) {
    console.error('Error in phone profile login:', error);
    return {
      success: false,
      error: error.message || 'Phone login failed'
    };
  }
}

/**
 * Authenticate user with linked account after phone verification
 * @param {object} userData - User data from Firestore
 * @returns {Promise<object>} Authentication result
 */
export async function authenticateLinkedAccount(userData) {
  try {
    // Since we've verified phone ownership, we can authenticate the user
    // We'll use the existing AuthContext pattern and return user data
    return {
      success: true,
      user: {
        uid: userData.uid,
        email: userData.email,
        phoneNumber: userData.phone || userData.phoneNumber,
        emailVerified: true, // We'll assume verified for linked accounts
        displayName: userData.name
      },
      profile: userData,
      message: 'Authenticated with linked account via phone verification'
    };
  } catch (error) {
    console.error('Error authenticating linked account:', error);
    return {
      success: false,
      error: error.message || 'Failed to authenticate linked account'
    };
  }
}

/**
 * Add verified phone number to email account during signup
 * @param {object} emailUser - Firebase user object from email signup
 * @param {string} phoneNumber - Verified phone number to add
 * @returns {Promise<object>} Result of phone linking operation
 */
export async function linkPhoneToEmailDuringSignup(emailUser, phoneNumber) {
  try {
    // Update user profile to indicate phone is verified and linked
    const userDocRef = doc(firestore, 'users', emailUser.uid);
    await updateDoc(userDocRef, {
      phone: phoneNumber, // Use 'phone' to match existing field name
      phoneNumber: phoneNumber, // Also add phoneNumber for consistency
      phoneVerified: true,
      authMethods: arrayUnion('email', 'phone'),
      linkedProviders: ['password', 'phone'],
      updatedAt: new Date().toISOString()
    });
    
    return {
      success: true,
      message: 'Phone number successfully linked to your account during signup'
    };
    
  } catch (error) {
    console.error('Error linking phone during signup:', error);
    
    // Even if phone linking fails, the email account is still created
    // We'll just mark phone as unverified
    try {
      const userDocRef = doc(firestore, 'users', emailUser.uid);
      await updateDoc(userDocRef, {
        phoneVerified: false,
        authMethods: ['email'],
        linkedProviders: ['password'],
        updatedAt: new Date().toISOString()
      });
    } catch (updateError) {
      console.error('Error updating user after phone linking failure:', updateError);
    }
    
    return {
      success: false,
      error: error.message || 'Failed to link phone number, but email account was created successfully'
    };
  }
}

/**
 * Handle post-authentication account merging
 * @param {object} user - Firebase user object from phone auth
 * @param {string} emailToMerge - Email of existing account to merge with
 * @param {string} passwordToVerify - Password to verify email account ownership
 * @returns {Promise<object>} Result of merge operation
 */
export async function handleAccountMerging(user, emailToMerge, passwordToVerify) {
  try {
    // Verify the email account exists and password is correct
    const emailUser = await findUserByEmail(emailToMerge);
    if (!emailUser) {
      return {
        success: false,
        error: 'No account found with this email address'
      };
    }
    
    // Try to sign in with email/password to verify ownership
    try {
      await signInWithEmailAndPassword(auth, emailToMerge, passwordToVerify);
    } catch (authError) {
      return {
        success: false,
        error: 'Invalid password for the email account'
      };
    }
    
    // Sign back in with phone user
    // (Working with Firestore data for account merging)
    
    // Merge the accounts at Firestore level
    const mergeResult = await mergeUserAccounts(
      emailUser.uid, 
      user.uid, 
      user.phoneNumber
    );
    
    if (mergeResult.success) {
      // Update the current user's profile to use the merged account data
      await updateProfile(user, {
        displayName: emailUser.name || emailUser.displayName
      });
    }
    
    return mergeResult;
    
  } catch (error) {
    console.error('Error handling account merging:', error);
    return {
      success: false,
      error: error.message || 'Failed to merge accounts'
    };
  }
}