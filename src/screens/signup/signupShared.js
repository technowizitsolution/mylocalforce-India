import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions as functionsClient } from '../../services/firebase/firebaseConfig';
import { isValidEmail } from '../../utils/helpers';

const SEND_EMAIL_OTP_URL =
  'https://us-central1-mylocalforce-295b8.cloudfunctions.net/sendEmailOtp';

export const COUNTRY_OPTIONS = [
  { label: 'India (+91)', value: '+91', hint: '10 digits' },
  {
    label: 'Australia (+61)',
    value: '+61',
    hint: 'Must start with 04 and contain 10 digits',
  },
];

export const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

export const DAYS = Array.from({ length: 31 }, (_, index) => ({
  label: String(index + 1),
  value: String(index + 1),
}));

export const MONTHS = [
  { label: 'Jan', value: '1' },
  { label: 'Feb', value: '2' },
  { label: 'Mar', value: '3' },
  { label: 'Apr', value: '4' },
  { label: 'May', value: '5' },
  { label: 'Jun', value: '6' },
  { label: 'Jul', value: '7' },
  { label: 'Aug', value: '8' },
  { label: 'Sep', value: '9' },
  { label: 'Oct', value: '10' },
  { label: 'Nov', value: '11' },
  { label: 'Dec', value: '12' },
];

const currentYear = new Date().getFullYear();
export const YEARS = Array.from({ length: currentYear - 1900 + 1 }, (_, index) => ({
  label: String(currentYear - index),
  value: String(currentYear - index),
}));

export const getPasswordValidation = (password) => ({
  hasMinLength: password.length >= 6,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
});

export const validatePhoneNumber = (countryCode, rawPhoneNumber) => {
  if (!countryCode) {
    return { valid: false, message: 'Please select your country code.' };
  }

  const phoneNumber = String(rawPhoneNumber || '').replace(/\s/g, '');

  if (!phoneNumber) {
    return { valid: false, message: 'Please enter your phone number.' };
  }

  if (countryCode === '+61') {
    if (!phoneNumber.startsWith('04')) {
      return {
        valid: false,
        message: 'Australian numbers must start with 04.',
      };
    }

    if (phoneNumber.length !== 10) {
      return {
        valid: false,
        message: 'Australian numbers must be exactly 10 digits.',
      };
    }

    return { valid: true };
  }

  if (countryCode === '+91') {
    if (phoneNumber.length !== 10) {
      return {
        valid: false,
        message: 'Indian numbers must be exactly 10 digits.',
      };
    }

    return { valid: true };
  }

  return { valid: false, message: 'Invalid phone number.' };
};

export const formatPhoneNumber = (countryCode, rawPhoneNumber) => {
  const phoneNumber = String(rawPhoneNumber || '').trim().replace(/\s/g, '');

  if (!phoneNumber) {
    return '';
  }

  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }

  return `${countryCode}${phoneNumber.replace(/^0+/, '')}`;
};

export const buildPhoneCandidates = (countryCode, rawPhoneNumber) => {
  const digitsOnly = String(rawPhoneNumber || '').replace(/[^0-9]/g, '');
  const localNoLeadingZeros = digitsOnly.replace(/^0+/, '');
  const e164 = `${countryCode}${localNoLeadingZeros}`;
  const e164NoPlus = e164.replace('+', '');

  return Array.from(
    new Set([
      e164,
      e164NoPlus,
      localNoLeadingZeros,
      digitsOnly,
      ...(countryCode === '+61' ? [`0${localNoLeadingZeros}`] : []),
    ]),
  ).slice(0, 10);
};

export const getDobValidation = (day, month, year) => {
  if (!day || !month || !year) {
    return {
      valid: false,
      message: 'Please select your complete date of birth.',
    };
  }

  const dob = new Date(Number(year), Number(month) - 1, Number(day));
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  if (age < 18) {
    return {
      valid: false,
      message: 'You must be at least 18 years old to sign up.',
    };
  }

  return { valid: true, dob };
};

export const buildDobString = (day, month, year) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const parseJsonResponse = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Server returned an invalid response. Please try again.');
  }
};

export const fetchUserByEmail = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return null;
  }

  const usersRef = collection(firestore, 'users');
  const emailQuery = query(
    usersRef,
    where('email', '==', normalizedEmail),
    limit(1),
  );
  const snapshot = await getDocs(emailQuery);

  if (snapshot.empty) {
    return null;
  }

  const docSnapshot = snapshot.docs[0];
  return { id: docSnapshot.id, data: docSnapshot.data() };
};

export const fetchUserByPhone = async (countryCode, rawPhoneNumber) => {
  const candidates = buildPhoneCandidates(countryCode, rawPhoneNumber);

  if (candidates.length === 0) {
    return null;
  }

  const usersRef = collection(firestore, 'users');
  const phoneQuery = query(
    usersRef,
    where('phone', 'in', candidates),
    limit(1),
  );
  const snapshot = await getDocs(phoneQuery);

  if (snapshot.empty) {
    return null;
  }

  const docSnapshot = snapshot.docs[0];
  return { id: docSnapshot.id, data: docSnapshot.data() };
};

export const getRoleDisplayName = (roles = {}) => {
  if (roles.client && roles.customer) {
    return 'Customer and Service Provider';
  }

  if (roles.client) {
    return 'Service Provider';
  }

  if (roles.customer) {
    return 'Customer';
  }

  if (roles.admin) {
    return 'Admin';
  }

  return 'another account';
};

export const getRoleConflictMessage = (roles = {}, targetRole) => {
  const roleLabel = targetRole === 'client' ? 'Service Provider' : 'Customer';

  if (roles.client && roles.customer) {
    return `An account with these details already exists for both Customer and Service Provider. Please log in instead.`;
  }

  if (roles[targetRole]) {
    return `A ${roleLabel.toLowerCase()} account with these details already exists. Please log in instead.`;
  }

  return null;
};

export const sendEmailOtp = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const response = await fetch(SEND_EMAIL_OTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(payload.error || 'Failed to send email OTP.');
  }

  return payload;
};

export const sendPhoneOtp = async (phoneNumber) => {
  const callable = httpsCallable(functionsClient, 'sendOtp');
  return callable({ phoneNumber: String(phoneNumber) });
};

export const verifySignupPhoneOtp = async ({
  phoneNumber,
  otp,
  email,
  signupRole,
}) => {
  const callable = httpsCallable(functionsClient, 'verifyOtp');
  const response = await callable({
    phoneNumber: String(phoneNumber),
    otp: String(otp),
    email,
    role: signupRole,
    skipSignIn: true,
  });

  return response?.data || {};
};
