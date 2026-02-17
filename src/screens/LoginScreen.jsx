import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginWithPhoneProfile } from '../services/firebase/accountMerging';
import { auth as webAuth, functions } from '../services/firebase/firebaseConfig';
import { signInWithCustomToken } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { firestore } from '../services/firebase/firebaseConfig';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

const LoginScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return navigate('/customer', { replace: true });
  }
  
  const location = useLocation();
  const { login, authenticateWithLinkedAccount } = useAuth();
  
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneInput, setPhoneInput] = useState(''); // Raw input (without country code)
  const [formattedPhone, setFormattedPhone] = useState(''); // Full E.164 format (with country code)
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [error, setError] = useState('');

  const [selectedCountry, setSelectedCountry] = useState('+91'); // Default India
  const countryOptions = [
    { label: '🇮🇳 India (+91)', value: '+91' },
    { label: '🇦🇺 Australia (+61)', value: '+61' },
  ];

  const redirectTo = location.state?.redirectTo;

  // Country code selection

  // Countdown timer for OTP resend
  useEffect(() => {
    if (phoneCooldown > 0) {
      const timer = setTimeout(() => setPhoneCooldown(phoneCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneCooldown]);

  const handleEmailLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    // Check if email exists in Firestore before attempting login
    try {
      const emailLower = email.trim().toLowerCase();
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', emailLower), limit(1));
      const usersSnapshot = await getDocs(q);

      if (usersSnapshot.empty) {
        setError('No account found with this email. Please sign up.');
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
        // The AuthContext will handle navigation via onAuthStateChanged
        setTimeout(() => {
          navigate('/customer');
        }, 100);
      } else {
        // Check if it's an approval status error
        if (result.error && result.error.includes('pending')) {
          setError('Your service provider account is currently under review. Please wait for 24 hours.');
        } else {
          const errorMessage = getErrorMessage(result.error);
          setError(errorMessage);
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error.message || error.code);
      setError(errorMessage);
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
    setError('');
    // Ensure phone is provided
    if (!phoneInput) {
      setError('Please enter your phone number');
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
          setError('Invalid phone number');
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
            setError('No account found with this phone number. Please sign up.');
            return;
          }

          const userDoc = usersSnapshot.docs[0];
          const userUid = userDoc.id;
          console.log('Found user in database with UID:', userUid);
        } catch (lookupError) {
          console.error('Phone lookup error:', lookupError);
          setError('Unable to verify phone number. Please try again later.');
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
        setError(''); // Clear any previous errors
      } catch (error) {
        console.error('OTP send error:', error);
        const errorMessage = getErrorMessage(error.message || error.code);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // OTP already sent -> verify using the stored formattedPhone (already has country code)
    if (!otp) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit verification code');
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
            setError('No account found with this phone number in the database. Please sign up.');
            setIsLoading(false);
            return;
          }
        } catch (lookupError) {
          console.error('Post-verify phone lookup error:', lookupError);
          setError('Unable to verify phone in database. Please try again later.');
          setIsLoading(false);
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
        setError('');
        return;
      }

      setError('Verification failed. Unable to verify the code. Please request a new code and try again.');
    } catch (error) {
      console.error('Phone verification error:', error);
      const errorMessage = getErrorMessage(error.message || error.code);
      setError(errorMessage);
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* RecaptchaVerifier container for phone authentication */}
      <div id="recaptcha-container"></div>
      
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Local Force</h1>
          <p className="text-base text-gray-600">Sign in to your account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Login Method Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-8">
          <button
            onClick={() => setLoginMethod('email')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
              loginMethod === 'email'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Email
          </button>
          <button
            onClick={() => setLoginMethod('phone')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
              loginMethod === 'phone'
                ? 'bg-blue-600 text-white'
                : 'bg-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Phone
          </button>
        </div>

        {/* Login Form */}
        <form
          onSubmit={e => {
            e.preventDefault();
            loginMethod === 'email' ? handleEmailLogin() : handlePhoneLogin();
          }}
          className="space-y-5"
        >
          {loginMethod === 'email' ? (
            <>
              {/* Email Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Forgot Password?
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Phone Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Phone Number
                </label>
                <select
                  value={selectedCountry}
                  onChange={e => setSelectedCountry(e.target.value)}
                  disabled={otpSent}
                  className="w-full px-4 py-3 mb-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {countryOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-0">
                  <div className="flex items-center px-3 py-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg font-semibold text-gray-900">
                    {selectedCountry}
                  </div>
                  <input
                    type="tel"
                    placeholder={selectedCountry === '+61' ? '412345678' : '9876543210'}
                    value={phoneInput}
                    onChange={e =>
                      setPhoneInput(e.target.value.replace(/[^0-9]/g, ''))
                    }
                    maxLength="10"
                    disabled={otpSent}
                    className="flex-1 px-4 py-3 border border-l-0 border-gray-300 rounded-r-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* OTP Input */}
              {otpSent && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                    maxLength="6"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 rounded-lg font-semibold text-white transition ${
              isLoading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading
              ? loginMethod === 'email'
                ? 'Signing In...'
                : otpSent
                ? 'Verifying...'
                : 'Sending OTP...'
              : loginMethod === 'email'
              ? 'Sign In'
              : otpSent
              ? 'Verify Code'
              : 'Send OTP'}
          </button>
        </form>

        {/* Sign Up Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <button
              onClick={handleSignupNavigation}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Sign Up
            </button>
          </p>
        </div>

        {/* Guest Access */}
        <button
          onClick={() => navigate('/main-tabs')}
          className="mt-4 w-full text-sm text-gray-600 hover:text-gray-900 underline py-2"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;
