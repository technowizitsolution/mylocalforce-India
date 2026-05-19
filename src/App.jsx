import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Welcome from './components/Welcome';
import AboutUs from './components/AboutUs';
import RoleProtectedRoute from './components/RoleProtectedRoute';
import Customer from './customer/Customer';
import Home from './customer/pages/Home';
import Services from './customer/pages/Services';
import Bookings from './customer/pages/Bookings';
import Profile from './customer/pages/Profile';
import EditProfile from './customer/pages/EditProfile';
import Notifications from './customer/pages/Notifications';
import AcceptedOffers from './customer/pages/AcceptedOffers';
import ContactSupport from './customer/pages/ContactSupport';
import ServiceDetailsScreen from './customer/pages/ServiceDetailsScreen';
import AddressScreen from './customer/pages/AddressScreen';
import ProviderSelectorScreen from './customer/pages/ProviderSelectorScreen';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import SignupSelectionScreen from './screens/SignupSelectionScreen';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import CustomerSignupScreen from './screens/CustomerSignupScreen';
import ProviderSignupScreen from './screens/ProviderSignupScreen';
import ProviderEntryScreen from './screens/ProviderEntryScreen';
import ProviderHomeScreen from './screens/ProviderHomeScreen';
import ProviderServicesScreen from './screens/ProviderServicesScreen';
import ProviderBookingsScreen from './screens/ProviderBookingsScreen';
import ProviderEarningsScreen from './screens/ProviderEarningsScreen';
import ProviderProfileScreen from './screens/ProviderProfileScreen';
import ProviderNotificationsScreen from './screens/ProviderNotificationsScreen';
import ProviderEditProfileScreen from './screens/ProviderEditProfileScreen';
import ProviderDocumentsScreen from './screens/ProviderDocumentsScreen';
import ProviderEditDetailsScreen from './screens/ProviderEditDetailsScreen';
import ProviderContactSupportScreen from './screens/ProviderContactSupportScreen';
import ProviderOnboardingScreen from './screens/ProviderOnboardingScreen';
import ProviderUnderReviewScreen from './screens/ProviderUnderReviewScreen';
import BookingScreen from './customer/pages/BookingScreen';
import OrderSummary from './customer/pages/OrderSummary';
import PaymentSuccess from './customer/pages/PaymentSuccess';
import MobileUploadPage from './components/providerUpload/mobile/MobileUploadPage';
import LegalPolicyPage from './components/LegalPolicyPage';
import UnknownRouteRedirect from './components/UnknownRouteRedirect';
import CareersPage from './components/CareersPage';
import ContactPage from './components/ContactPage';
import PublicNavbar from './components/PublicNavbar';
import { useAuth } from './context/AuthContext';

const withPublicNavbar = (children, navbarProps) => (
  <>
    <PublicNavbar {...navbarProps} />
    {children}
  </>
);

const PublicServiceRoute = ({ children, redirectTo }) => {
  const location = useLocation();
  const { isAuthenticated, isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated || isLoggedIn) {
    return <Navigate to={redirectTo} replace state={location.state} />;
  }

  return withPublicNavbar(children, { transparentAtTop: false });
};

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
      <Route path="/privacy-policy" element={<LegalPolicyPage type="privacy" />} />
      <Route
        path="/terms-and-conditions"
        element={<Navigate to="/terms-and-conditions/customer" replace />}
      />
      <Route path="/terms-and-conditions/customer" element={<LegalPolicyPage type="terms" />} />
      <Route path="/terms-and-conditions/provider" element={<LegalPolicyPage type="terms" />} />
      <Route
        path="/terms-customer"
        element={<Navigate to="/terms-and-conditions/customer" replace />}
      />
      <Route
        path="/terms-provider"
        element={<Navigate to="/terms-and-conditions/provider" replace />}
      />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route
        path="/services"
        element={
          <PublicServiceRoute redirectTo="/customer/services">
            <Services />
          </PublicServiceRoute>
        }
      />
      <Route
        path="/service-detail"
        element={
          <PublicServiceRoute redirectTo="/customer/service-detail">
            <ServiceDetailsScreen />
          </PublicServiceRoute>
        }
      />

      <Route path="/login" element={<LoginScreen />} />

      {/* Auth Routes */}
      <Route path="/signup-selection" element={<SignupSelectionScreen />} />
      <Route path="/signup/customer" element={<CustomerSignupScreen />} />
      <Route path="/signup/provider" element={<ProviderSignupScreen />} />
      <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      <Route
        path="/role-selection"
        element={
          <RoleProtectedRoute>
            <RoleSelectionScreen />
          </RoleProtectedRoute>
        }
      />
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
        <Route path="order-summary" element={<OrderSummary />} />

        {/* Payment Result (redirect back from Stripe) */}
        <Route path="payment-success" element={<PaymentSuccess />} />
        <Route path="payment-cancelled" element={<PaymentSuccess />} />

        {/* User Profile */}
        <Route path="profile" element={<Profile />} />
        <Route path="edit-profile" element={<EditProfile />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="accepted-leads" element={<AcceptedOffers />} />
        <Route path="contact-support" element={<ContactSupport />} />

        {/* Catch-all for unknown customer routes */}
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Route>

      {/* Service Provider Routes */}
      <Route
        path="/provider"
        element={withPublicNavbar(
          <RoleProtectedRoute requiredRole="client">
            <ProviderEntryScreen />
          </RoleProtectedRoute>
        )}
      />
      <Route
        path="/provider/dashboard"
        element={withPublicNavbar(
          <RoleProtectedRoute requiredRole="client">
            <ProviderEntryScreen />
          </RoleProtectedRoute>
        )}
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
        path="/provider/services"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderServicesScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/bookings"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderBookingsScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/earnings"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderEarningsScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/profile"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderProfileScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/notifications"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderNotificationsScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/edit-profile"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderEditProfileScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/documents"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderDocumentsScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/edit-details"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderEditDetailsScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/contact-support"
        element={
          <RoleProtectedRoute requiredRole="client">
            <ProviderContactSupportScreen />
          </RoleProtectedRoute>
        }
      />
      <Route
        path="/provider/onboarding"
        element={withPublicNavbar(
          <RoleProtectedRoute requiredRole="client">
            <ProviderOnboardingScreen />
          </RoleProtectedRoute>
        )}
      />
      <Route
        path="/provider/under-review"
        element={withPublicNavbar(
          <RoleProtectedRoute requiredRole="client">
            <ProviderUnderReviewScreen />
          </RoleProtectedRoute>
        )}
      />

      {/* Catch-all for unknown routes */}
      <Route path="*" element={<UnknownRouteRedirect />} />
    </Routes>
  );
};

export default App;
