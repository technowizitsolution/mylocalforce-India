import { useCallback, useEffect, useState } from 'react';
import { getDocumentUploadSettings } from '../services/firebase/documentUploadService';

/**
 * Loads secure document upload settings.
 *
 * @returns {{settings: Object|null, loading: boolean, error: string, reload: Function}}
 */
export const useDocumentUploadSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await getDocumentUploadSettings();
        if (!cancelled) {
          setSettings(result.settings || null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError.message ||
              'Secure document upload settings could not be loaded.',
          );
          setSettings(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { settings, loading, error, reload };
};
