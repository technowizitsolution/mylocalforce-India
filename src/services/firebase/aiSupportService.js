import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

const cleanText = (value, maxLength = 2000) =>
  String(value || '').trim().slice(0, maxLength);

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'all' || normalized === 'public') return 'all';
  return normalized === 'provider' || normalized === 'client' ? 'provider' : 'customer';
};

export const sendAiSupportMessage = async ({
  message,
  role,
  sessionId,
  source = 'web',
  contactInfo = {},
}) => {
  const cleanedMessage = cleanText(message);

  if (!cleanedMessage) {
    throw new Error('Message is required.');
  }

  const callable = httpsCallable(functions, 'sendAiSupportMessage');
  const result = await callable({
    message: cleanedMessage,
    role: normalizeRole(role),
    sessionId: cleanText(sessionId, 80) || null,
    source,
    contactInfo: {
      name: cleanText(contactInfo.name, 120),
      email: cleanText(contactInfo.email, 160),
      phone: cleanText(contactInfo.phone, 50),
    },
  });

  const data = result.data || {};
  return {
    sessionId: data.sessionId || sessionId || null,
    reply: data.reply || 'I could not generate a response right now.',
    model: data.model || '',
    provider: data.provider || '',
    source: data.source || '',
    queryId: data.queryId || null,
    needsAdminAnswer: data.needsAdminAnswer === true,
    needsAdminReview: data.needsAdminReview === true,
  };
};

export const checkAiSupportAnswer = async (queryId) => {
  const cleanedQueryId = cleanText(queryId, 120);
  if (!cleanedQueryId) {
    return { answered: false, answer: '' };
  }

  const callable = httpsCallable(functions, 'checkAiSupportAnswer');
  const result = await callable({ queryId: cleanedQueryId });
  return result.data || { answered: false, answer: '' };
};
