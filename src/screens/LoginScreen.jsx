import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth as webAuth, functions } from '../services/firebase/firebaseConfig';
import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { firestore } from '../services/firebase/firebaseConfig';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getSignedInHomePath } from '../utils/providerFlow';
import { notify, getUserFacingError } from '../utils/toast';
import {
  FiArrowRight,
  FiHome,
  FiLock,
  FiLogIn,
  FiMail,
  FiShield,
  FiSmartphone,
  FiUserPlus,
} from 'react-icons/fi';

const inputClass =
  'h-14 w-full rounded-lg border border-gray-300 bg-white px-5 text-gray-900 placeholder-gray-500 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100';

const iconInputClass =
  'h-14 w-full rounded-lg border border-gray-300 bg-white px-5 pl-12 text-gray-900 placeholder-gray-500 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100';

const LoginScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthenticated,
    login,
    user,
    userRoles,
    activeRole,
    isLoading: authLoading,
  } = useAuth();
  const redirectTo = location.state?.redirectTo;

  // Redirect if already authenticated (handled via useEffect to avoid hooks violation)
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      return;
    }

    if (redirectTo) {
      navigate(redirectTo, {
        state: location.state?.params || {},
        replace: true,
      });
      return;
    }

    navigate(
      getSignedInHomePath({
        user,
        roles: userRoles?.roles,
        activeRole,
      }),
      { replace: true },
    );
  }, [
    authLoading,
    isAuthenticated,
    user,
    userRoles,
    activeRole,
    redirectTo,
    navigate,
    location.state,
  ]);
  
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneInput, setPhoneInput] = useState(''); // Raw input (without country code)
  const [formattedPhone, setFormattedPhone] = useState(''); // Full E.164 format (with country code)
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  const [selectedCountry, setSelectedCountry] = useState('+91'); // Default India
  const countryOptions = [
    { label: '🇮🇳 India (+91)', value: '+91' },
    { label: '🇦🇺 Australia (+61)', value: '+61' },
  ];

  useEffect(() => {
    if (location.state?.prefillEmail) {
      setEmail(location.state.prefillEmail);
      setLoginMethod('email');
    }

    if (location.state?.signupMessage) {
      notify.success(location.state.signupMessage, {
        id: 'login-signup-message',
      });
    }
  }, [location.state]);

  // Country code selection

  // Countdown timer for OTP resend
  useEffect(() => {
    if (phoneCooldown > 0) {
      const timer = setTimeout(() => setPhoneCooldown(phoneCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneCooldown]);

  const clearMessages = ({
    includeValidation = false,
    includeEmail = false,
    includePhoneOtpSend = false,
    includePhoneOtpVerify = false,
  } = {}) => {
    if (includeValidation) {
      notify.dismiss('login-validation');
    }

    if (includeEmail) {
      notify.dismiss('login-email');
    }

    if (includePhoneOtpSend) {
      notify.dismiss('login-phone-otp-send');
    }

    if (includePhoneOtpVerify) {
      notify.dismiss('login-phone-otp-verify');
    }
  };

  const handleEmailLogin = async () => {
    clearMessages({ includeValidation: true, includeEmail: true });
    if (!email || !password) {
      notify.error('Please enter both email and password.', {
        id: 'login-validation',
      });
      return;
    }

    if (!email.includes('@')) {
      notify.error('Please enter a valid email address.', {
        id: 'login-validation',
      });
      return;
    }

    if (password.length < 6) {
      notify.error('Password must be at least 6 characters long.', {
        id: 'login-validation',
      });
      return;
    }

    // Check if email exists in Firestore before attempting login
    try {
      const emailLower = email.trim().toLowerCase();
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', emailLower), limit(1));
      const usersSnapshot = await getDocs(q);

      if (usersSnapshot.empty) {
        notify.warning('No account found with this email. Please sign up.', {
          id: 'login-email',
        });
        return;
      }
    } catch (lookupError) {
      console.error('Email lookup error:', lookupError);
      // Proceed to attempt login; don't block user if lookup fails
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        notify.success('Signed in.', { id: 'login-email' });
        return;
      } else {
        // Check if it's an approval status error
        if (result.error && result.error.includes('pending')) {
          notify.warning('Your provider account is still under review.', {
            id: 'login-email',
          });
        } else {
          const errorMessage = getErrorMessage(result.error);
          notify.error(errorMessage, { id: 'login-email' });
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error.message || error.code);
      notify.error(getUserFacingError(error, errorMessage), { id: 'login-email' });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to convert error codes to user-friendly messages
  const getErrorMessage = error => {
    if (!error) return 'An unexpected error occurred. Please try again.';

    const errorString = error.toString().toLowerCase();

    // Firebase Auth error codes - for credential errors, return empty string since title says it all
    if (errorString.includes('auth/invalid-credential')) {
      return 'Please check your username or password and try again.';
    }
    if (errorString.includes('auth/user-not-found')) {
      return 'Please check your username or password and try again.';
    }
    if (errorString.includes('auth/wrong-password')) {
      return 'Please check your username or password and try again.';
    }
    if (errorString.includes('auth/user-disabled')) {
      return 'This account has been disabled. Please contact support.';
    }
    if (errorString.includes('auth/too-many-requests')) {
      return 'Too many failed login attempts. Please try again later or reset your password.';
    }
    if (errorString.includes('auth/invalid-email')) {
      return 'Invalid email format. Please enter a valid email address.';
    }
    if (errorString.includes('auth/network-request-failed')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    if (errorString.includes('auth/email-already-in-use')) {
      return 'This email is already registered. Please login instead.';
    }
    if (errorString.includes('auth/weak-password')) {
      return 'Password is too weak. Please use at least 6 characters.';
    }
    if (errorString.includes('auth/invalid-verification-code')) {
      return 'Invalid verification code. Please check the code and try again.';
    }
    if (errorString.includes('auth/code-expired')) {
      return 'Verification code has expired. Please request a new code.';
    }
    if (errorString.includes('auth/invalid-phone-number')) {
      return 'Invalid phone number. Please enter a valid phone number.';
    }
    if (errorString.includes('auth/missing-phone-number')) {
      return 'Phone number is required. Please enter your phone number.';
    }
    if (errorString.includes('auth/quota-exceeded')) {
      return 'SMS quota exceeded. Please try again later.';
    }
    if (
      errorString.includes('invalid otp') ||
      errorString.includes('wrong otp')
    ) {
      return 'Invalid OTP. Please check the code and try again.';
    }
    if (errorString.includes('expired')) {
      return 'Your session has expired. Please try again.';
    }

    // Generic error message
    return 'Login failed. Please check your username or password and try again.';
  };

  const handlePhoneLogin = async () => {
    clearMessages({
      includeValidation: true,
      includePhoneOtpSend: true,
      includePhoneOtpVerify: true,
    });
    // Ensure phone is provided
    if (!phoneInput) {
      notify.error('Please enter your phone number.', { id: 'login-validation' });
      return;
    }

    // If OTP not yet sent, format and send
    if (!otpSent) {
      // Normalize and format phone to E.164 format using selected country code
      let phoneE164 = phoneInput.trim().replace(/[^0-9]/g, ''); // Remove non-digits
      // Remove leading zeros
      phoneE164 = phoneE164.replace(/^0+/, '');
      phoneE164 = selectedCountry + phoneE164;

      setIsLoading(true);
      try {
        if (!phoneE164) {
          notify.error('Invalid phone number.', { id: 'login-validation' });
          return;
        }
        // Check if phone number is registered in Firestore before sending OTP
        try {
          const cleanedInput = phoneInput.trim().replace(/[^0-9]/g, '');
          const localNoLeadingZeros = cleanedInput.replace(/^0+/, '');
          const countryDigits = selectedCountry.replace('+', '');
          const e164 = selectedCountry + localNoLeadingZeros;
          const e164NoPlus = e164.replace('+', '');
          const candidates = Array.from(
            new Set([
              e164,
              e164NoPlus,
              localNoLeadingZeros,
              cleanedInput,
              ...(selectedCountry === '+61' ? ['0' + localNoLeadingZeros] : []),
            ]),
          ).slice(0, 10);

          const usersRef = collection(firestore, 'users');
          const q = query(usersRef, where('phone', 'in', candidates), limit(1));
          const usersSnapshot = await getDocs(q);

          if (usersSnapshot.empty) {
            notify.warning('No account found with this phone number. Please sign up.', {
              id: 'login-phone-otp-send',
            });
            return;
          }

          const userDoc = usersSnapshot.docs[0];
          const userUid = userDoc.id;
          console.log('Found user in database with UID:', userUid);
        } catch (lookupError) {
          console.error('Phone lookup error:', lookupError);
          notify.error('Unable to verify phone number. Please try again later.', {
            id: 'login-phone-otp-send',
          });
          return;
        }

        // Call Cloud Function to send OTP
        const sendOtpFn = httpsCallable(functions, 'sendOtp');
        await sendOtpFn({
          phoneNumber: String(phoneE164),
          requireExistingUser: true,
        });

        // Store the formatted phone (with country code) for later verification
        setFormattedPhone(phoneE164);
        setOtpSent(true);
        setPhoneCooldown(60);
        notify.success('Verification code sent.', { id: 'login-phone-otp-send' });
      } catch (error) {
        console.error('OTP send error:', error);
        const errorMessage = getErrorMessage(error.message || error.code);
        notify.error(getUserFacingError(error, errorMessage), {
          id: 'login-phone-otp-send',
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // OTP already sent -> verify using the stored formattedPhone (already has country code)
    if (!otp) {
      notify.error('Please enter the 6-digit verification code.', {
        id: 'login-validation',
      });
      return;
    }

    if (otp.length !== 6) {
      notify.error('Please enter the complete 6-digit verification code.', {
        id: 'login-validation',
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Verifying OTP for phone:', formattedPhone);
      const verifyOtpFn = httpsCallable(functions, 'verifyOtp');
      const res = await verifyOtpFn({
        phoneNumber: formattedPhone,
        otp,
        createIfMissing: false,
      });
      const data = res && res.data ? res.data : {};

      console.log('verifyOtp response:', data);

      if (data && data.token) {
        console.log('Signing in with custom token...');
        // Ensure phone exists in Firestore before signing in
        try {
          const digitsOnly = formattedPhone.replace(/[^0-9]/g, '');
          const countryDigits = selectedCountry.replace('+', '');
          const localNoCountry = digitsOnly.replace(
            new RegExp('^' + countryDigits),
            '',
          );
          const candidatesPost = Array.from(
            new Set([
              formattedPhone,
              digitsOnly,
              localNoCountry,
              ...(selectedCountry === '+61' ? ['0' + localNoCountry] : []),
            ]),
          ).slice(0, 10);

          const usersRef = collection(firestore, 'users');
          const q = query(usersRef, where('phone', 'in', candidatesPost), limit(1));
          const usersSnapshotPost = await getDocs(q);

          if (usersSnapshotPost.empty) {
            notify.error(
              'No account found with this phone number in the database. Please sign up.',
              { id: 'login-phone-otp-verify' },
            );
            return;
          }
        } catch (lookupError) {
          console.error('Post-verify phone lookup error:', lookupError);
          notify.error('Unable to verify phone in database. Please try again later.', {
            id: 'login-phone-otp-verify',
          });
          return;
        }

        // Sign in with Web SDK - this triggers AuthContext's onAuthStateChanged
        await signInWithCustomToken(webAuth, data.token);
        console.log('Sign in successful!');
        
        // Reset states
        setOtp('');
        setOtpSent(false);
        setPhoneInput('');
        setFormattedPhone('');
        notify.success('Signed in.', { id: 'login-phone-otp-verify' });
        return;
      }

      notify.error(
        'Verification failed. Unable to verify the code. Please request a new code and try again.',
        { id: 'login-phone-otp-verify' },
      );
    } catch (error) {
      console.error('Phone verification error:', error);
      const errorMessage = getErrorMessage(error.message || error.code);
      notify.error(getUserFacingError(error, errorMessage), {
        id: 'login-phone-otp-verify',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupNavigation = () => {
    navigate('/signup-selection');
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-5">
      <div id="recaptcha-container" />

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
              <div>
                <p className="text-sm font-bold">My Local Force</p>
              </div>
            </div>

            <div className="max-w-md py-10 lg:py-0">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-100">
                Welcome back
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                Sign in and get back to local services.
              </h1>
              <p className="mt-4 text-base leading-7 text-white/78">
                Access bookings, manage your profile, or continue your provider
                workflow from one secure account.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiShield className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Secure access</p>
                <p className="mt-1 text-xs text-white/65">
                  Email or phone login
                </p>
              </div>
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiHome className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Browse anytime</p>
                <p className="mt-1 text-xs text-white/65">Guest access ready</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-h-screen bg-white">
          <div className="mx-auto flex min-h-screen w-full max-w-[36rem] flex-col px-1 py-2 sm:px-4 lg:px-8">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSignupNavigation}
                className="inline-flex items-center gap-2 text-base font-medium text-blue-600 transition hover:text-blue-700"
              >
                <FiUserPlus className="h-4 w-4" />
                Create account
              </button>
            </div>

            <div className="flex flex-1 items-center py-10 sm:py-12 lg:py-16">
              <div className="w-full">
                <div className="mb-9">
                  <h2 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
                    Sign in to your account
                  </h2>
                  <p className="mt-3 text-base leading-7 text-gray-700">
                    Choose email/password or phone OTP to continue.
                  </p>
                </div>

                <div className="mb-8 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('email')}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg font-semibold transition ${
                      loginMethod === 'email'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FiMail className="h-4 w-4" />
                    Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('phone')}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-lg font-semibold transition ${
                      loginMethod === 'phone'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FiSmartphone className="h-4 w-4" />
                    Phone
                  </button>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    loginMethod === 'email'
                      ? handleEmailLogin()
                      : handlePhoneLogin();
                  }}
                  className="space-y-5"
                >
                  {loginMethod === 'email' ? (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-gray-900">
                          Email Address
                        </label>
                        <div className="relative">
                          <FiMail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                          <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className={iconInputClass}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-gray-900">
                          Password
                        </label>
                        <div className="relative">
                          <FiLock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className={`${iconInputClass} pr-12`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 transition hover:text-gray-900"
                            aria-label={
                              showPassword ? 'Hide password' : 'Show password'
                            }
                          >
                            {showPassword ? (
                              <EyeOff size={20} />
                            ) : (
                              <Eye size={20} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-gray-900">
                          Phone Number
                        </label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
                          <select
                            value={selectedCountry}
                            onChange={(event) =>
                              setSelectedCountry(event.target.value)
                            }
                            disabled={otpSent}
                            className={inputClass}
                          >
                            {countryOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.value === '+91'
                                  ? 'India (+91)'
                                  : 'Australia (+61)'}
                              </option>
                            ))}
                          </select>

                          <div className="relative">
                            <FiSmartphone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                            <input
                              type="tel"
                              placeholder={
                                selectedCountry === '+61'
                                  ? '412345678'
                                  : '9876543210'
                              }
                              value={phoneInput}
                              onChange={(event) =>
                                setPhoneInput(
                                  event.target.value.replace(/[^0-9]/g, ''),
                                )
                              }
                              maxLength="10"
                              disabled={otpSent}
                              className={iconInputClass}
                            />
                          </div>
                        </div>
                      </div>

                      {otpSent && (
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-gray-900">
                            Verification Code
                          </label>
                          <input
                            type="text"
                            placeholder="Enter 6-digit code"
                            value={otp}
                            onChange={(event) => setOtp(event.target.value)}
                            maxLength="6"
                            className={inputClass}
                          />
                          <div className="mt-3 text-right">
                            {phoneCooldown > 0 ? (
                              <p className="text-xs text-gray-600">
                                Resend OTP in {phoneCooldown}s
                              </p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setOtpSent(false);
                                  setOtp('');
                                  setPhoneInput('');
                                  setFormattedPhone('');
                                }}
                                className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                              >
                                Resend OTP
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition disabled:cursor-not-allowed ${
                      isLoading
                        ? 'bg-blue-400'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLoading ? (
                      loginMethod === 'email' ? (
                        'Signing In...'
                      ) : otpSent ? (
                        'Verifying...'
                      ) : (
                        'Sending OTP...'
                      )
                    ) : loginMethod === 'email' ? (
                      <>
                        <FiLogIn className="h-4 w-4" />
                        Sign In
                      </>
                    ) : otpSent ? (
                      <>
                        <FiArrowRight className="h-4 w-4" />
                        Verify Code
                      </>
                    ) : (
                      <>
                        <FiArrowRight className="h-4 w-4" />
                        Send OTP
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-7 border-t border-gray-100 pt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Don&apos;t have an account?{' '}
                    <button
                      onClick={handleSignupNavigation}
                      className="font-semibold text-blue-600 transition hover:text-blue-700"
                    >
                      Sign Up
                    </button>
                  </p>

                  <button
                    onClick={() => navigate('/')}
                    className="mt-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-600 transition hover:text-gray-950"
                  >
                    <FiHome className="h-4 w-4" />
                    Continue as Guest
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LoginScreen;
