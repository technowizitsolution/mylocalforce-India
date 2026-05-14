import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, firestore } from './firebaseConfig';

const SUPPORT_CASES_COLLECTION = 'supportCases';
const SUPPORT_MESSAGES_SUBCOLLECTION = 'messages';

const normalizeRole = (role) => {
  const normalized = String(role || '')
    .trim()
    .toLowerCase();
  return normalized === 'provider' ? 'provider' : 'customer';
};

const cleanText = (value, maxLength) =>
  String(value || '')
    .trim()
    .slice(0, maxLength);

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortSupportCases = (cases) =>
  [...cases].sort((left, right) => {
    const rightTime = toMillis(right.lastMessageAt || right.createdAt);
    const leftTime = toMillis(left.lastMessageAt || left.createdAt);
    return rightTime - leftTime;
  });

export const buildSupportCaseId = (docId) =>
  `CASE-${String(docId || '')
    .slice(-8)
    .toUpperCase()}`;

export const createSupportCase = async ({
  requesterUid,
  requesterRole,
  requesterName,
  requesterEmail,
  requesterPhone,
  subject,
  message,
}) => {
  if (!requesterUid) throw new Error('Missing requester UID.');

  const cleanedSubject = cleanText(subject, 120);
  const cleanedMessage = cleanText(message, 2000);

  if (!cleanedSubject) throw new Error('Subject is required.');
  if (!cleanedMessage) throw new Error('Message is required.');

  const supportCasesRef = collection(firestore, SUPPORT_CASES_COLLECTION);
  const caseRef = doc(supportCasesRef);
  const caseId = buildSupportCaseId(caseRef.id);
  const normalizedRole = normalizeRole(requesterRole);
  const resolvedRequesterEmail = cleanText(requesterEmail || auth.currentUser?.email, 160);
  const senderName =
    cleanText(requesterName, 120) || cleanText(resolvedRequesterEmail, 120) || 'User';

  await setDoc(caseRef, {
    caseId,
    requesterUid,
    requesterRole: normalizedRole,
    requesterName: cleanText(requesterName, 120),
    requesterEmail: resolvedRequesterEmail,
    requesterPhone: cleanText(requesterPhone, 40),
    subject: cleanedSubject,
    status: 'open',
    source: 'web',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastMessageSender: normalizedRole,
    lastMessagePreview: cleanedMessage.slice(0, 180),
    messageCount: 1,
  });

  await addDoc(collection(firestore, SUPPORT_CASES_COLLECTION, caseRef.id, 'messages'), {
    senderType: normalizedRole,
    senderUid: requesterUid,
    senderName,
    message: cleanedMessage,
    via: 'web',
    createdAt: serverTimestamp(),
  });

  return { id: caseRef.id, caseId };
};

export const subscribeSupportCasesForUser = (requesterUid, requesterRole, onChange, onError) => {
  const normalizedRole = normalizeRole(requesterRole);

  if (!requesterUid) {
    onChange?.([]);
    return () => {};
  }

  const supportCasesQuery = query(
    collection(firestore, SUPPORT_CASES_COLLECTION),
    where('requesterUid', '==', requesterUid)
  );

  return onSnapshot(
    supportCasesQuery,
    (snapshot) => {
      const supportCases = snapshot.docs
        .map((caseDoc) => ({ id: caseDoc.id, ...caseDoc.data() }))
        .filter((supportCase) => normalizeRole(supportCase.requesterRole) === normalizedRole);

      onChange?.(sortSupportCases(supportCases));
    },
    (error) => onError?.(error)
  );
};

export const subscribeSupportCaseMessages = (supportCaseId, onChange, onError) => {
  if (!supportCaseId) {
    onChange?.([]);
    return () => {};
  }

  const messagesQuery = query(
    collection(firestore, SUPPORT_CASES_COLLECTION, supportCaseId, SUPPORT_MESSAGES_SUBCOLLECTION),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onChange?.(snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() })));
    },
    (error) => onError?.(error)
  );
};

export const sendSupportCaseMessage = async ({
  supportCaseId,
  senderUid,
  senderRole,
  senderName,
  message,
}) => {
  if (!supportCaseId) throw new Error('Support case ID is required.');
  if (!senderUid) throw new Error('Sender UID is required.');

  const cleanedMessage = cleanText(message, 2000);
  if (!cleanedMessage) throw new Error('Message is required.');

  const normalizedRole = normalizeRole(senderRole);
  const supportCaseRef = doc(firestore, SUPPORT_CASES_COLLECTION, supportCaseId);
  const supportCaseSnapshot = await getDoc(supportCaseRef);

  if (!supportCaseSnapshot.exists()) throw new Error('Support case not found.');

  const supportCase = supportCaseSnapshot.data() || {};
  if (supportCase.requesterUid !== senderUid) {
    throw new Error('You are not authorized to send a message in this support case.');
  }

  const supportCaseRole = String(supportCase.requesterRole || '')
    .trim()
    .toLowerCase();
  if (supportCaseRole && normalizeRole(supportCaseRole) !== normalizedRole) {
    throw new Error('This support case belongs to a different account role.');
  }

  if (String(supportCase.status || '').toLowerCase() === 'closed') {
    throw new Error('This support request is closed. Please create a new support request.');
  }

  await addDoc(
    collection(firestore, SUPPORT_CASES_COLLECTION, supportCaseId, SUPPORT_MESSAGES_SUBCOLLECTION),
    {
      senderType: normalizedRole,
      senderUid,
      senderName: cleanText(senderName, 120) || cleanText(auth.currentUser?.email, 120) || 'User',
      message: cleanedMessage,
      via: 'web',
      createdAt: serverTimestamp(),
    }
  );

  await setDoc(
    supportCaseRef,
    {
      lastMessageAt: serverTimestamp(),
      lastMessageSender: normalizedRole,
      lastMessagePreview: cleanedMessage.slice(0, 180),
      messageCount: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
