import { useState, useEffect } from 'react';
import { fetchCategories } from '../services/firebase';

/**
 * Custom hook for fetching categories and subcategories from Firebase.
 * Returns { categories, subcategories, loading, error }
 */
const useCategories = () => {
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      try {
        setLoading(true);
        const data = await fetchCategories();

        if (!isMounted) return;

        setCategories(data);

        // Flatten subcategories from all categories
        const allSubs = data.reduce((acc, cat) => {
          if (Array.isArray(cat.subcategories)) {
            return acc.concat(
              cat.subcategories.map((sub) => ({
                ...sub,
                parentCategoryId: cat.id,
                parentCategoryName: cat.name,
              }))
            );
          }
          return acc;
        }, []);

        setSubcategories(allSubs);
      } catch (err) {
        console.error('Error loading categories:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load categories');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  return { categories, subcategories, loading, error };
};

export default useCategories;
