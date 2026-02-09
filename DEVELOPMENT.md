# Development Guide

## Getting Started

1. Follow the setup instructions in README.md
2. Configure your `.env.local` file
3. Start the dev server: `npm run dev`

## Project Structure

### `/src/components`
Reusable UI components shared across the app.

**Examples:**
- `ErrorBoundary.jsx` - Error handling wrapper
- `RoleProtectedRoute.jsx` - Route protection based on user role
- `StateComponents.jsx` - Common state UI (Loading, Error, EmptyState)

### `/src/context`
React Context for global state management.

**Examples:**
- `AuthContext.jsx` - User authentication state

### `/src/customer`
Customer-specific features and pages.

**Structure:**
- `components/` - Customer feature components
- `pages/` - Customer pages
- `Customer.jsx` - Customer layout wrapper

### `/src/services`
API integration and external service calls.

**Examples:**
- `api.js` - Centralized API client with methods for all endpoints

### `/src/hooks`
Custom React hooks for reusable logic.

**Examples:**
- `useAsync` - Handle async operations with loading/error states
- `useForm` - Form state management
- `useLocalStorage` - Persistent client storage
- `useDebounce` - Debounce function calls

### `/src/utils`
Utility functions and helpers.

**Examples:**
- `helpers.js` - Date formatting, validation, string manipulation
- `logger.js` - Logging utility for development and production

### `/src/constants`
Application-wide constants.

**Includes:**
- API endpoints
- User roles
- Booking statuses
- Service categories
- Validation rules

## Coding Standards

### Component Structure

```jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/StateComponents';

/**
 * Component description
 * @param {Object} props - Component props
 * @param {string} props.title - The component title
 * @returns {JSX.Element}
 */
const MyComponent = ({ title }) => {
  const { user } = useAuth();
  const [state, setState] = useState(null);

  useEffect(() => {
    // Effect logic
  }, []);

  return (
    <div className="p-4">
      <h1>{title}</h1>
      {/* Content */}
    </div>
  );
};

export default MyComponent;
```

### Naming Conventions

- **Components**: PascalCase (e.g., `MyComponent.jsx`)
- **Functions**: camelCase (e.g., `formatDate()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **CSS Classes**: Tailwind utilities, semantic naming
- **Variables**: camelCase (e.g., `isLoading`)

### File Organization

```
Component.jsx
├── Imports
├── Type definitions (if using TypeScript)
├── Component definition
├── Hooks and state
├── Event handlers
├── Effects
├── Render logic
└── Export
```

## State Management Best Practices

### When to use Context vs Local State

- **Context**: Global data (user, auth, theme)
- **Local State**: Component-specific data (form inputs, UI state)
- **Custom Hooks**: Reusable logic (useAsync, useForm)

### Example: Fetching Data

```jsx
import { useAsync } from '@/hooks/useCustom';
import { serviceApi } from '@/services/api';

const ServiceList = () => {
  const { execute: fetchServices, loading, error, data } = useAsync(
    serviceApi.getAllServices
  );

  useEffect(() => {
    fetchServices();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage error={error} />;

  return <div>{/* Render services */}</div>;
};
```

## API Integration

### Adding New API Calls

1. Add endpoint to `src/constants/index.js`
2. Create service function in `src/services/api.js`
3. Use in components with hooks

```jsx
// In src/services/api.js
export const customApi = {
  getCustomData: () => api.get('/custom'),
  createCustomData: (data) => api.post('/custom', data),
};

// In component
const { data } = await customApi.getCustomData();
```

## Error Handling

### Component-level Errors

```jsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

### API Error Handling

```jsx
try {
  const data = await apiCall();
} catch (error) {
  logger.error('API call failed', error);
  // Handle error
}
```

## Styling Guidelines

- Use Tailwind CSS utility classes
- Maintain consistent spacing: `p-2`, `p-4`, `p-6`, `p-8`
- Use semantic color names: `primary`, `secondary`, `danger`, `warning`
- Keep consistent border-radius: `rounded`, `rounded-lg`, `rounded-full`

### Responsive Design

```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Mobile: 1 col, Tablet: 2 cols, Desktop: 3 cols */}
</div>
```

## Testing Recommendations

(To be implemented)

- Use Jest for unit tests
- Use React Testing Library for component tests
- Aim for 80%+ code coverage

## Performance Tips

1. **Code Splitting**: Use React.lazy() for route-based code splitting
2. **Memoization**: Use React.memo() for expensive components
3. **Debouncing**: Use custom useDebounce hook for search inputs
4. **Lazy Loading**: Implement image lazy loading
5. **Bundle Analysis**: Use rollup-plugin-visualizer

## Debugging

### Using Logger

```jsx
import { logger } from '@/utils/logger';

logger.debug('Component mounted', { userId: user.id });
logger.error('API call failed', { status: error.status });
```

### Browser DevTools

- React DevTools for component inspection
- Redux DevTools for state inspection (when migrating)
- Network tab for API calls
- Performance tab for rendering issues

## Common Issues & Solutions

### Issue: Components not re-rendering

**Solution**: Ensure dependencies in useEffect are correct

```jsx
// Wrong
useEffect(() => {
  // code
}, []); // Missing dependencies

// Correct
useEffect(() => {
  // code
}, [dependency]); // All dependencies listed
```

### Issue: Infinite API calls

**Solution**: Add proper dependency management

```jsx
const { execute } = useAsync(apiCall);

useEffect(() => {
  execute(); // Will be called once on mount and when dependencies change
}, [execute]); // List all dependencies
```

### Issue: Memory leaks

**Solution**: Always cleanup in useEffect

```jsx
useEffect(() => {
  const subscription = someSubscription();
  
  return () => {
    subscription.unsubscribe(); // Cleanup
  };
}, []);
```

## Resources

- [React Documentation](https://react.dev)
- [React Router Documentation](https://reactrouter.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Vite Documentation](https://vite.dev)

---

For more questions, refer to the main README.md or create an issue in the repository.
