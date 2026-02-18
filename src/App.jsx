import { Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './components/Welcome';
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
/**
 * App component - Main routing configuration
 * Handles all route definitions and protects routes based on user roles
 */
const App = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Welcome />} />

      <Route path="/login" element={<LoginScreen />} />

      {/* Auth Routes - To be implemented */}
      <Route path="/signup-selection" element={<div>Signup Selection - Coming Soon</div>} />
      <Route path="/forgot-password" element={<div>Forgot Password - Coming Soon</div>} />
      <Route path="/main-tabs" element={<Navigate to="/customer" replace />} />

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

        {/* User Profile */}
        <Route path="profile" element={<Profile />} />

        {/* Catch-all for unknown customer routes */}
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Route>

      {/* Service Provider Routes - To be implemented */}
      <Route path="/provider" element={<div>Provider Dashboard - Coming Soon</div>} />

      {/* Admin Routes - To be implemented */}
      <Route path="/admin" element={<div>Admin Dashboard - Coming Soon</div>} />

      {/* Catch-all for unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;