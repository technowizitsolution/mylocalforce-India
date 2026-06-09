import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

const cleanText = (value, maxLength = 2000) =>
  String(value || '').trim().slice(0, maxLength);

const normalizeRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'provider' || normalized === 'client' ? 'provider' : 'customer';
};

export const sendAiSupportMessage = async ({ message, role, sessionId, source = 'web' }) => {
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
  });

  const data = result.data || {};
  return {
    sessionId: data.sessionId || sessionId || null,
    reply: data.reply || 'I could not generate a response right now.',
    model: data.model || '',
    provider: data.provider || '',
  };
};
