import { auth, firestore, functions as cloudFunctions } from './firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { deleteUser as deleteAuthUser } from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  deleteField,
} from 'firebase/firestore';

const VALID_ROLES = ['admin', 'client', 'customer'];
const INACTIVE_ACCOUNT_STATUSES = new Set([
  'deactivated',
  'deleted',
  'pending_deletion',
]);
const ROLE_KEY_MAP = {
  provider: 'client',
  client: 'client',
  customer: 'customer',
  user: 'customer',
  admin: 'admin',
};

export function normalizeRoles(roles) {
  if (!roles) return {};
  if (Array.isArray(roles)) {
    const map = {};
    roles.forEach((role) => {
      if (VALID_ROLES.includes(role)) {
        map[role] = true;
      }
    });
    return map;
  }
  if (typeof roles === 'object') {
    const map = {};
    VALID_ROLES.forEach((role) => {
      if (roles[role]) {
        map[role] = true;
      }
    });
    return map;
  }
  return {};
}

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase();
const normalizeRoleKey = (role) => ROLE_KEY_MAP[normalizeStatus(role)] || null;

export function isAccountDeactivated(profile = {}) {
  const accountStatus = normalizeStatus(profile?.accountStatus || profile?.status);
  return (
    profile?.inactive === true ||
    profile?.accountActive === false ||
    INACTIVE_ACCOUNT_STATUSES.has(accountStatus)
  );
}

export function isRoleDeactivated(profile = {}, role) {
  const roleKey = normalizeRoleKey(role);
  if (!roleKey) return false;

  if (isAccountDeactivated(profile)) {
    return true;
  }

  const roleStatus = normalizeStatus(profile?.roleDeactivation?.[roleKey]?.status);
  return roleStatus === 'deactivated';
}

export function hasAnyRoleDeactivated(profile = {}) {
  if (isAccountDeactivated(profile)) {
    return true;
  }

  const roleDeactivation =
    profile?.roleDeactivation && typeof profile.roleDeactivation === 'object'
      ? profile.roleDeactivation
      : {};

  return Object.keys(roleDeactivation).some(
    (roleKey) => normalizeStatus(roleDeactivation?.[roleKey]?.status) === 'deactivated'
  );
}

export function isSelfDeactivatedAccount(profile = {}) {
  if (!isAccountDeactivated(profile)) return false;

  const deactivatedBy = normalizeStatus(profile?.deactivatedBy);
  const disabledReason = normalizeStatus(profile?.disabledReason);

  return (
    deactivatedBy === 'self' ||
    disabledReason.includes('account deactivated by user')
  );
}

export function isSelfDeactivatedRole(profile = {}, role) {
  const roleKey = normalizeRoleKey(role);
  if (!roleKey) return false;

  if (isSelfDeactivatedAccount(profile)) {
    return true;
  }

  if (!isRoleDeactivated(profile, roleKey)) {
    return false;
  }

  const roleRecord = profile?.roleDeactivation?.[roleKey] || {};
  const deactivatedBy = normalizeStatus(roleRecord?.deactivatedBy);
  const reason = normalizeStatus(roleRecord?.reason);

  return (
    deactivatedBy === 'self' ||
    reason.includes('account deactivated by user')
  );
}

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

/**
 * deactivateCurrentUserAccount
 * - Soft-deactivates only the selected role for the signed-in account
 */
