import { toast } from 'sonner';
import { getUserFacingError } from './userFacingErrors';

const durations = {
  success: 5000,
  info: 7000,
  warning: 15000,
  error: 9000,
};

const minimumDurations = {
  success: 4000,
  info: 6000,
  warning: 15000,
  error: 8000,
};

const resolveDuration = (type, requestedDuration) => {
  const minimumDuration = minimumDurations[type] || durations[type];

  if (requestedDuration === Infinity) {
    return Infinity;
  }

  if (Number.isFinite(requestedDuration)) {
    return Math.max(requestedDuration, minimumDuration);
  }

  return durations[type];
};

const withDuration = (type, options = {}) => ({
  ...options,
  duration: resolveDuration(type, options.duration),
});

export const notify = {
  success: (message, options) => toast.success(message, withDuration('success', options)),
  error: (message, options) => toast.error(message, withDuration('error', options)),
  warning: (message, options) => toast.warning(message, withDuration('warning', options)),
  info: (message, options) => toast.info(message, withDuration('info', options)),
  loading: (message, options) => toast.loading(message, { duration: Infinity, ...options }),
  dismiss: (id) => toast.dismiss(id),
  promise: (promise, messages, options = {}) =>
    toast.promise(promise, {
      ...options,
      loading: messages.loading,
      success: (value) =>
        typeof messages.success === 'function' ? messages.success(value) : messages.success,
      error: (error) =>
        typeof messages.error === 'function'
          ? messages.error(error)
          : messages.error || getUserFacingError(error),
    }),
};

export { getUserFacingError };

