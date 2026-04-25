import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Eye, EyeOff } from 'lucide-react';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiCircle,
  FiImage,
  FiLock,
  FiMail,
  FiMapPin,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
  FiUser,
} from 'react-icons/fi';
import { auth, firestore } from '../../services/firebase/firebaseConfig';
import { uploadProfileImage } from '../../services/firebase/profileImageUpload';
import { isValidEmail } from '../../utils/helpers';
import AddressAutocompleteField from '../../components/AddressAutocompleteField';
import { useAuth } from '../../context/AuthContext';
import {
  COUNTRY_OPTIONS,
  DAYS,
  GENDER_OPTIONS,
  MONTHS,
  YEARS,
  buildDobString,
  fetchUserByEmail,
  fetchUserByPhone,
  formatPhoneNumber,
  getDobValidation,
  getPasswordValidation,
  getRoleConflictMessage,
  getRoleDisplayName,
  sendEmailOtp,
  sendPhoneOtp,
  validatePhoneNumber,
  verifySignupPhoneOtp,
} from './signupShared';
import { getProviderFlowPath } from '../../utils/providerFlow';
import { notify, getUserFacingError } from '../../utils/toast';

const TERMS_URL = 'https://mylocalforce.app/terms';
const SIGNUP_TOAST_DURATION = 12000;
const SIGNUP_SUCCESS_TOAST_DURATION = 15000;

const toastOptions = (id, duration = SIGNUP_TOAST_DURATION) => ({
  id,
  duration,
});

const inputClass =
  'w-full h-14 px-5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
const iconInputClass =
  'w-full h-14 px-5 pl-12 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.04)] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
const selectClass = `${inputClass} appearance-auto`;

const FormSection = ({ step, title, children }) => (
  <section className="border-t border-gray-100 pt-9 first:border-t-0 first:pt-0">
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Step {step}
      </p>
      <h2 className="mt-1 text-xl font-bold text-gray-950 sm:text-2xl">
        {title}
      </h2>
    </div>
    {children}
  </section>
);

