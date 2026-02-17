import { auth, firestore } from './firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

/**
 * Check if a user document exists and what roles they have
 */
export const getUserRoles = async (uid) => {
  try {
    const userRef = doc(firestore, 'users', uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.roles || [];
    }
    return [];
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
};

/**
 * Add a role to an existing user
 */
export const addRoleToUser = async (uid, role) => {
  try {
    const userRef = doc(firestore, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const currentRoles = userDoc.data().roles || [];
      if (!currentRoles.includes(role)) {
        await updateDoc(userRef, {
          roles: arrayUnion(role),
          updatedAt: serverTimestamp(),
        });
        return { success: true, message: `${role} role added successfully` };
      }
      return { success: true, message: `You already have the ${role} role` };
    }
    return { success: false, error: 'User document not found' };
  } catch (error) {
    console.error('Error adding role:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Create a new user document in Firestore
 */
export const createUserDocument = async (uid, userData) => {
  try {
    const userRef = doc(firestore, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        ...userData,
        roles: userData.roles || ['customer'],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { success: true, message: 'User created successfully' };
    }
    return { success: true, message: 'User already exists' };
  } catch (error) {
    console.error('Error creating user document:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get or create user with role management
 * This handles both new signups and adding roles to existing accounts
 */
export const getOrCreateUser = async (uid, userData, requestedRole) => {
  try {
    const userRef = doc(firestore, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      // Existing user - check if role needs to be added
      const existingRoles = userDoc.data().roles || [];
      
      if (!existingRoles.includes(requestedRole)) {
        await updateDoc(userRef, {
          roles: arrayUnion(requestedRole),
          updatedAt: serverTimestamp(),
        });
        return {
          success: true,
          isNewUser: false,
          roleAdded: true,
          roles: [...existingRoles, requestedRole],
          message: `${requestedRole} role added to your account`,
        };
      }

      return {
        success: true,
        isNewUser: false,
        roleAdded: false,
        roles: existingRoles,
        message: 'Welcome back!',
      };
    } else {
      // New user - create document
      await setDoc(userRef, {
        ...userData,
        roles: [requestedRole],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return {
        success: true,
        isNewUser: true,
        roles: [requestedRole],
        message: 'Account created successfully',
      };
    }
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Check if user can add a role (prevent abuse)
 */
export const canAddRole = async (uid, role) => {
  try {
    const roles = await getUserRoles(uid);
    
    // User can be both customer and provider
    if (roles.includes(role)) {
      return { canAdd: false, message: 'You already have this role' };
    }

    // Maximum 2 roles (customer + provider)
    if (roles.length >= 2) {
      return { canAdd: false, message: 'Maximum roles reached' };
    }

    return { canAdd: true };
  } catch (error) {
    console.error('Error checking role eligibility:', error);
    return { canAdd: false, message: error.message };
  }
};

/**
 * Sign out current user
 */
export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getUserRoles,
  addRoleToUser,
  createUserDocument,
  getOrCreateUser,
  canAddRole,
  signOutUser,
};