export async function deactivateCurrentUserAccount(role) {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error('You must be logged in to deactivate your account.');
  }

  const uid = currentUser.uid;
  const now = new Date().toISOString();
  const profile = await fetchUserProfile(uid).catch(() => ({}));

  const roleKey =
    normalizeRoleKey(role) || normalizeRoleKey(profile?.activeRole) || 'customer';

  const existingRoleDeactivation =
    profile?.roleDeactivation && typeof profile.roleDeactivation === 'object'
      ? profile.roleDeactivation
      : {};

  const updatePayload = {
    roleDeactivation: {
      ...existingRoleDeactivation,
      [roleKey]: {
        ...(existingRoleDeactivation?.[roleKey] || {}),
        status: 'deactivated',
        deactivatedAt: now,
        deactivatedBy: 'self',
        reason: 'Account deactivated by user',
        updatedAt: now,
      },
    },
    updatedAt: now,
  };

  if (roleKey === 'client') {
    updatePayload.providerAccountDisabled = true;
    updatePayload.disabledReason = 'Account deactivated by user';
  }

  await setDoc(doc(firestore, 'users', uid), updatePayload, { merge: true });

  return { success: true, uid, role: roleKey };
}

/**
 * reactivateCurrentUserAccount
 * - Reactivates a self-deactivated role
 */
export async function reactivateCurrentUserAccount(role) {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error('You must be logged in to reactivate your account.');
  }

  const uid = currentUser.uid;
  const now = new Date().toISOString();

  const profile = await fetchUserProfile(uid);
  if (!profile) {
    throw new Error('User profile not found.');
  }

  const roleKey =
    normalizeRoleKey(role) || normalizeRoleKey(profile?.activeRole) || 'customer';

  const currentStatus = normalizeStatus(profile?.accountStatus || profile?.status);
  if (currentStatus === 'pending_deletion' || currentStatus === 'deleted') {
    throw new Error('This account cannot be reactivated because deletion is in progress.');
  }

  if (!isRoleDeactivated(profile, roleKey)) {
    return { success: true, uid, role: roleKey, alreadyActive: true };
  }

  if (!isSelfDeactivatedRole(profile, roleKey)) {
    const err = new Error(
      'This account was deactivated by admin/compliance and cannot be self-reactivated.'
    );
    err.code = 'account/not-self-deactivated';
    throw err;
  }

  const existingRoleDeactivation =
    profile?.roleDeactivation && typeof profile.roleDeactivation === 'object'
      ? profile.roleDeactivation
      : {};
  const nextRoleDeactivation = {
    ...existingRoleDeactivation,
    [roleKey]: {
      ...(existingRoleDeactivation?.[roleKey] || {}),
      status: 'active',
      reactivatedAt: now,
      reactivatedBy: 'self',
      updatedAt: now,
    },
  };

  if (nextRoleDeactivation?.[roleKey]) {
    delete nextRoleDeactivation[roleKey].reason;
  }

  const updatePayload = {
    roleDeactivation: nextRoleDeactivation,
    reactivatedAt: now,
    reactivatedBy: 'self',
    updatedAt: now,
  };

  if (isSelfDeactivatedAccount(profile)) {
    updatePayload.accountStatus = 'active';
    updatePayload.status = 'active';
    updatePayload.accountActive = true;
    updatePayload.inactive = false;
    updatePayload.accountDisabled = false;
  }

  if (roleKey === 'client') {
    updatePayload.providerAccountDisabled = false;
  }

  const disabledReason = normalizeStatus(profile?.disabledReason);
  if (disabledReason.includes('account deactivated by user')) {
    updatePayload.disabledReason = deleteField();
  }

  await setDoc(doc(firestore, 'users', uid), updatePayload, { merge: true });

  return { success: true, uid, role: roleKey };
}

/**
 * deleteCurrentUserAccount
 * - Role-aware deletion
 * - If multiple roles exist and a role is provided, deletes only that role
 * - If only one role remains, permanently deletes the whole user account/data
 */
