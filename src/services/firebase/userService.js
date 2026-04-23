import { auth, firestore } from './firebaseConfig';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * fetchUserRoles
 * - Returns roles object for a uid and helper 'destination'
 * - destination: one of 'ClientDashboard', 'CustomerDashboard', 'AdminDashboard', or 'RoleSelection'
 */
/**
 * fetchUserRoles(uid)
 * Returns an object: { roles: {admin?:bool, client?:bool, customer?:bool}, destination: string }
 * Destination mapping: client -> 'ClientDashboard', customer -> 'CustomerDashboard', admin -> 'AdminDashboard'
 * If multiple roles exist, destination === 'RoleSelection'
 */
export async function fetchUserRoles(uid) {
  if (!uid) return { roles: {}, activeRole: null, destination: 'RoleSelection' };
  const ref = doc(firestore, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { roles: {}, activeRole: null, destination: 'RoleSelection' };
  const data = snap.data();
  const roles = data.roles || {};

  const trueRoles = Object.keys(roles).filter((r) => roles[r]);
  const activeRole = data.activeRole || (trueRoles.length === 1 ? trueRoles[0] : null);

  if (trueRoles.length === 1) {
    const r = trueRoles[0];
    const destination = r === 'client' ? 'ClientDashboard' : r === 'customer' ? 'CustomerDashboard' : r === 'admin' ? 'AdminDashboard' : 'RoleSelection';
    return { roles, activeRole, destination };
  }

  if (trueRoles.length === 0) return { roles, activeRole, destination: 'RoleSelection' };
  return { roles, activeRole, destination: 'RoleSelection' };
}

/**
 * addRoleToUser
 * - Adds a role to an existing user document with optional role-specific fields
 * - For client role: businessName, businessType, experience, nationality
 * - For customer role: preferences, location, etc.
 */
export async function addRoleToUser(uid, role, additionalFields = {}) {
  if (!uid) throw new Error('uid required');
  const ref = doc(firestore, 'users', uid);
  
  // Prepare update data
  const updateData = {
    [`roles.${role}`]: true,
    updatedAt: new Date().toISOString(),
    ...additionalFields
  };
  
  // Set approval status for client role
  if (role === 'client') {
    updateData.approvalStatus = 'pending';
  }
  
  await updateDoc(ref, updateData);
}

/**
 * getActiveRole
 * - Returns the activeRole stored in users/{uid}.activeRole
 */
export async function getActiveRole(uid) {
  if (!uid) return null;
  const ref = doc(firestore, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data().activeRole || null;
}

/**
 * findUserByEmail
 * - Returns { uid, data } or null
 * - Only works for authenticated users due to Firestore security rules
 */
export async function findUserByEmail(email) {
  try {
    // Check if user is authenticated
    if (!auth.currentUser) {
      console.warn('findUserByEmail requires authentication');
      return null;
    }
    
    const col = collection(firestore, 'users');
    const q = query(col, where('email', '==', email));
    const snaps = await getDocs(q);
    if (snaps.empty) return null;
    const docSnap = snaps.docs[0];
    return { uid: docSnap.id, data: docSnap.data() };
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

export async function findUserByPhone(phone) {
  const col = collection(firestore, 'users');
  const q = query(col, where('phone', '==', phone));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  const docSnap = snaps.docs[0];
  return { uid: docSnap.id, data: docSnap.data() };
}

/**
 * fetchUserProfile
 * - Returns user profile data for a given uid
 * - Returns null if user document doesn't exist
 */
export async function fetchUserProfile(uid) {
  if (!uid) return null;
  const ref = doc(firestore, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

/**
 * switchActiveRole
 * - Updates the active role for a user
 */
export async function switchActiveRole(uid, role) {
  if (!uid) throw new Error('uid required');
  const ref = doc(firestore, 'users', uid);
  await updateDoc(ref, { activeRole: role });
}

/**
 * updateApprovalStatus
 * - Updates approval status for a user (admin only)
 * - status: 'pending', 'approved', 'rejected'
 */
export async function updateApprovalStatus(uid, status, adminNotes = '') {
  if (!uid) throw new Error('uid required');
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    throw new Error('Invalid approval status');
  }
  
  const ref = doc(firestore, 'users', uid);
  const updateData = {
    approvalStatus: status,
    approvalUpdatedAt: new Date().toISOString()
  };
  
  if (adminNotes) {
    updateData.adminNotes = adminNotes;
  }
  
  await updateDoc(ref, updateData);
}

/**
 * getApprovalStatus
 * - Returns the approval status for a user
 */
export async function getApprovalStatus(uid) {
  if (!uid) throw new Error('uid required');
  const ref = doc(firestore, 'users', uid);
  const docSnap = await getDoc(ref);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    status: data.approvalStatus || 'approved', // Default to approved for backward compatibility
    updatedAt: data.approvalUpdatedAt,
    adminNotes: data.adminNotes
  };
}

/**
 * getPendingClientApplications
 * - Returns all pending client applications for admin review
 */
export async function getPendingClientApplications() {
  const usersRef = collection(firestore, 'users');
  const q = query(
    usersRef, 
    where('approvalStatus', '==', 'pending'),
    where('roles.client', '==', true)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(docSnap => ({
    uid: docSnap.id,
    ...docSnap.data()
  }));
}
