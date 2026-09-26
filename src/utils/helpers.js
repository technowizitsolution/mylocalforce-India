/**
 * Utility functions for common operations
 */

/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @param {string} format - Format style ('short', 'long', 'relative')
 * @returns {string} - Formatted date
 */
export const formatDate = (date, format = 'short') => {
  const d = new Date(date);

  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    case 'long':
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    case 'time':
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    case 'relative':
      return getRelativeTime(d);
    default:
      return d.toISOString();
  }
};

/**
 * Get relative time (e.g., "2 hours ago")
 * @param {Date} date - Date to format
 * @returns {string} - Relative time string
 */
export const getRelativeTime = (date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return formatDate(date, 'short');
};

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'USD')
 * @returns {string} - Formatted currency
 */
export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Validate email
 * @param {string} email - Email to validate
 * @returns {boolean} - Is valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - Is valid phone number
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Truncate string
 * @param {string} str - String to truncate
 * @param {number} length - Length limit
 * @returns {string} - Truncated string
 */
export const truncateString = (str, length = 50) => {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

/**
 * Capitalize string
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Generate unique ID
 * @returns {string} - Unique ID
 */
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, delay = 300) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {Function} - Throttled function
 */
export const throttle = (func, limit = 300) => {
  let lastRun = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastRun >= limit) {
      func(...args);
      lastRun = now;
    }
  };
};

/**
 * Merge objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
export const mergeObjects = (target, source) => {
  return { ...target, ...source };
};

/**
 * Clone deep
 * @param {any} obj - Object to clone
 * @returns {any} - Cloned object
 */
export const cloneDeep = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map((item) => cloneDeep(item));
  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = cloneDeep(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Standard experience options for provider profile and onboarding
 */
export const EXPERIENCE_OPTIONS = [
  { value: '0', label: '0+ year' },
  { value: '1', label: '1+ year' },
  { value: '2', label: '2+ years' },
  { value: '3', label: '3+ years' },
  { value: '4', label: '4+ years' },
  { value: '5', label: '5+ years' },
  { value: '6', label: '6+ years' },
  { value: '7', label: '7+ years' },
  { value: '8', label: '8+ years' },
  { value: '9', label: '9+ years' },
  { value: '10', label: '10+ years' },
  { value: '15', label: '15+ years' },
  { value: '20', label: '20+ years' },
];

export const EXPERIENCE_TUPLES = EXPERIENCE_OPTIONS.map((option) => [option.value, option.label]);

/**
 * Format provider years of experience consistently across the platform
 * @param {string|number|null} value - Raw experience value (e.g. 5, "5", "5+", "5+ years", "5+ Years of Experience")
 * @param {string} fallback - Fallback string if value is missing (default: 'Not specified')
 * @returns {string} - Formatted experience string (e.g. "5+ Years")
 */
export const formatExperience = (value, fallback = 'Not specified') => {
  if (value == null) return fallback;
  const str = String(value).trim();
  if (!str) return fallback;

  // Pure numeric string (e.g. "0", "1", "5", "10")
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (num === 1) return '1+ Year';
    return `${num}+ Years`;
  }

  // Regex for "5+", "5+ years", "5+ Years of Experience", "5 years", "1 year", "5 yr", "5 yrs"
  const match = str.match(/^(\d+)\s*\+?\s*(?:years?|yrs?)?(?:\s*of\s*experience)?$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num === 1) return '1+ Year';
    return `${num}+ Years`;
  }

  return str;
};


/**
 * Format a date as YYYY-MM-DD using the user's local calendar day.
 * Avoid `toISOString()` for this: it converts to UTC first, so in timezones
 * ahead of UTC (Australia, India) a local-midnight date becomes the previous day.
 * @param {Date|string|number|{toDate: Function}} value - Date, parseable value, or Firestore Timestamp
 * @returns {string} - YYYY-MM-DD, or '' when the value is not a valid date
 */
export const formatLocalDateYMD = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
