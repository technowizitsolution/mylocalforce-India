/**
 * Component Template
 * 
 * Use this as a starting point for new components
 * Remember to replace ComponentTemplate with your component name
 */

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '@/context/AuthContext';
import { Loading, ErrorMessage } from '@/components/StateComponents';
import { logger } from '@/utils/logger';

/**
 * ComponentTemplate - Brief description of what this component does
 * 
 * Features:
 * - Feature 1
 * - Feature 2
 * - Feature 3
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Component title
 * @param {boolean} props.isLoading - Loading state
 * @param {Function} props.onAction - Action handler
 * @returns {JSX.Element} - Rendered component
 * 
 * @example
 * <ComponentTemplate 
 *   title="My Title" 
 *   onAction={() => console.log('Action')}
 * />
 */
const ComponentTemplate = ({
  title = 'Default Title',
  isLoading: initialLoading = false,
  onAction = () => {},
}) => {
  // ============================================
  // HOOKS & STATE
  // ============================================

  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    logger.debug('ComponentTemplate mounted', { title });
    
    // Fetch data or initialize
    if (isAuthenticated) {
      // Fetch user-specific data
    }

    // Cleanup
    return () => {
      logger.debug('ComponentTemplate unmounted');
    };
  }, [isAuthenticated]);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleAction = useCallback(() => {
    try {
      logger.userAction('ComponentTemplate action', {
        timestamp: new Date().toISOString(),
      });
      onAction();
    } catch (err) {
      setError(err);
      logger.error('ComponentTemplate action failed', err);
    }
  }, [onAction]);

  const handleRetry = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // Retry logic here
      setLoading(false);
    } catch (err) {
      setError(err);
      logger.error('Retry failed', err);
    }
  }, []);

  // ============================================
  // CONDITIONAL RENDERING
  // ============================================

  if (!isAuthenticated) {
    return (
      <div className="p-8 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">Please log in to view this content</p>
      </div>
    );
  }

  if (loading) {
    return <Loading fullScreen />;
  }

  if (error) {
    return <ErrorMessage error={error} onRetry={handleRetry} />;
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="w-full">
      {/* Header Section */}
      <header className="bg-white border-b border-gray-200 p-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-600 mt-1">
          Welcome, {user?.firstName}
        </p>
      </header>

      {/* Main Content Section */}
      <main className="px-4">
        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card Example */}
          <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Card Title
            </h2>
            <p className="text-gray-600 mb-4">Card description goes here</p>
            <button
              onClick={handleAction}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Action Button
            </button>
          </div>

          {/* Repeat cards as needed */}
        </div>
      </main>
    </div>
  );
};

// ============================================
// PROP TYPES
// ============================================

ComponentTemplate.propTypes = {
  title: PropTypes.string,
  isLoading: PropTypes.bool,
  onAction: PropTypes.func,
};

// ============================================
// EXPORT
// ============================================

export default ComponentTemplate;

// ============================================
// USAGE NOTES
// ============================================

/*
 * 1. Replace "ComponentTemplate" with your actual component name
 * 2. Update propTypes based on your component's props
 * 3. Update the JSDoc comments with accurate information
 * 4. Use the logger utility for debugging
 * 5. Always include error handling and loading states
 * 6. Use Tailwind CSS for styling
 * 7. Follow the established file structure
 * 8. Import hooks and utilities as needed
 * 
 * Common Imports:
 * - import { useAuth } from '@/context/AuthContext';
 * - import { useAsync } from '@/hooks/useCustom';
 * - import { api } from '@/services/api';
 * - import { logger } from '@/utils/logger';
 * - import { formatDate } from '@/utils/helpers';
 * - import { CONSTANTS } from '@/constants';
 */
