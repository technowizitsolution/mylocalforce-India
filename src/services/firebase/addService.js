import { firestore } from './firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { fetchUserProfile } from './index';

export async function addService({ 
  name, 
  title,
  category, 
  price, 
  duration, 
  description, 
  imageUrl,
  ownerId,
  ownerName,
  ownerEmail,
  ownerPhone,
  discount = 0,
  discountType = 'percentage'
}) {
  if (!ownerId) throw new Error('ownerId required');
  // Verify provider account status before creating service
  try {
    const profile = await fetchUserProfile(ownerId);
    // Consider provider-scoped disabled flag first, fall back to global accountDisabled for backward compatibility
    const accountDisabled = profile && ((profile.providerAccountDisabled === true) || (profile.accountDisabled === true) || profile.disabled === true);
    const visaStatus = profile && (profile.visaStatus || (profile.profile && profile.profile.visaStatus));
    const visaExpiryTs = profile && profile.visaExpiryTimestamp && profile.visaExpiryTimestamp.toDate ? profile.visaExpiryTimestamp.toDate() : (profile && profile.visaExpiryTimestamp ? new Date(profile.visaExpiryTimestamp) : null);
    const now = new Date();
    const visaExpired = visaStatus === 'blocked' || (visaExpiryTs && visaExpiryTs.setHours(0,0,0,0) < now.setHours(0,0,0,0));
    if (accountDisabled || visaExpired || visaStatus === 'blocked') {
      const err = new Error('Provider account is paused due to VISA status. Update VISA to continue.');
      err.code = 'VISA_BLOCKED';
      throw err;
    }
  } catch (e) {
    // If fetchUserProfile fails, continue cautiously (or rethrow?) — rethrow to be safe
    if (e && e.code === 'VISA_BLOCKED') throw e;
    console.warn('addService: could not verify provider profile, aborting for safety', e);
    const err = new Error('Could not verify provider profile');
    throw err;
  }
  
  const servicesCol = collection(firestore, 'services');
  const docRef = await addDoc(servicesCol, {
    name,
    title: title || name, // Use title if provided, otherwise use name
    category,
    price: typeof price === 'string' ? parseFloat(price) : price,
    duration,
    description,
    imageUrl: imageUrl || null,
    status: 'active',
    commissionRate: 10, // Default 10% commission
    discount,
    discountType,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ownerId,
    ownerName: ownerName || null,
    ownerEmail: ownerEmail || null,
    ownerPhone: ownerPhone || null,
  });
  return docRef.id;
}
