import { Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './components/Welcome';
import AboutUs from './components/AboutUs';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import Customer from './customer/Customer';
import Home from './customer/pages/Home';
import Services from './customer/pages/Services';
import Bookings from './customer/pages/Bookings';
import Profile from './customer/pages/Profile';
import ServiceDetailsScreen from './customer/pages/ServiceDetailsScreen';
import AddressScreen from './customer/pages/AddressScreen';
import ProviderSelectorScreen from './customer/pages/ProviderSelectorScreen';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import SignupSelectionScreen from './screens/SignupSelectionScreen';
import CustomerSignupScreen from './screens/CustomerSignupScreen';
import ProviderSignupScreen from './screens/ProviderSignupScreen';
import ProviderEntryScreen from './screens/ProviderEntryScreen';
import ProviderHomeScreen from './screens/ProviderHomeScreen';
import ProviderOnboardingScreen from './screens/ProviderOnboardingScreen';
import ProviderUnderReviewScreen from './screens/ProviderUnderReviewScreen';
import BookingScreen from './customer/pages/BookingScreen';
import PaymentSuccess from './customer/pages/PaymentSuccess';
import MobileUploadPage from './components/providerUpload/mobile/MobileUploadPage';
/**
 * App component - Main routing configuration
 * Handles all route definitions and protects routes based on user roles
 */
const App = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Welcome />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/about-us" element={<Navigate to="/about" replace />} />

      <Route path="/login" element={<LoginScreen />} />

      {/* Auth Routes */}
      <Route path="/signup-selection" element={<SignupSelectionScreen />} />
      <Route path="/signup/customer" element={<CustomerSignupScreen />} />
      <Route path="/signup/provider" element={<ProviderSignupScreen />} />
      <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/main-tabs" element={<Navigate to="/customer" replace />} />
      <Route path="/mobile-upload/:token" element={<MobileUploadPage />} />

      {/* Customer Routes - Protected by role */}
      <Route
        path="/customer"
        element={
          <RoleProtectedRoute requiredRole="customer">
            <Customer />
          </RoleProtectedRoute>
        }
      >
        {/* Customer Dashboard */}
        <Route index element={<Home />} />

        {/* Services Listing */}
        <Route path="services" element={<Services />} />

        {/* Service Details */}
        <Route path="service-detail" element={<ServiceDetailsScreen />} />

        {/* Address Selection */}
        <Route path="address" element={<AddressScreen />} />

        {/* Provider Selection */}
        <Route path="provider-selector" element={<ProviderSelectorScreen />} />

        {/* User Bookings */}
        <Route path="bookings" element={<Bookings />} />

        {/* Booking Screen */}
        <Route path="booking" element={<BookingScreen />} />

        {/* Payment Result (redirect back from Stripe) */}
        <Route path="payment-success" element={<PaymentSuccess />} />

        {/* User Profile */}
        <Route path="profile" element={<Profile />} />

        {/* Catch-all for unknown customer routes */}
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Route>

      {/* Service Provider Routes */}
      <Route
        path="/provider"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderEntryScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/dashboard"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderEntryScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/home"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderHomeScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/onboarding"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderOnboardingScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/under-review"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderUnderReviewScreen />
          </RoleProtectedRoute>
        }
      />

     

      {/* Catch-all for unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
