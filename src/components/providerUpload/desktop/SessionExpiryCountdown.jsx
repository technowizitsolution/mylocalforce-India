import { useEffect, useState } from 'react';

/**
 * Converts Firestore/callable timestamp shapes to milliseconds.
 *
 * @param {*} value
 * @returns {number}
 */
const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return new Date(value).getTime() || 0;
};

/**
 * Shows remaining session time and cleans up its interval on unmount.
 *
 * @param {{expiresAt: *}} props
 * @returns {JSX.Element|null}
 */
const SessionExpiryCountdown = ({ expiresAt }) => {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(toMillis(expiresAt) - Date.now(), 0),
  );

  useEffect(() => {
    const update = () => {
      setRemainingMs(Math.max(toMillis(expiresAt) - Date.now(), 0));
    };

    update();
    const timer = window.setInterval(update, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [expiresAt]);

  if (!expiresAt) {
    return null;
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return (
    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">
      {remainingMs > 0
        ? `${minutes}:${String(seconds).padStart(2, '0')} remaining`
        : 'Expired'}
    </span>
  );
};

export default SessionExpiryCountdown;
