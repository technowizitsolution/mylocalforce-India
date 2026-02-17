// Premium Color Scheme and Theme Configuration
// Tailwind CSS compatible theme for React web application

export const Colors = {
  // Primary Colors - Modern Purple & Blue Gradient
  primary: '#6C63FF',
  primaryDark: '#5A52E3',
  primaryLight: '#8B85FF',
  secondary: '#FF6B9D',
  secondaryDark: '#E85A87',
  secondaryLight: '#FF8BB5',

  // Gradient Colors
  gradientStart: '#6C63FF',
  gradientEnd: '#4ECDC4',

  // Success & Status Colors
  success: '#00D68F',
  successLight: '#26E3A6',
  warning: '#FFB800',
  warningLight: '#FFC426',
  error: '#FF4757',
  errorLight: '#FF6B7A',
  info: '#00A8FF',
  infoLight: '#26B5FF',

  // Neutral Colors
  background: '#F8FAFC',
  backgroundLight: '#FFFFFF',
  backgroundDark: '#F1F5F9',
  backgroundGray: '#F7F7F7',

  // Text Colors
  text: '#1E293B',
  textLight: '#64748B',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Surface Colors
  surface: '#FFFFFF',
  surfaceLight: '#F8FAFC',
  surfaceDark: '#E2E8F0',

  // Border Colors
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderDark: '#CBD5E1',

  // Shadow Colors
  shadow: 'rgba(30, 41, 59, 0.1)',
  shadowDark: 'rgba(30, 41, 59, 0.2)',

  // Category Colors
  categories: {
    cleaning: '#00D68F',
    plumbing: '#00A8FF',
    electrician: '#FFB800',
    salon: '#FF6B9D',
    repair: '#6C63FF',
    beauty: '#FF8BB5',
  },

  // Status Colors for Bookings
  booking: {
    upcoming: '#00A8FF',
    inProgress: '#FFB800',
    completed: '#00D68F',
    cancelled: '#FF4757',
  },
};

// Spacing mapped to Tailwind-compatible rem values
export const Spacing = {
  xs: '0.25rem',   // 4px  → p-1
  sm: '0.5rem',    // 8px  → p-2
  md: '1rem',      // 16px → p-4
  lg: '1.5rem',    // 24px → p-6
  xl: '2rem',      // 32px → p-8
  xxl: '3rem',     // 48px → p-12
};

// Border radius mapped to Tailwind-compatible rem values
export const BorderRadius = {
  sm: '0.5rem',    // 8px  → rounded-lg
  md: '0.75rem',   // 12px → rounded-xl
  lg: '1rem',      // 16px → rounded-2xl
  xl: '1.5rem',    // 24px → rounded-3xl
  full: '9999px',  // fully rounded → rounded-full
};

export const Typography = {
  sizes: {
    xs: '0.75rem',   // 12px → text-xs
    sm: '0.875rem',  // 14px → text-sm
    md: '1rem',      // 16px → text-base
    lg: '1.125rem',  // 18px → text-lg
    xl: '1.25rem',   // 20px → text-xl
    xxl: '1.5rem',   // 24px → text-2xl
    xxxl: '2rem',    // 32px → text-4xl (closest)
  },
  weights: {
    regular: '400',  // font-normal
    medium: '500',   // font-medium
    semibold: '600', // font-semibold
    bold: '700',     // font-bold
  },
  lineHeights: {
    tight: '1.2',    // leading-tight
    normal: '1.4',   // leading-normal (approx)
    relaxed: '1.6',  // leading-relaxed
  },
};

// Box shadows as CSS strings (web-compatible)
export const Shadows = {
  small: '0 2px 8px rgba(30, 41, 59, 0.1)',     // shadow-md equivalent
  medium: '0 4px 12px rgba(30, 41, 59, 0.1)',    // shadow-lg equivalent
  large: '0 8px 20px rgba(30, 41, 59, 0.2)',     // shadow-xl equivalent
};

// Tailwind class mappings for common patterns
// Use these directly in className props
export const TW = {
  container: 'flex-1 bg-slate-50 min-h-screen',
  card: 'bg-white rounded-xl shadow-md',
  button: 'py-4 px-6 rounded-2xl flex items-center justify-center',
  input: 'border border-slate-200 rounded-xl py-4 px-4 text-base bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
  gradient: 'bg-gradient-to-r from-[#6C63FF] to-[#4ECDC4]',

  // Text utilities
  textPrimary: 'text-slate-800',
  textSecondary: 'text-slate-500',
  textMuted: 'text-slate-400',

  // Status badge classes
  statusUpcoming: 'bg-blue-100 text-blue-600',
  statusInProgress: 'bg-amber-100 text-amber-600',
  statusCompleted: 'bg-emerald-100 text-emerald-600',
  statusCancelled: 'bg-red-100 text-red-600',

  // Category badge classes
  categoryCleaning: 'bg-emerald-100 text-emerald-600',
  categoryPlumbing: 'bg-blue-100 text-blue-600',
  categoryElectrician: 'bg-amber-100 text-amber-600',
  categorySalon: 'bg-pink-100 text-pink-600',
  categoryRepair: 'bg-indigo-100 text-indigo-600',
  categoryBeauty: 'bg-rose-100 text-rose-600',
};