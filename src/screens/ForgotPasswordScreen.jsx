import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiCircle,
  FiHome,
  FiLock,
  FiLogIn,
  FiMail,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
} from 'react-icons/fi';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from '../services/firebase/firebaseConfig';
import { notify, getUserFacingError } from '../utils/toast';

const SEND_EMAIL_OTP_URL =
  'https://us-central1-mylocalforce-295b8.cloudfunctions.net/sendEmailOtp';
const RESET_PASSWORD_URL =
  'https://us-central1-mylocalforce-295b8.cloudfunctions.net/resetpassword';
const UPDATE_PASSWORD_WITH_UID_URL =
  'https://us-central1-mylocalforce-295b8.cloudfunctions.net/updatePasswordWithUid';

const COUNTRY_OPTIONS = [
  { label: 'India (+91)', value: '+91' },
  { label: 'Australia (+61)', value: '+61' },
];

const inputClass =
  'h-14 w-full rounded-lg border border-gray-300 bg-white px-5 text-gray-900 placeholder-gray-500 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100';

const iconInputClass =
  'h-14 w-full rounded-lg border border-gray-300 bg-white px-5 pl-12 text-gray-900 placeholder-gray-500 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100';

const initialFlowState = {
  emailOtpSent: false,
  emailOtpVerified: false,
  phoneOtpSent: false,
  phoneOtpVerified: false,
  emailOtp: '',
  phoneOtp: '',
  newPassword: '',
  confirmPassword: '',
  verifiedUid: null,
  verifiedPhone: null,
  emailCooldown: 0,
  phoneCooldown: 0,
};