export async function deleteCurrentUserAccount(role) {
  const currentUser = auth.currentUser;
  if (!currentUser?.uid) {
    throw new Error('You must be logged in to delete your account.');
  }

  const uid = currentUser.uid;
  const now = new Date().toISOString();

  const profile = await fetchUserProfile(uid).catch(() => ({}));
  const rolesData = await fetchUserRoles(uid).catch(() => ({ roles: {} }));
  const roles = normalizeRoles(rolesData?.roles || profile?.roles);
  const trueRoles = Object.keys(roles).filter((r) => roles[r]);

  const requestedRole = normalizeRoleKey(role);
  const profileActiveRole = normalizeRoleKey(profile?.activeRole);
  const targetRole = requestedRole || profileActiveRole || trueRoles[0] || 'customer';

  if (trueRoles.length > 1) {
    if (requestedRole && !roles[requestedRole]) {
      throw new Error('Selected role is not available on this account.');
    }

    const roleToDelete = roles[targetRole] ? targetRole : trueRoles[0];
    const remainingRoles = trueRoles.filter((r) => r !== roleToDelete);

    const roleRemovalUpdates = {
      [`roles.${roleToDelete}`]: deleteField(),
      [`roleDeactivation.${roleToDelete}`]: deleteField(),
      updatedAt: now,
    };

    if (profileActiveRole === roleToDelete && remainingRoles.length > 0) {
      roleRemovalUpdates.activeRole = remainingRoles[0];
    }

    if (isSelfDeactivatedAccount(profile)) {
      roleRemovalUpdates.accountStatus = 'active';
      roleRemovalUpdates.status = 'active';
      roleRemovalUpdates.accountActive = true;
      roleRemovalUpdates.inactive = false;
      roleRemovalUpdates.accountDisabled = false;
      roleRemovalUpdates.deactivatedBy = deleteField();
      roleRemovalUpdates.deactivatedAt = deleteField();
      roleRemovalUpdates.deactivationRequestedAt = deleteField();
    }

    if (roleToDelete === 'client') {
      roleRemovalUpdates.providerAccountDisabled = false;

      const disabledReason = normalizeStatus(profile?.disabledReason);
      if (disabledReason.includes('account deactivated by user')) {
        roleRemovalUpdates.disabledReason = deleteField();
      }

      try {
        const disableProviderServices = httpsCallable(
          cloudFunctions,
          'disableProviderServices'
        );
        await disableProviderServices({ providerId: uid });
      } catch (error) {
        console.warn(
          'deleteCurrentUserAccount: disableProviderServices failed during role delete:',
          error?.message || error
        );
      }
    }

    await updateDoc(doc(firestore, 'users', uid), roleRemovalUpdates);

    return {
      success: true,
      uid,
      mode: 'role-removed',
      deletedRole: roleToDelete,
      remainingRoles,
    };
  }

  const roleDeactivatePromises = [];
  if (roles.customer) {
    roleDeactivatePromises.push(deactivateCurrentUserAccount('customer'));
  }
  if (roles.client) {
    roleDeactivatePromises.push(deactivateCurrentUserAccount('client'));
  }
  if (roles.admin) {
    roleDeactivatePromises.push(deactivateCurrentUserAccount('admin'));
  }
  if (roleDeactivatePromises.length === 0) {
    roleDeactivatePromises.push(deactivateCurrentUserAccount(targetRole));
  }

  await Promise.allSettled(roleDeactivatePromises);

  try {
    const detailsSnapshot = await getDocs(
      collection(firestore, 'users', uid, 'details')
    );
    await Promise.all(detailsSnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
  } catch (error) {
    console.warn(
      'deleteCurrentUserAccount: failed to remove details subcollection docs:',
      error?.message || error
    );
  }

  try {
    await deleteDoc(doc(firestore, 'users', uid));
  } catch (error) {
    console.warn(
      'deleteCurrentUserAccount: failed to remove users/{uid} doc:',
      error?.message || error
    );
  }

  try {
    await deleteAuthUser(currentUser);
    return { success: true, uid, mode: 'full-delete' };
  } catch (error) {
    try {
      await setDoc(
        doc(firestore, 'users', uid),
        {
          accountStatus: 'pending_deletion',
          accountDeletionRequestedAt: now,
          accountDeletionErrorCode: error?.code || null,
          accountDeletionLastErrorAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    } catch (persistError) {
      console.warn(
        'deleteCurrentUserAccount: failed to persist deletion status:',
        persistError?.message || persistError
      );
    }

    throw error;
  }
}
