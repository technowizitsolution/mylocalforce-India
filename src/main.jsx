import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import ScrollToTop from './components/ScrollToTop';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <App />
          <Toaster
            closeButton
            expand={false}
            visibleToasts={4}
            position="top-right"
            duration={7000}
            toastOptions={{
              style: {
                maxWidth: 'calc(100vw - 24px)',
                marginTop: 'max(12px, env(safe-area-inset-top))',
                marginRight: 'max(12px, env(safe-area-inset-right))',
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
