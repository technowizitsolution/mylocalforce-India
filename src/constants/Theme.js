// Premium Color Scheme and Theme Configuration
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
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 50,
};

export const Typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  }
};

export const Shadows = {
  small: {
    shadowColor: Colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  medium: {
    shadowColor: Colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  large: {
    shadowColor: Colors.shadowDark,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 12,
  }
};

// Common Styles
export const CommonStyles = {
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    ...Shadows.small,
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.sizes.md,
    backgroundColor: Colors.surface,
    color: Colors.text,
  },
};