const parseJsonSafely = async (response) => {
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

const ForgotPasswordScreen = () => {
  const navigate = useNavigate();

  const [resetMethod, setResetMethod] = useState('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('+91');

  const [emailOtp, setEmailOtp] = useState(initialFlowState.emailOtp);
  const [phoneOtp, setPhoneOtp] = useState(initialFlowState.phoneOtp);
  const [newPassword, setNewPassword] = useState(initialFlowState.newPassword);
  const [confirmPassword, setConfirmPassword] = useState(
    initialFlowState.confirmPassword,
  );

  const [emailOtpSent, setEmailOtpSent] = useState(
    initialFlowState.emailOtpSent,
  );
  const [emailOtpVerified, setEmailOtpVerified] = useState(
    initialFlowState.emailOtpVerified,
  );
  const [phoneOtpSent, setPhoneOtpSent] = useState(
    initialFlowState.phoneOtpSent,
  );
  const [phoneOtpVerified, setPhoneOtpVerified] = useState(
    initialFlowState.phoneOtpVerified,
  );
  const [verifiedUid, setVerifiedUid] = useState(initialFlowState.verifiedUid);
  const [verifiedPhone, setVerifiedPhone] = useState(
    initialFlowState.verifiedPhone,
  );

  const [emailCooldown, setEmailCooldown] = useState(
    initialFlowState.emailCooldown,
  );
  const [phoneCooldown, setPhoneCooldown] = useState(
    initialFlowState.phoneCooldown,
  );

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [isResetComplete, setIsResetComplete] = useState(false);

  useEffect(() => {
    if (emailCooldown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setEmailCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [emailCooldown]);

  useEffect(() => {
    if (phoneCooldown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setPhoneCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phoneCooldown]);

  const passwordValidation = useMemo(
    () => ({
      hasMinLength: newPassword.length >= 6,
      hasUppercase: /[A-Z]/.test(newPassword),
      hasLowercase: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    }),
    [newPassword],
  );

  const canShowPasswordForm =
    (resetMethod === 'email' && emailOtpVerified) ||
    (resetMethod === 'phone' && phoneOtpVerified);

  const clearMessages = ({
    includeEmailFlow = false,
    includePhoneFlow = false,
    includeReset = false,
    includeValidation = false,
  } = {}) => {
    if (includeEmailFlow) {
      notify.dismiss('forgot-email-otp-send');
      notify.dismiss('forgot-email-otp-verify');
    }

    if (includePhoneFlow) {
      notify.dismiss('forgot-phone-otp-send');
      notify.dismiss('forgot-phone-otp-verify');
    }

    if (includeReset) {
      notify.dismiss('forgot-password-reset');
    }

    if (includeValidation) {
      notify.dismiss('forgot-password-validation');
    }
  };

  const resetCurrentFlow = () => {
    clearMessages({
      includeEmailFlow: true,
      includePhoneFlow: true,
      includeReset: true,
      includeValidation: true,
    });
    setEmailOtp(initialFlowState.emailOtp);
    setPhoneOtp(initialFlowState.phoneOtp);
    setNewPassword(initialFlowState.newPassword);
    setConfirmPassword(initialFlowState.confirmPassword);
    setEmailOtpSent(initialFlowState.emailOtpSent);
    setEmailOtpVerified(initialFlowState.emailOtpVerified);
    setPhoneOtpSent(initialFlowState.phoneOtpSent);
    setPhoneOtpVerified(initialFlowState.phoneOtpVerified);
    setVerifiedUid(initialFlowState.verifiedUid);
    setVerifiedPhone(initialFlowState.verifiedPhone);
    setEmailCooldown(initialFlowState.emailCooldown);
    setPhoneCooldown(initialFlowState.phoneCooldown);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsResetComplete(false);
  };

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validatePhoneNumber = (value) => {
    const cleanPhone = value.replace(/\s/g, '');

    if (selectedCountry === '+61') {
      if (!cleanPhone.startsWith('04')) {
        return {
          valid: false,
          message: 'Australian number must start with 04',
        };
      }

      if (cleanPhone.length !== 10) {
        return {
          valid: false,
          message: 'Australian number must be exactly 10 digits',
        };
      }

      return { valid: true };
    }

    if (selectedCountry === '+91') {
      if (cleanPhone.length !== 10) {
        return {
          valid: false,
          message: 'Indian number must be exactly 10 digits',
        };
      }

      return { valid: true };
    }

    return { valid: false, message: 'Invalid phone number' };
  };

  const formatPhoneNumber = () => {
    const cleaned = phone.trim().replace(/\s/g, '');

    if (!cleaned) {
      return '';
    }

    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    return `${selectedCountry}${cleaned.replace(/^0+/, '')}`;
  };

  const handleSendEmailOtp = async () => {
    clearMessages({ includeEmailFlow: true, includeValidation: true });

    if (!email.trim()) {
      notify.error('Please enter your email address.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    if (!isValidEmail(email)) {
      notify.error('Please enter a valid email address.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    setIsSendingEmailOtp(true);

    try {
      const emailLower = email.trim().toLowerCase();
      const usersRef = collection(firestore, 'users');
      const userQuery = query(
        usersRef,
        where('email', '==', emailLower),
        limit(1),
      );
      const usersSnapshot = await getDocs(userQuery);

      if (usersSnapshot.empty) {
        throw new Error('This email is not registered. Please sign up first.');
      }

      const response = await fetch(SEND_EMAIL_OTP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLower }),
      });

      const payload = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to send OTP.');
      }

      setEmail(emailLower);
      setEmailOtpSent(true);
      setEmailOtpVerified(false);
      setEmailCooldown(60);
      notify.success(`Verification code sent to ${emailLower}.`, {
        id: 'forgot-email-otp-send',
      });
    } catch (sendError) {
      notify.error(getUserFacingError(sendError, 'Could not send verification code.'), {
        id: 'forgot-email-otp-send',
      });
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = () => {
    clearMessages({ includeEmailFlow: true, includeValidation: true });
    setIsVerifyingEmailOtp(true);

    window.setTimeout(() => {
      if (!emailOtp || emailOtp.length !== 6) {
        notify.error('Please enter the 6-digit verification code.', {
          id: 'forgot-password-validation',
        });
        setIsVerifyingEmailOtp(false);
        return;
      }

      setEmailOtpVerified(true);
      notify.success('Code verified. Set your new password to finish reset.', {
        id: 'forgot-email-otp-verify',
      });
      setIsVerifyingEmailOtp(false);
    }, 150);
  };

  const handleSendPhoneOtp = async () => {
    clearMessages({ includePhoneFlow: true, includeValidation: true });

    if (!selectedCountry) {
      notify.error('Please select your country code.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    if (!phone.trim()) {
      notify.error('Please enter your phone number.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    const validation = validatePhoneNumber(phone);

    if (!validation.valid) {
      notify.error(validation.message, { id: 'forgot-password-validation' });
      return;
    }

    const formattedPhone = formatPhoneNumber();

    if (!formattedPhone) {
      notify.error('Invalid phone number.', { id: 'forgot-password-validation' });
      return;
    }

    setIsSendingPhoneOtp(true);

    try {
      const cleanedInput = phone.trim().replace(/[^0-9]/g, '');
      const localNoLeadingZeros = cleanedInput.replace(/^0+/, '');
      const e164 = `${selectedCountry}${localNoLeadingZeros}`;
      const e164NoPlus = e164.replace('+', '');
      const candidates = Array.from(
        new Set([
          e164,
          e164NoPlus,
          localNoLeadingZeros,
          cleanedInput,
          ...(selectedCountry === '+61' ? [`0${localNoLeadingZeros}`] : []),
        ]),
      ).slice(0, 10);

      const usersRef = collection(firestore, 'users');
      const phoneQuery = query(
        usersRef,
        where('phone', 'in', candidates),
        limit(1),
      );
      const usersSnapshot = await getDocs(phoneQuery);

      if (usersSnapshot.empty) {
        throw new Error(
          'This phone number is not registered. Please sign up first.',
        );
      }

      const userDoc = usersSnapshot.docs[0];
      const sendOtp = httpsCallable(functions, 'sendOtp');

      await sendOtp({
        phoneNumber: String(formattedPhone),
        requireExistingUser: true,
      });

      setVerifiedUid(userDoc.id);
      setVerifiedPhone(formattedPhone);
      setPhoneOtpSent(true);
      setPhoneOtpVerified(false);
      setPhoneCooldown(60);
      notify.success('Verification code sent by SMS.', {
        id: 'forgot-phone-otp-send',
      });
    } catch (sendError) {
      notify.error(getUserFacingError(sendError, 'Could not send verification code.'), {
        id: 'forgot-phone-otp-send',
      });
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    clearMessages({ includePhoneFlow: true, includeValidation: true });

    if (!phoneOtpSent) {
      notify.error('Please request the verification code first.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    if (!phoneOtp || phoneOtp.length !== 6) {
      notify.error('Please enter the 6-digit verification code.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    setIsVerifyingPhoneOtp(true);

    try {
      const verifyOtp = httpsCallable(functions, 'verifyOtp');
      const formattedPhone = formatPhoneNumber();
      const response = await verifyOtp({
        phoneNumber: formattedPhone,
        otp: phoneOtp,
        createIfMissing: false,
      });
      const data = response.data || {};

      if (!data.success || !data.uid) {
        throw new Error('Invalid or expired OTP.');
      }

      setVerifiedUid(data.uid);
      setVerifiedPhone(formattedPhone);
      setPhoneOtpVerified(true);
      notify.success('Phone verified. Set your new password below.', {
        id: 'forgot-phone-otp-verify',
      });
    } catch (verifyError) {
      notify.error(getUserFacingError(verifyError, 'Could not verify code.'), {
        id: 'forgot-phone-otp-verify',
      });
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    clearMessages({ includeReset: true, includeValidation: true });

    if (!newPassword) {
      notify.error('Please enter a new password.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    const meetsAllRequirements = Object.values(passwordValidation).every(Boolean);

    if (!meetsAllRequirements) {
      notify.error('Please meet all password requirements.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      notify.error('Passwords do not match.', {
        id: 'forgot-password-validation',
      });
      return;
    }

    setIsResettingPassword(true);

    try {
      if (resetMethod === 'email') {
        const response = await fetch(RESET_PASSWORD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp: emailOtp,
            newPassword,
          }),
        });

        const payload = await parseJsonSafely(response);

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to reset password.');
        }
      } else {
        if (!verifiedUid || !verifiedPhone) {
          throw new Error(
            'Verification data not found. Please verify your phone number again.',
          );
        }

        const response = await fetch(UPDATE_PASSWORD_WITH_UID_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: verifiedUid,
            phoneNumber: verifiedPhone,
            newPassword,
          }),
        });

        const payload = await parseJsonSafely(response);

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to update password.');
        }
      }

      setIsResetComplete(true);
      notify.success('Password reset. Sign in with your new password.', {
        id: 'forgot-password-reset',
      });
    } catch (resetError) {
      notify.error(getUserFacingError(resetError, 'Could not reset password.'), {
        id: 'forgot-password-reset',
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const methodTabsDisabled = emailOtpSent || phoneOtpSent || canShowPasswordForm;

  if (isResetComplete) {
    return (
      <div className="min-h-screen bg-white p-4 sm:p-5">
        <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-8 lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(22rem,45vw)_1fr] lg:gap-12">
          <aside className="relative min-h-[20rem] overflow-hidden rounded-2xl bg-gray-950 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
            <img
              src="/images/SSaloon.jpg"
              alt="My Local Force services"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-gray-950/42 via-blue-950/16 to-gray-950/52" />

            <div className="relative flex h-full min-h-[20rem] flex-col justify-between p-6 text-white sm:p-8 lg:min-h-full lg:p-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/12 backdrop-blur">
                  <img
                    src="/images/MLF.jpg"
                    alt="My Local Force"
                    className="h-7 w-7 rounded object-cover"
                  />
                </div>
                <p className="text-sm font-bold">My Local Force</p>
              </div>

              <div className="max-w-md py-10 lg:py-0">
                <p className="text-sm font-bold uppercase tracking-wide text-blue-100">
                  Password reset
                </p>
                <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                  Your account is secure again.
                </h1>
                <p className="mt-4 text-base leading-7 text-white/78">
                  Use your new password to sign back in and continue with My
                  Local Force.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                  <FiShield className="mb-3 h-5 w-5 text-blue-100" />
                  <p className="text-sm font-bold">Updated</p>
                  <p className="mt-1 text-xs text-white/65">
                    Password changed
                  </p>
                </div>
                <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                  <FiLogIn className="mb-3 h-5 w-5 text-blue-100" />
                  <p className="text-sm font-bold">Ready</p>
                  <p className="mt-1 text-xs text-white/65">Login available</p>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-h-screen bg-white">
            <div className="mx-auto flex min-h-screen w-full max-w-[36rem] flex-col px-1 py-2 sm:px-4 lg:px-8">
              <div className="flex flex-1 items-center py-10 sm:py-12 lg:py-16">
                <div className="w-full">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <FiCheckCircle className="h-8 w-8" />
                  </div>
                  <h1 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
                    Password Updated
                  </h1>
                  <p className="mt-3 text-base leading-7 text-gray-700">
                    Your password has been reset successfully. Please sign in
                    with your new password.
                  </p>
                  <button
                    onClick={() => navigate('/login')}
                    className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-blue-700"
                  >
                    <FiLogIn className="h-4 w-4" />
                    Back to Login
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-5">
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-8 lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(22rem,45vw)_1fr] lg:gap-12">
        <aside className="relative min-h-[20rem] overflow-hidden rounded-2xl bg-gray-950 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
          <img
            src="/images/SSaloon.jpg"
            alt="My Local Force services"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/42 via-blue-950/16 to-gray-950/52" />

          <div className="relative flex h-full min-h-[20rem] flex-col justify-between p-6 text-white sm:p-8 lg:min-h-full lg:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/12 backdrop-blur">
                <img
                  src="/images/MLF.jpg"
                  alt="My Local Force"
                  className="h-7 w-7 rounded object-cover"
                />
              </div>
              <p className="text-sm font-bold">My Local Force</p>
            </div>

            <div className="max-w-md py-10 lg:py-0">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-100">
                Account recovery
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                Reset your password securely.
              </h1>
              <p className="mt-4 text-base leading-7 text-white/78">
                Verify your email or phone number, then create a new password
                for your account.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiMail className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Email OTP</p>
                <p className="mt-1 text-xs text-white/65">Reset by email</p>
              </div>
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiSmartphone className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Phone OTP</p>
                <p className="mt-1 text-xs text-white/65">Reset by SMS</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-h-screen bg-white">
          <div className="mx-auto flex min-h-screen w-full max-w-[38rem] flex-col px-1 py-2 sm:px-4 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition hover:text-gray-950"
              >
                <FiArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 text-base font-medium text-blue-600 transition hover:text-blue-700"
              >
                <FiLogIn className="h-4 w-4" />
                Login
              </button>
            </div>

            <div className="flex flex-1 items-center py-10 sm:py-12 lg:py-16">
              <div className="w-full">
                <div className="mb-9">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <FiLock className="h-8 w-8" />
                  </div>
                  <h1 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
                    Forgot Password?
                  </h1>
                  <p className="mt-3 text-base leading-7 text-gray-700">
                    No worries. Choose a method to reset your password.
                  </p>
                </div>

          <div className="mb-8 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setResetMethod('email')}
              disabled={methodTabsDisabled}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg font-semibold transition ${
                resetMethod === 'email'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } ${methodTabsDisabled ? 'disabled:cursor-not-allowed disabled:opacity-60' : ''}`}
            >
              <FiMail className="h-4 w-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => setResetMethod('phone')}
              disabled={methodTabsDisabled}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg font-semibold transition ${
                resetMethod === 'phone'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              } ${methodTabsDisabled ? 'disabled:cursor-not-allowed disabled:opacity-60' : ''}`}
            >
              <FiSmartphone className="h-4 w-4" />
              Phone
            </button>
          </div>

          {!canShowPasswordForm && resetMethod === 'email' && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Email Address
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        clearMessages({ includeValidation: true });
                      }}
                      disabled={emailOtpVerified}
                      className={iconInputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={
                      isSendingEmailOtp || emailCooldown > 0 || emailOtpVerified
                    }
                    className={`h-14 min-w-[8.75rem] rounded-lg px-4 font-semibold text-white transition ${
                      emailOtpVerified
                        ? 'bg-emerald-600'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {isSendingEmailOtp ? (
                      <span className="inline-flex items-center gap-2">
                        <FiRefreshCw className="h-4 w-4 animate-spin" />
                        Sending
                      </span>
                    ) : emailOtpVerified ? (
                      'Verified'
                    ) : emailCooldown > 0 ? (
                      `${emailCooldown}s`
                    ) : (
                      'Send OTP'
                    )}
                  </button>
                </div>
              </div>

              {emailOtpSent && !emailOtpVerified && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Verification Code
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={emailOtp}
                      onChange={(event) => {
                        setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                        clearMessages({ includeValidation: true });
                      }}
                      maxLength={6}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyEmailOtp}
                      disabled={isVerifyingEmailOtp}
                      className="h-14 min-w-[7.5rem] rounded-lg bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isVerifyingEmailOtp ? (
                        <span className="inline-flex items-center gap-2">
                          <FiRefreshCw className="h-4 w-4 animate-spin" />
                          Checking
                        </span>
                      ) : (
                        'Verify'
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    The code will be fully checked when you submit your new
                    password, just like in the mobile app flow.
                  </p>
                </div>
              )}
            </div>
          )}

          {!canShowPasswordForm && resetMethod === 'phone' && (
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Country Code
                </label>
                <select
                  value={selectedCountry}
                  onChange={(event) => {
                    setSelectedCountry(event.target.value);
                    clearMessages({ includeValidation: true });
                  }}
                  disabled={phoneOtpVerified}
                  className={inputClass}
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  {selectedCountry === '+61'
                    ? 'Number must start with 04 and contain exactly 10 digits.'
                    : 'Enter a 10 digit mobile number.'}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Phone Number
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="relative">
                    <FiSmartphone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      placeholder={
                        selectedCountry === '+61' ? '0412345678' : '9876543210'
                      }
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                        clearMessages({ includeValidation: true });
                      }}
                      disabled={phoneOtpVerified}
                      className={iconInputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendPhoneOtp}
                    disabled={
                      isSendingPhoneOtp || phoneCooldown > 0 || phoneOtpVerified
                    }
                    className={`h-14 min-w-[8.75rem] rounded-lg px-4 font-semibold text-white transition ${
                      phoneOtpVerified
                        ? 'bg-emerald-600'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {isSendingPhoneOtp ? (
                      <span className="inline-flex items-center gap-2">
                        <FiRefreshCw className="h-4 w-4 animate-spin" />
                        Sending
                      </span>
                    ) : phoneOtpVerified ? (
                      'Verified'
                    ) : phoneCooldown > 0 ? (
                      `${phoneCooldown}s`
                    ) : (
                      'Send OTP'
                    )}
                  </button>
                </div>
              </div>

              {phoneOtpSent && !phoneOtpVerified && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-900">
                    Verification Code
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={phoneOtp}
                      onChange={(event) => {
                        setPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                        clearMessages({ includeValidation: true });
                      }}
                      maxLength={6}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyPhoneOtp}
                      disabled={isVerifyingPhoneOtp}
                      className="h-14 min-w-[7.5rem] rounded-lg bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isVerifyingPhoneOtp ? (
                        <span className="inline-flex items-center gap-2">
                          <FiRefreshCw className="h-4 w-4 animate-spin" />
                          Verifying
                        </span>
                      ) : (
                        'Verify'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {canShowPasswordForm && (
            <form className="space-y-5" onSubmit={handleResetPassword}>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm text-emerald-700">
                    Verification successful. Set your new password.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  New Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      clearMessages({ includeValidation: true });
                    }}
                    className={`${iconInputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 transition hover:text-gray-900"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-3 text-sm font-semibold text-gray-900">
                  Password must contain:
                </p>
                <div className="space-y-2">
                  {[
                    ['At least 6 characters', passwordValidation.hasMinLength],
                    ['Uppercase letter (A-Z)', passwordValidation.hasUppercase],
                    ['Lowercase letter (a-z)', passwordValidation.hasLowercase],
                    ['Number (0-9)', passwordValidation.hasNumber],
                    ['Special character', passwordValidation.hasSpecialChar],
                  ].map(([label, isValid]) => (
                    <div key={label} className="flex items-center gap-2">
                      {isValid ? (
                        <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <FiCircle className="h-4 w-4 shrink-0 text-gray-400" />
                      )}
                      <span
                        className={`text-sm ${
                          isValid ? 'text-emerald-700' : 'text-gray-600'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Confirm Password
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      clearMessages({ includeValidation: true });
                    }}
                    className={`${iconInputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 transition hover:text-gray-900"
                    aria-label={
                      showConfirmPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isResettingPassword}
                className={`h-14 w-full rounded-lg font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition ${
                  isResettingPassword
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isResettingPassword ? (
                  <span className="inline-flex items-center gap-2">
                    <FiRefreshCw className="h-4 w-4 animate-spin" />
                    Updating Password
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}

          {(emailOtpSent || phoneOtpSent || canShowPasswordForm) && !isResetComplete && (
            <button
              type="button"
              onClick={resetCurrentFlow}
              className="mt-5 w-full text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Start Over
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-gray-600 transition hover:text-gray-950"
          >
            <FiLogIn className="h-4 w-4" />
            Back to Login
          </button>
        </div>
      </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;
