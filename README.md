# MyLocalForce - Service Booking Platform

A modern, full-featured service booking platform built with React, Vite, and Tailwind CSS. Connect customers with local service providers seamlessly.

## 🚀 Features

- **Customer Portal**: Browse and book services from local providers
- **Service Provider Dashboard**: Manage bookings and services
- **Real-time Notifications**: Stay updated with booking notifications
- **Search & Filter**: Powerful search with category filtering
- **Responsive Design**: Works perfectly on mobile and desktop
- **Authentication**: Secure login/signup with role-based access
- **Error Handling**: Comprehensive error boundaries and loading states

## 📋 Prerequisites

- Node.js 16 or higher
- npm 8 or higher

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd MLF
```

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
cp .env.example .env.local
```

4. **Configure your API endpoint**
Edit `.env.local` and set your API base URL:
```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=MyLocalForce
VITE_ENVIRONMENT=development
```

## 📖 Development

### Start Development Server
```bash
npm run dev
```
Starts Vite dev server at http://localhost:3000

### Build for Production
```bash
npm run build
```
Creates optimized production build in `dist/` folder

### Preview Production Build
```bash
npm run preview
```

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

## 📁 Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ErrorBoundary.jsx
│   ├── RoleProtectedRoute.jsx
│   ├── StateComponents.jsx
│   └── ...
├── context/             # React context for state management
│   └── AuthContext.jsx
├── customer/            # Customer-specific pages & components
│   ├── components/
│   ├── pages/
│   └── Customer.jsx
├── services/            # API service layer
│   └── api.js
├── App.jsx             # Root component
├── main.jsx            # Entry point
└── index.css           # Global styles
```

## 🔐 Authentication

The app uses React Context API for authentication state management. 

### Features:
- Login/Signup with email & password
- Token-based authentication
- Role-based access control (Customer/Provider)
- Auto logout on token expiry

### Usage:
```jsx
import { useAuth } from './context/AuthContext';

const MyComponent = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  return (
    // Your component
  );
};
```

## 🔗 API Integration

API calls are centralized in `src/services/api.js`:

```jsx
import { serviceApi, bookingApi, userApi } from '@/services/api';

// Get all services
const services = await serviceApi.getAllServices();

// Create booking
const booking = await bookingApi.createBooking(bookingData);

// Get user profile
const profile = await userApi.getProfile();
```

## 🎨 Styling

- **Tailwind CSS** for utility-first styling
- **Custom color theme** in `tailwind.config.js`
- **Responsive design** with mobile-first approach

### Colors:
- Primary: Indigo (customizable)
- Secondary: Gray
- Status: Red/Green/Yellow

## ⚠️ Error Handling

The app includes:
- **Error Boundaries**: Catch React component errors
- **Loading States**: Show loading spinners during async operations
- **Error Messages**: User-friendly error notifications
- **API Error Handling**: Graceful handling of API failures

## 🔄 State Management

Uses **React Context API** for:
- Authentication state
- User information
- Global app configuration

For larger scale, consider migrating to Redux or Zustand.

## 📱 Responsive Design

- **Mobile-first** approach
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Touch-friendly** UI elements
- **Optimized** for all screen sizes

## 🔧 Configuration

### Tailwind Config
Edit `tailwind.config.js` to customize:
- Colors
- Fonts
- Spacing
- Breakpoints

### Prettier Config
Edit `.prettierrc` to customize:
- Indentation
- Line length
- Quote style

### ESLint Config
Edit `eslint.config.js` to customize:
- Rules strictness
- Plugin configurations

## 🚀 Performance Optimization

- Code splitting via Vite
- Tree-shaking of unused code
- Minification in production
- Image optimization recommendations

## 📚 Libraries Used

- **react**: UI library
- **react-router-dom**: Client-side routing
- **tailwindcss**: CSS framework
- **lucide-react**: Icon library
- **react-icons**: Additional icons

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit a pull request

## 📝 Code Standards

- **ESLint**: Enforces code quality
- **Prettier**: Consistent code formatting
- **React Best Practices**: Hooks, functional components
- **Component Naming**: PascalCase
- **File Naming**: PascalCase for components, camelCase for utilities

## 🐛 Troubleshooting

### Port already in use
```bash
# Use different port
npm run dev -- --port 3001
```

### Environment variables not loading
- Ensure `.env.local` file exists
- Variables must start with `VITE_`
- Restart dev server after changes

### API calls failing
- Check VITE_API_BASE_URL in `.env.local`
- Verify backend API is running
- Check browser console for CORS errors

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For issues and support, please open an issue in the repository.

---

**Last Updated**: February 2026
**Version**: 1.0.0

