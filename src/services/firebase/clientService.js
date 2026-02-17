import { firestore } from './firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

/**
 * fetchClientData
 * - Fetches client-specific collections/data. Adjust queries depending on your schema.
 */
export async function fetchClientData(uid) {
  if (!uid) throw new Error('uid required');
  // Example: fetch services provided by client stored under collections 'services' with ownerId
  const servicesCol = collection(firestore, 'services');
  const q = query(servicesCol, where('ownerId', '==', uid));
  const snaps = await getDocs(q);
  const services = snaps.docs.map((d) => ({ id: d.id, ...d.data() }));
  // fetch profile
  const profileRef = doc(firestore, 'users', uid);
  const profileSnap = await getDoc(profileRef);
  const profile = profileSnap.exists() ? profileSnap.data() : null;
  return { profile, services };
}

/**
 * switchActiveRole
 * - Writes an 'activeRole' property in users/{uid} so UI can persist the currently active role
 */
export async function switchActiveRole(uid, role) {
  if (!uid) throw new Error('uid required');
  const ref = doc(firestore, 'users', uid);
  await updateDoc(ref, { activeRole: role });
}