const SignupFormScreen = ({ mode }) => {
  const navigate = useNavigate();
  const { authenticateWithLinkedAccount } = useAuth();
  const isProvider = mode === 'provider';
  const targetRole = isProvider ? 'client' : 'customer';
  const signupRole = isProvider ? 'provider' : 'customer';
  const roleLabel = isProvider ? 'Service Provider' : 'Customer';

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    day: '',
    month: '',
    year: '',
    gender: '',
    address: '',
    addressLat: '',
    addressLng: '',
    formattedAddress: '',
    address_place_id: '',
  });
  const [selectedCountry, setSelectedCountry] = useState('');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [emailVerification, setEmailVerification] = useState({
    isVerifying: false,
    emailOtp: '',
    isEmailVerified: false,
  });
  const [phoneVerification, setPhoneVerification] = useState({
    isVerifying: false,
    phoneOtp: '',
    isPhoneVerified: false,
    isVerifyingOtp: false,
  });

  const [emailCooldown, setEmailCooldown] = useState(0);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  React.useEffect(() => {
    if (emailCooldown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setEmailCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [emailCooldown]);

  React.useEffect(() => {
    if (phoneCooldown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setPhoneCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [phoneCooldown]);

  const passwordValidation = useMemo(
    () => getPasswordValidation(formData.password),
    [formData.password],
  );

  const clearMessages = ({
    includeValidation = false,
    includeEmailOtp = false,
    includePhoneOtp = false,
    includeSubmit = false,
  } = {}) => {
    if (includeValidation) {
      notify.dismiss('signup-form-validation');
    }

    if (includeEmailOtp) {
      notify.dismiss('signup-email-otp-send');
      notify.dismiss('signup-email-otp-verify');
    }

    if (includePhoneOtp) {
      notify.dismiss('signup-phone-otp-send');
      notify.dismiss('signup-phone-otp-verify');
    }

    if (includeSubmit) {
      notify.dismiss('signup-submit');
    }
  };

  const updateFormData = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleEmailChange = (value) => {
    updateFormData('email', value);

    if (emailVerification.isVerifying || emailVerification.isEmailVerified) {
      setEmailVerification({
        isVerifying: false,
        emailOtp: '',
        isEmailVerified: false,
      });
      setEmailCooldown(0);
    }
  };

  const handlePhoneChange = (value) => {
    updateFormData('phoneNumber', value.replace(/[^0-9]/g, '').slice(0, 10));

    if (phoneVerification.isVerifying || phoneVerification.isPhoneVerified) {
      setPhoneVerification({
        isVerifying: false,
        phoneOtp: '',
        isPhoneVerified: false,
        isVerifyingOtp: false,
      });
      setPhoneCooldown(0);
    }
  };

  const handleCountryChange = (value) => {
    setSelectedCountry(value);

    if (phoneVerification.isVerifying || phoneVerification.isPhoneVerified) {
      setPhoneVerification({
        isVerifying: false,
        phoneOtp: '',
        isPhoneVerified: false,
        isVerifyingOtp: false,
      });
      setPhoneCooldown(0);
    }
  };

  const handleAddressSelect = (address) => {
    updateFormData(
      'address',
      (address.formattedAddress || address.fullAddress || '').trim(),
    );
    updateFormData('formattedAddress', address.formattedAddress || '');
    updateFormData('address_place_id', address.place_id || '');
    updateFormData(
      'addressLat',
      address.latitude != null ? String(address.latitude) : '',
    );
    updateFormData(
      'addressLng',
      address.longitude != null ? String(address.longitude) : '',
    );
  };

  const handleImageChange = (event) => {
    clearMessages();

    const file = event.target.files?.[0] || null;
    setProfileImageFile(file);

    if (!file) {
      setProfileImagePreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setProfileImagePreview(objectUrl);
  };

  const handleSendEmailOtp = async () => {
    clearMessages({ includeValidation: true });

    if (!formData.email.trim()) {
      notify.error(
        'Please enter your email address.',
        toastOptions('signup-email-otp-send'),
      );
      return;
    }

    if (!isValidEmail(formData.email.trim())) {
      notify.error(
        'Please enter a valid email address.',
        toastOptions('signup-email-otp-send'),
      );
      return;
    }

    setIsSendingEmailOtp(true);

    try {
      const existingUser = await fetchUserByEmail(formData.email);
      const conflictMessage = getRoleConflictMessage(
        existingUser?.data?.roles,
        targetRole,
      );

      if (conflictMessage) {
        throw new Error(conflictMessage);
      }

      await sendEmailOtp(formData.email);
      setEmailVerification({
        isVerifying: true,
        emailOtp: '',
        isEmailVerified: false,
      });
      setEmailCooldown(60);
      notify.success(
        `Verification code sent to ${formData.email.trim().toLowerCase()}.`,
        toastOptions('signup-email-otp-send'),
      );
    } catch (sendError) {
      notify.error(
        getUserFacingError(sendError, 'Could not send email code.'),
        toastOptions('signup-email-otp-send'),
      );
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = () => {
    clearMessages({ includeValidation: true });

    if (!emailVerification.emailOtp || emailVerification.emailOtp.length !== 6) {
      notify.error(
        'Please enter the 6-digit email OTP.',
        toastOptions('signup-email-otp-verify'),
      );
      return;
    }

    setEmailVerification((current) => ({
      ...current,
      isEmailVerified: true,
    }));
    notify.success(
      'Email verified. Please finish your registration.',
      toastOptions('signup-email-otp-verify'),
    );
  };

  const handleSendPhoneOtp = async () => {
    clearMessages({ includeValidation: true });

    const phoneValidation = validatePhoneNumber(
      selectedCountry,
      formData.phoneNumber,
    );

    if (!phoneValidation.valid) {
      notify.error(
        phoneValidation.message,
        toastOptions('signup-phone-otp-send'),
      );
      return;
    }

    setIsSendingPhoneOtp(true);

    try {
      const existingUser = await fetchUserByPhone(
        selectedCountry,
        formData.phoneNumber,
      );
      const conflictMessage = getRoleConflictMessage(
        existingUser?.data?.roles,
        targetRole,
      );

      if (conflictMessage) {
        throw new Error(conflictMessage);
      }

      const formattedPhone = formatPhoneNumber(
        selectedCountry,
        formData.phoneNumber,
      );
      await sendPhoneOtp(formattedPhone);
      setPhoneVerification({
        isVerifying: true,
        phoneOtp: '',
        isPhoneVerified: false,
        isVerifyingOtp: false,
      });
      setPhoneCooldown(60);
      notify.success('Verification code sent to your phone.', {
        ...toastOptions('signup-phone-otp-send'),
      });
    } catch (sendError) {
      notify.error(
        getUserFacingError(sendError, 'Could not send phone code.'),
        toastOptions('signup-phone-otp-send'),
      );
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    clearMessages({ includeValidation: true });

    if (!phoneVerification.phoneOtp || phoneVerification.phoneOtp.length !== 6) {
      notify.error(
        'Please enter the 6-digit phone OTP.',
        toastOptions('signup-phone-otp-verify'),
      );
      return;
    }

    if (!phoneVerification.isVerifying) {
      notify.error(
        'Please request the phone OTP first.',
        toastOptions('signup-phone-otp-verify'),
      );
      return;
    }

    const phoneValidation = validatePhoneNumber(
      selectedCountry,
      formData.phoneNumber,
    );

    if (!phoneValidation.valid) {
      notify.error(
        phoneValidation.message,
        toastOptions('signup-phone-otp-verify'),
      );
      return;
    }

    setPhoneVerification((current) => ({
      ...current,
      isVerifyingOtp: true,
    }));

    try {
      const formattedPhone = formatPhoneNumber(
        selectedCountry,
        formData.phoneNumber,
      );
      const response = await verifySignupPhoneOtp({
        phoneNumber: formattedPhone,
        otp: phoneVerification.phoneOtp,
        email: formData.email.trim().toLowerCase(),
        signupRole,
      });

      const verified =
        response?.success === true ||
        response?.verified === true ||
        Boolean(response?.token);

      if (!verified) {
        throw new Error(response?.message || response?.error || 'Verification failed.');
      }

      setPhoneVerification((current) => ({
        ...current,
        isPhoneVerified: true,
        isVerifyingOtp: false,
      }));
      notify.success('Phone verified. Please finish your registration.', {
        ...toastOptions('signup-phone-otp-verify'),
      });
    } catch (verifyError) {
      setPhoneVerification((current) => ({
        ...current,
        isVerifyingOtp: false,
      }));
      notify.error(
        getUserFacingError(verifyError, 'Could not verify phone code.'),
        toastOptions('signup-phone-otp-verify'),
      );
    }
  };

  const validateForm = () => {
    if (!formData.firstName.trim()) {
      return 'Please enter your first name.';
    }

    if (!formData.lastName.trim()) {
      return 'Please enter your last name.';
    }

    if (!formData.email.trim()) {
      return 'Please enter your email address.';
    }

    if (!isValidEmail(formData.email.trim())) {
      return 'Please enter a valid email address.';
    }

    if (!emailVerification.isEmailVerified) {
      return 'Please verify your email with OTP.';
    }

    if (!selectedCountry) {
      return 'Please select your country code.';
    }

    const phoneValidation = validatePhoneNumber(
      selectedCountry,
      formData.phoneNumber,
    );

    if (!phoneValidation.valid) {
      return phoneValidation.message;
    }

    if (!phoneVerification.isPhoneVerified) {
      return 'Please verify your phone number with OTP.';
    }

    if (!formData.password) {
      return 'Please enter a password.';
    }

    if (!Object.values(passwordValidation).every(Boolean)) {
      return 'Please meet all password requirements.';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match.';
    }

    const dobValidation = getDobValidation(
      formData.day,
      formData.month,
      formData.year,
    );

    if (!dobValidation.valid) {
      return dobValidation.message;
    }

    if (!formData.gender) {
      return 'Please select your gender.';
    }

    if (isProvider && !formData.address.trim()) {
      return 'Please enter your address.';
    }

    if (isProvider && !profileImageFile) {
      return 'Profile image is required for service providers.';
    }

    if (!acceptedTerms) {
      return 'Please accept the Terms & Conditions to continue.';
    }

    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearMessages({ includeValidation: true });

    const validationMessage = validateForm();

    if (validationMessage) {
      notify.error(validationMessage, {
        id: 'signup-form-validation',
        duration: SIGNUP_TOAST_DURATION,
      });
      return;
    }

    setIsSubmitting(true);

    const emailLower = formData.email.trim().toLowerCase();
    const formattedPhone = formatPhoneNumber(
      selectedCountry,
      formData.phoneNumber,
    );

    try {
      let user = auth.currentUser;

      if (user && user.email && user.email.toLowerCase() !== emailLower) {
        await signOut(auth);
        user = null;
      }

      if (user && user.email?.toLowerCase() === emailLower) {
        const providers = user.providerData.map((provider) => provider.providerId);

        if (!providers.includes('password')) {
          const credential = EmailAuthProvider.credential(
            emailLower,
            formData.password,
          );
          await linkWithCredential(user, credential);
          await user.reload();
          user = auth.currentUser;
        }
      }

      if (!user) {
        try {
          const credential = await createUserWithEmailAndPassword(
            auth,
            emailLower,
            formData.password,
          );
          user = credential.user;
        } catch (createError) {
          if (createError.code === 'auth/email-already-in-use') {
            try {
              const credential = await signInWithEmailAndPassword(
                auth,
                emailLower,
                formData.password,
              );
              user = credential.user;
            } catch (signInError) {
              if (
                signInError.code === 'auth/wrong-password' ||
                signInError.code === 'auth/invalid-credential'
              ) {
                const existingEmailUser = await fetchUserByEmail(emailLower);
                const existingRole = getRoleDisplayName(
                  existingEmailUser?.data?.roles || {},
                );
                throw new Error(
                  `This email is already registered as ${existingRole}. To add ${roleLabel}, please use the same password you used for your ${existingRole} account.`,
                );
              }

              throw signInError;
            }
          } else if (createError.code === 'auth/weak-password') {
            throw new Error('Password is too weak. Please use a stronger password.');
          } else if (createError.code === 'auth/invalid-email') {
            throw new Error('Invalid email address format.');
          } else {
            throw createError;
          }
        }
      }

      if (!user?.uid) {
        throw new Error('Authentication failed. Please try again.');
      }

      let photoURL = null;

      if (profileImageFile) {
        photoURL = await uploadProfileImage(user.uid, profileImageFile);
      }

      const userRef = doc(firestore, 'users', user.uid);
      const existingUserSnap = await getDoc(userRef);
      const existingUserData = existingUserSnap.exists()
        ? existingUserSnap.data()
        : {};
      const existingRoles = existingUserData.roles || {};

      if (existingRoles[targetRole]) {
        throw new Error(
          `A ${roleLabel.toLowerCase()} account already exists for this user. Please log in instead.`,
        );
      }

      const userData = {
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
        email: emailLower,
        phone: formattedPhone,
        dob: buildDobString(formData.day, formData.month, formData.year),
        gender: formData.gender,
        address: formData.address?.trim() || '',
        ...(formData.addressLat && formData.addressLng
          ? {
              location: {
                latitude: Number(formData.addressLat),
                longitude: Number(formData.addressLng),
              },
            }
          : {}),
        ...(formData.formattedAddress
          ? { formattedAddress: formData.formattedAddress }
          : {}),
        ...(formData.address_place_id
          ? { address_place_id: formData.address_place_id }
          : {}),
        activeRole: targetRole,
        roles: {
          ...existingRoles,
          [targetRole]: true,
        },
        approvalStatus:
          isProvider || existingUserData.approvalStatus === 'pending'
            ? 'pending'
            : 'approved',
        updatedAt: new Date().toISOString(),
        ...(photoURL ? { photoURL } : {}),
      };

      if (!existingUserSnap.exists()) {
        userData.createdAt = new Date().toISOString();
        userData.totalEarnings = 0;
        userData.pendingEarnings = 0;
        userData.receivedEarnings = 0;
      } else if (existingUserData.createdAt) {
        userData.createdAt = existingUserData.createdAt;
      }

      await setDoc(userRef, userData, { merge: true });

      await authenticateWithLinkedAccount?.({
        uid: user.uid,
        email: emailLower,
        phone: formattedPhone,
        phoneNumber: formattedPhone,
        emailVerified: user.emailVerified,
        ...userData,
      });

      if (isProvider) {
        const providerPath = getProviderFlowPath({ profile: userData });
        notify.success(
          'Account created.',
          toastOptions('signup-submit', SIGNUP_SUCCESS_TOAST_DURATION),
        );
        navigate(providerPath, {
          replace: true,
          state: {
            newSignup: !existingUserSnap.exists(),
          },
        });
        return;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 300);
      });

      notify.success(
        'Account created.',
        toastOptions('signup-submit', SIGNUP_SUCCESS_TOAST_DURATION),
      );
      navigate('/customer', { replace: true });
    } catch (submitError) {
      notify.error(
        getUserFacingError(submitError, 'Could not create your account. Please try again.'),
        toastOptions('signup-submit')
      );

      try {
        if (auth.currentUser?.email?.toLowerCase() === emailLower) {
          await signOut(auth);
        }
      } catch (signOutError) {
        // Ignore cleanup failures.
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const heroImage = '/images/SSaloon.jpg';
  const panelTitle = isProvider
    ? 'Create Provider Account'
    : 'Create Customer Account';
  const panelSubtitle = isProvider
    ? 'Complete signup first, then continue into provider onboarding.'
    : 'Create your customer profile and start booking trusted local services.';
  const pageSubtitle = isProvider
    ? 'Please provide the following details to create your provider account and continue to onboarding.'
    : 'Please provide the following details to create your personal account and start booking services.';

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-5">
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-8 lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(22rem,45vw)_1fr] lg:gap-12">
        <aside className="relative min-h-[20rem] overflow-hidden rounded-2xl bg-gray-950 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
          <img
            src={heroImage}
            alt={roleLabel}
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
              <div>
                <p className="text-sm font-bold">My Local Force</p>
              </div>
            </div>

            <div className="max-w-md py-10 lg:py-0">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-100">
                {roleLabel} Signup
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                {panelTitle}
              </h1>
              <p className="mt-4 text-base leading-7 text-white/78">
                {panelSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiMail className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Email OTP</p>
                <p className="mt-1 text-xs text-white/65">Required</p>
              </div>
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiSmartphone className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Phone OTP</p>
                <p className="mt-1 text-xs text-white/65">Required</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-h-screen bg-gray-50">
          <div className="mx-auto flex min-h-screen w-full max-w-[56rem] flex-col px-1 py-2 sm:px-4 lg:px-8">
            <div className="flex justify-end">
              <button
                onClick={() => navigate('/signup-selection')}
                className="inline-flex items-center gap-2 text-base font-medium text-blue-600 transition hover:text-blue-700"
              >
                <FiArrowLeft className="h-4 w-4" />
                Go Back
              </button>
            </div>

            <div className="flex-1 py-8 sm:py-12 lg:py-16">
              <div className="mb-10">
                <h2 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
                  Create a New Account
                </h2>
                <p className="mt-3 text-base leading-7 text-gray-700">
                  {pageSubtitle}
                </p>
              </div>

              <form className="space-y-9" onSubmit={handleSubmit}>
                <FormSection icon={FiUser} step="01" title="Basic Information">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(event) => {
                          updateFormData('firstName', event.target.value);
                          clearMessages();
                        }}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(event) => {
                          updateFormData('lastName', event.target.value);
                          clearMessages();
                        }}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection icon={FiMail} step="02" title="Verify Email">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Email Address *
                      </label>
                      <div className="relative">
                        <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(event) =>
                            handleEmailChange(event.target.value)
                          }
                          className={iconInputClass}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={
                        isSendingEmailOtp ||
                        emailCooldown > 0 ||
                        emailVerification.isEmailVerified
                      }
                      className={`h-14 w-full md:w-40 px-4 rounded-lg font-semibold text-white transition ${
                        emailVerification.isEmailVerified
                          ? 'bg-emerald-600'
                          : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {isSendingEmailOtp ? (
                        <span className="inline-flex items-center gap-2">
                          <FiRefreshCw className="w-4 h-4 animate-spin" />
                          Sending
                        </span>
                      ) : emailVerification.isEmailVerified ? (
                        'Verified'
                      ) : emailCooldown > 0 ? (
                        `${emailCooldown}s`
                      ) : (
                        'Send OTP'
                      )}
                    </button>
                  </div>

                  {emailVerification.isVerifying &&
                    !emailVerification.isEmailVerified && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Email OTP *
                          </label>
                          <input
                            type="text"
                            value={emailVerification.emailOtp}
                            onChange={(event) =>
                              setEmailVerification((current) => ({
                                ...current,
                                emailOtp: event.target.value
                                  .replace(/\D/g, '')
                                  .slice(0, 6),
                              }))
                            }
                            className={inputClass}
                            placeholder="Enter 6-digit OTP"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleVerifyEmailOtp}
                          className="h-14 w-full md:w-32 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
                        >
                          Verify
                        </button>
                      </div>
                    )}
                </FormSection>

                <FormSection icon={FiSmartphone} step="03" title="Verify Phone">
                  <div className="grid grid-cols-1 md:grid-cols-[13rem_1fr_auto] gap-4 items-end">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Country Code *
                      </label>
                      <select
                        value={selectedCountry}
                        onChange={(event) =>
                          handleCountryChange(event.target.value)
                        }
                        className={selectClass}
                      >
                        <option value="">Select</option>
                        {COUNTRY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <FiSmartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={(event) =>
                            handlePhoneChange(event.target.value)
                          }
                          className={iconInputClass}
                          placeholder={
                            selectedCountry === '+61'
                              ? '0412345678'
                              : '9876543210'
                          }
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={
                        isSendingPhoneOtp ||
                        phoneCooldown > 0 ||
                        phoneVerification.isPhoneVerified
                      }
                      className={`h-14 w-full md:w-40 px-4 rounded-lg font-semibold text-white transition ${
                        phoneVerification.isPhoneVerified
                          ? 'bg-emerald-600'
                          : 'bg-blue-600 hover:bg-blue-700'
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {isSendingPhoneOtp ? (
                        <span className="inline-flex items-center gap-2">
                          <FiRefreshCw className="w-4 h-4 animate-spin" />
                          Sending
                        </span>
                      ) : phoneVerification.isPhoneVerified ? (
                        'Verified'
                      ) : phoneCooldown > 0 ? (
                        `${phoneCooldown}s`
                      ) : (
                        'Send OTP'
                      )}
                    </button>
                  </div>

                  {phoneVerification.isVerifying &&
                    !phoneVerification.isPhoneVerified && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Phone OTP *
                          </label>
                          <input
                            type="text"
                            value={phoneVerification.phoneOtp}
                            onChange={(event) =>
                              setPhoneVerification((current) => ({
                                ...current,
                                phoneOtp: event.target.value
                                  .replace(/\D/g, '')
                                  .slice(0, 6),
                              }))
                            }
                            className={inputClass}
                            placeholder="Enter 6-digit OTP"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleVerifyPhoneOtp}
                          disabled={phoneVerification.isVerifyingOtp}
                          className="h-14 w-full md:w-32 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {phoneVerification.isVerifyingOtp ? (
                            <span className="inline-flex items-center gap-2">
                              <FiRefreshCw className="w-4 h-4 animate-spin" />
                              Checking
                            </span>
                          ) : (
                            'Verify'
                          )}
                        </button>
                      </div>
                    )}
                </FormSection>

                <FormSection icon={FiLock} step="04" title="Security">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(event) => {
                            updateFormData('password', event.target.value);
                            clearMessages();
                          }}
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(event) => {
                            updateFormData('confirmPassword', event.target.value);
                            clearMessages();
                          }}
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword((current) => !current)
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                          aria-label={
                            showConfirmPassword
                              ? 'Hide confirm password'
                              : 'Show confirm password'
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
                  </div>

                  <div className="mt-5 rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      Password must contain
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        ['At least 6 characters', passwordValidation.hasMinLength],
                        ['Uppercase letter (A-Z)', passwordValidation.hasUppercase],
                        ['Lowercase letter (a-z)', passwordValidation.hasLowercase],
                        ['Number (0-9)', passwordValidation.hasNumber],
                        ['Special character', passwordValidation.hasSpecialChar],
                      ].map(([label, isValid]) => (
                        <div key={label} className="flex items-center gap-2">
                          {isValid ? (
                            <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <FiCircle className="w-4 h-4 text-gray-400 shrink-0" />
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
                </FormSection>

                <FormSection icon={FiMapPin} step="05" title="Personal Details">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Day *
                      </label>
                      <select
                        value={formData.day}
                        onChange={(event) =>
                          updateFormData('day', event.target.value)
                        }
                        className={selectClass}
                      >
                        <option value="">Day</option>
                        {DAYS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Month *
                      </label>
                      <select
                        value={formData.month}
                        onChange={(event) =>
                          updateFormData('month', event.target.value)
                        }
                        className={selectClass}
                      >
                        <option value="">Month</option>
                        {MONTHS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Year *
                      </label>
                      <select
                        value={formData.year}
                        onChange={(event) =>
                          updateFormData('year', event.target.value)
                        }
                        className={selectClass}
                      >
                        <option value="">Year</option>
                        {YEARS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Gender *
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(event) =>
                        updateFormData('gender', event.target.value)
                      }
                      className={selectClass}
                    >
                      <option value="">Select gender</option>
                      {GENDER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4">
                    <AddressAutocompleteField
                      value={formData.address}
                      onValueChange={(value) => updateFormData('address', value)}
                      onAddressSelect={handleAddressSelect}
                      required={isProvider}
                    />
                  </div>
                </FormSection>

                <FormSection icon={FiImage} step="06" title="Profile Image">
                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <div className="border border-dashed border-gray-300 rounded-xl p-5 hover:border-blue-400 hover:bg-blue-50/40 transition">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                          {profileImagePreview ? (
                            <img
                              src={profileImagePreview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FiImage className="w-7 h-7 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {profileImageFile
                              ? profileImageFile.name
                              : `Choose profile image ${
                                  isProvider ? '*' : '(optional)'
                                }`}
                          </p>
                          <p className="text-sm text-gray-500">
                            JPG, PNG, or WEBP
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                </FormSection>

                <div className="border-t border-gray-100 pt-7 space-y-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) => setAcceptedTerms(event.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      I agree to the{' '}
                      <a
                        href={TERMS_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Terms & Conditions
                      </a>
                      .
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full h-14 rounded-lg font-semibold text-white transition ${
                      isSubmitting
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <FiRefreshCw className="w-4 h-4 animate-spin" />
                        Creating Account
                      </span>
                    ) : (
                      `Create ${roleLabel} Account`
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8 text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => navigate('/login')}
                    className="font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Login
                  </button>
                </p>
              </div>
            </div>
          </div>
          </main>
        </div>
      </div>
  );
};

export default SignupFormScreen;
