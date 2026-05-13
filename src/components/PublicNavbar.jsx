import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FiDownload, FiLogIn, FiMenu, FiRefreshCw, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const baseNavItems = [
  { label: 'About us', to: '/about' },
  { label: 'Careers', to: '/careers' },
  { label: 'Contact us', to: '/contact' },
];

const appUrl =
  'https://play.google.com/store/apps/details?id=com.mylocalforceapp&pcampaignid=web_share';

const PublicNavbar = ({
  variant = 'light',
  overlay = false,
  transparentAtTop = true,
  scrollTargetId,
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoggedIn, user, userRoles, activeRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const isSignedIn = isAuthenticated || isLoggedIn;
  const showLogin = !isSignedIn;
  const roles = userRoles?.roles || user?.roles || {};
  const canSwitchRole = Boolean(roles.customer && roles.client);

  const homePath = useMemo(() => {
    const pathname = location.pathname || '/';

    if (pathname.startsWith('/customer')) {
      return '/customer';
    }

    if (pathname.startsWith('/provider')) {
      return '/provider/home';
    }

    if (!isSignedIn) {
      return '/';
    }

    if (roles.customer) {
      return '/customer';
    }

    if (activeRole === 'customer') {
      return '/customer';
    }

    if (roles.client || activeRole === 'client') {
      return '/provider/home';
    }

    return '/';
  }, [activeRole, isSignedIn, location.pathname, roles]);

  const navItems = useMemo(() => [{ label: 'Home', to: homePath }, ...baseNavItems], [homePath]);

  useEffect(() => {
    const scrollTarget = scrollTargetId ? document.getElementById(scrollTargetId) : window;

    if (!scrollTarget) return undefined;

    const getScrollTop = () => (scrollTarget === window ? window.scrollY : scrollTarget.scrollTop);

    const updateScrollState = () => {
      setHasScrolled(getScrollTop() > 8);
    };

    updateScrollState();
    scrollTarget.addEventListener('scroll', updateScrollState, {
      passive: true,
    });

    return () => {
      scrollTarget.removeEventListener('scroll', updateScrollState);
    };
  }, [scrollTargetId]);

  const isTransparent = transparentAtTop && !hasScrolled;
  const useLightText = isTransparent && variant === 'transparent';

  const shellClass = overlay
    ? `sticky left-0 right-0 top-0 z-30 -mb-16 transition-colors duration-300 ${
        isTransparent ? 'bg-transparent' : 'border-b border-gray-200 bg-white shadow-sm'
      }`
    : `sticky top-0 z-30 transition-colors duration-300 ${
        isTransparent ? 'bg-transparent' : 'border-b border-gray-200 bg-white shadow-sm'
      }`;

  const brandTextClass = useLightText ? 'text-white' : 'text-gray-950';
  const linkBaseClass = 'rounded-md px-2 py-2 text-sm font-semibold transition lg:px-3';
  const linkClass = ({ isActive }) =>
    `${linkBaseClass} ${
      useLightText
        ? isActive
          ? 'bg-white/18 text-white'
          : 'text-white/86 hover:bg-white/12 hover:text-white'
        : isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-950'
    }`;

  const mobileButtonClass = useLightText
    ? 'border-white/45 text-white hover:bg-white/12'
    : 'border-gray-300 text-gray-800 hover:bg-gray-100';

  const mobilePanelClass = useLightText
    ? 'border-white/20 bg-gray-950/94 text-white shadow-2xl backdrop-blur'
    : 'border-gray-200 bg-white text-gray-950 shadow-xl';
  const outlineActionClass = useLightText
    ? 'border-white/60 text-white hover:bg-white/12'
    : 'border-gray-300 text-gray-800 hover:border-gray-400 hover:bg-gray-50';

  return (
    <header className={shellClass}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to={homePath} className="flex min-w-0 items-center gap-3">
          <img
            src="/images/MLF.jpg"
            alt="My Local Force"
            className="h-10 w-10 shrink-0 rounded object-cover"
          />
          <span className={`truncate text-sm font-extrabold sm:text-base ${brandTextClass}`}>
            MY LOCAL FORCE
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {canSwitchRole ? (
            <Link
              to="/role-selection"
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${outlineActionClass}`}
            >
              <FiRefreshCw className="h-4 w-4" />
              Switch
            </Link>
          ) : null}
          {showLogin ? (
            <Link
              to="/login"
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${outlineActionClass}`}
            >
              <FiLogIn className="h-4 w-4" />
              Login
            </Link>
          ) : null}
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <FiDownload className="h-4 w-4" />
            Get App
          </a>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition lg:hidden ${mobileButtonClass}`}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
        >
          {isOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
        </button>
      </div>

      {isOpen ? (
        <div className="px-4 pb-4 sm:px-6 lg:hidden">
          <div className={`mx-auto max-w-7xl rounded-lg border p-3 ${mobilePanelClass}`}>
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsOpen(false)}
                  className={linkClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 grid gap-2 border-t border-current/10 pt-3">
              {canSwitchRole ? (
                <Link
                  to="/role-selection"
                  onClick={() => setIsOpen(false)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${outlineActionClass}`}
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Switch Role
                </Link>
              ) : null}
              {showLogin ? (
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${outlineActionClass}`}
                >
                  <FiLogIn className="h-4 w-4" />
                  Login
                </Link>
              ) : null}
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <FiDownload className="h-4 w-4" />
                Get App
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default PublicNavbar;
