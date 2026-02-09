/**
 * Application Constants
 */

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh',
  },
  SERVICES: {
    GET_ALL: '/services',
    GET_BY_ID: (id) => `/services/${id}`,
    SEARCH: '/services/search',
    GET_CATEGORIES: '/categories',
    GET_BY_CATEGORY: (categoryId) => `/categories/${categoryId}/services`,
  },
  BOOKINGS: {
    CREATE: '/bookings',
    GET_ALL: '/bookings',
    GET_BY_ID: (id) => `/bookings/${id}`,
    UPDATE: (id) => `/bookings/${id}`,
    CANCEL: (id) => `/bookings/${id}/cancel`,
  },
  USER: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    UPLOAD_IMAGE: '/users/profile/image',
    DELETE_ACCOUNT: '/users/profile',
  },
};

// User Roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  PROVIDER: 'provider',
  ADMIN: 'admin',
};

// Booking Status
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

// Booking Status Colors
export const BOOKING_STATUS_COLORS = {
  pending: 'yellow',
  confirmed: 'blue',
  in_progress: 'purple',
  completed: 'green',
  cancelled: 'red',
  rejected: 'red',
};

// Service Categories
export const SERVICE_CATEGORIES = [
  { id: 1, name: 'Haircut', icon: 'scissors' },
  { id: 2, name: 'Massage', icon: 'hand' },
  { id: 3, name: 'Cleaning', icon: 'broom' },
  { id: 4, name: 'Plumbing', icon: 'wrench' },
  { id: 5, name: 'Electrical', icon: 'zap' },
  { id: 6, name: 'Painting', icon: 'droplet' },
  { id: 7, name: 'Gardening', icon: 'leaf' },
  { id: 8, name: 'Tutoring', icon: 'book' },
];

// Rating Options
export const RATING_OPTIONS = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Very Good' },
  { value: 5, label: 'Excellent' },
];

// Time Slots
export const TIME_SLOTS = [
  '08:00 AM',
  '08:30 AM',
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '12:30 PM',
  '01:00 PM',
  '01:30 PM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM',
  '05:30 PM',
  '06:00 PM',
  '06:30 PM',
  '07:00 PM',
  '07:30 PM',
];

// Validation Rules
export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  PHONE_LENGTH: 10,
};

// Local Storage Keys
export const STORAGE_KEYS = {
  USER: 'user',
  AUTH_TOKEN: 'authToken',
  REFRESH_TOKEN: 'refreshToken',
  APP_PREFERENCES: 'appPreferences',
  RECENT_SEARCHES: 'recentSearches',
  CART: 'cart',
};

// API Response Messages
export const API_MESSAGES = {
  SUCCESS: 'Operation completed successfully',
  ERROR: 'An error occurred. Please try again.',
  NETWORK_ERROR: 'Network connection error. Please check your internet.',
  UNAUTHORIZED: 'Please log in to continue',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Invalid request. Please check your input.',
  SERVER_ERROR: 'Server error. Please try again later.',
};

// Icon Sizes
export const ICON_SIZES = {
  SMALL: 16,
  MEDIUM: 24,
  LARGE: 32,
  EXTRA_LARGE: 48,
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1,
};

// Debounce Delays (in milliseconds)
export const DEBOUNCE_DELAYS = {
  SEARCH: 300,
  INPUT: 200,
  SCROLL: 250,
  WINDOW_RESIZE: 250,
};

// Environment Variables
export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  APP_NAME: import.meta.env.VITE_APP_NAME || 'MyLocalForce',
  ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT || 'development',
  IS_PRODUCTION: import.meta.env.VITE_ENVIRONMENT === 'production',
  IS_DEVELOPMENT: import.meta.env.VITE_ENVIRONMENT === 'development',
};
