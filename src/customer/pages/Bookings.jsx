import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiInfo,
  FiScissors,
  FiHome,
  FiWind,
  FiZap,
  FiLock,
  FiDroplet,
  FiUser,
  FiSettings,
  FiStar,
  FiChevronRight,
  FiRefreshCw,
  FiSearch,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { fetchUserBookings, subscribeToUserBookings } from '../../services/firebase';
import BookingDetailModal from '../components/BookingDetailModal';
import NotificationBell from '../components/NotificationBell';

/* ── Icon look-ups ── */
const STATUS_MAP = {
  pending_payment: { icon: FiClock, color: 'text-amber-600', bg: 'bg-amber-500/10' },
  upcoming: { icon: FiClock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  completed: { icon: FiCheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  cancelled: { icon: FiXCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  default: { icon: FiInfo, color: 'text-gray-400', bg: 'bg-gray-400/10' },
};

const SERVICE_ICONS = {
  'woman salon': FiScissors,
  'beauty therapy': FiHome,
  massage: FiWind,
  'electrician plumber and carpenters': FiZap,
  'beard trim': FiLock,
  'native water': FiDroplet,
  'massage for man': FiUser,
};

const getStatusMeta = (status) => STATUS_MAP[status] || STATUS_MAP.default;
const getServiceIcon = (category) => SERVICE_ICONS[category?.toLowerCase()] || FiSettings;
const formatStatus = (status) => (status === 'pending_payment' ? 'Awaiting payment' : status);

/* ══════════════════════════════════════════════════════════ */

const Bookings = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [bookingDetailVisible, setBookingDetailVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  /* ── Fallback one-time fetch (defined before the effect) ── */
  const loadBookingsOnce = useCallback(async () => {
    if (!user || !isLoggedIn) {
      setBookings([]);
      setLoading(false);
      return;
    }
    try {
      const userBookings = await fetchUserBookings(user.uid);
      setBookings(userBookings);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isLoggedIn]);

  /* ── Real-time subscription ── */
  useEffect(() => {
    let unsubscribe = null;

    const setup = async () => {
      if (!user || !isLoggedIn) {
        setBookings([]);
        setLoading(false);
        return;
      }
      try {
        unsubscribe = subscribeToUserBookings(user.uid, (updated) => {
          setBookings(updated);
          setLoading(false);
          setRefreshing(false);
        });
      } catch (err) {
        console.error('Error setting up real-time updates:', err);
        await loadBookingsOnce();
      }
    };

    setup();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isLoggedIn, loadBookingsOnce]);

  /* ── Refresh handler ── */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookingsOnce();
  }, [loadBookingsOnce]);

  const handleLogin = () => navigate('/login', { replace: true });

  /* ── Not-logged-in state ── */
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-violet-50 flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md lg:max-w-lg bg-white rounded-2xl lg:rounded-3xl shadow-lg lg:shadow-xl p-8 sm:p-10 lg:p-14 flex flex-col items-center text-center">
          <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-violet-100 flex items-center justify-center mb-6">
            <FiCalendar className="w-10 h-10 lg:w-12 lg:h-12 text-violet-600" />
          </div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-800 mb-2">Track Your Bookings</h2>
          <p className="text-gray-500 text-sm lg:text-base mb-8 max-w-xs lg:max-w-sm">
            Login to view and manage your service bookings
          </p>

          <button
            onClick={handleLogin}
            className="w-full sm:w-auto bg-violet-600 text-white font-bold px-10 py-3.5 rounded-xl shadow-md hover:bg-violet-700 hover:shadow-lg active:scale-[0.98] transition-all duration-200 mb-10 cursor-pointer"
          >
            Login to Continue
          </button>

          <div className="w-full border-t border-gray-100 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {[
                { Icon: FiClock, text: 'Track booking status' },
                { Icon: FiCalendar, text: 'Reschedule appointments' },
                { Icon: FiStar, text: 'Rate & review services' },
              ].map(({ Icon, text }) => (
                <div
                  key={text}
                  className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2"
                >
                  <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-violet-600" />
                  </div>
                  <span className="text-gray-500 text-sm">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Logged-in view ── */
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-slate-100">
      {/* Desktop nav - shown on md+ */}
      <header className="hidden lg:block sticky top-0 z-20 border-b border-gray-200 bg-[#F8FAFC]/95 backdrop-blur-sm">
        <div>
          <nav className="flex items-center justify-between px-6 lg:px-30 py-3 gap-6">
            {/* Logo */}
            <div
              onClick={() => navigate('/customer')}
              className="flex items-center gap-3 cursor-pointer shrink-0"
            >
              <img
                src="/images/MLF.jpg"
                alt="Logo"
                className="w-12 h-12 object-cover rounded-lg border border-blue-100"
              />
              <p className="text-[#5A52E3] text-2xl font-bold">MY LOCAL FORCE</p>
            </div>

            {/* Right section */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 border border-blue-100 rounded-lg bg-white w-80">
                <FiSearch className="text-[#5A52E3] w-5 h-5 shrink-0" />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder-gray-400"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              {isLoggedIn && (
                <NotificationBell
                  onPress={() => navigate('/customer/notifications')}
                  size={20}
                  color="#5A52E3"
                  role="customer"
                  bgColor="white"
                />
              )}
              <button
                onClick={() => navigate('/customer/profile')}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-[#6C63FF]/40 hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer"
              >
                <FiUser className="w-5 h-5 text-[#5A52E3]" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile nav - shown below md */}
      <header className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">My Bookings</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {bookings.length} booking{bookings.length !== 1 && 's'} found
                {refreshing && ' • Refreshing…'}
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh bookings"
            >
              <FiRefreshCw
                className={`w-5 h-5 text-violet-600 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop title bar - shown on md+ */}
      <div className="hidden md:block ">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">My Bookings</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {bookings.length} booking{bookings.length !== 1 && 's'} found
                {refreshing && ' • Refreshing…'}
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors disabled:opacity-50 cursor-pointer text-sm font-medium text-violet-600"
              title="Refresh bookings"
            >
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <FiRefreshCw className="w-10 h-10 text-violet-600 animate-spin" />
          <p className="text-gray-400 mt-4 text-sm lg:text-base">Loading your bookings…</p>
        </div>
      ) : bookings.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
          <div className="w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-gray-100 flex items-center justify-center">
            <FiCalendar className="w-12 h-12 lg:w-14 lg:h-14 text-gray-300" />
          </div>
          <h3 className="text-lg lg:text-xl font-bold text-gray-800 mt-6 mb-2">No bookings yet</h3>
          <p className="text-gray-400 leading-relaxed mb-8 max-w-xs lg:max-w-sm text-sm lg:text-base">
            Your service bookings will appear here once you make your first booking.
          </p>
          <button
            onClick={() => navigate('/customer/services')}
            className="bg-violet-600 text-white font-bold px-8 py-3.5 rounded-xl shadow-md hover:bg-violet-700 hover:shadow-lg active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            Browse Services
          </button>
        </div>
      ) : (
        /* ── Booking list ── */
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
            {bookings.map((item) => {
              const { icon: StatusIcon, color, bg } = getStatusMeta(item.status);
              const ServiceIcon = getServiceIcon(item.category);

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedBookingId(item.id);
                    setBookingDetailVisible(true);
                  }}
                  className="w-full text-left bg-white rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 border border-gray-100 transition-all duration-200 cursor-pointer group"
                >
                  {/* Card header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {item.serviceImage ? (
                        <img
                          src={item.serviceImage}
                          alt=""
                          className="w-14 h-14 lg:w-16 lg:h-16 rounded-xl object-cover bg-gray-100 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                          <ServiceIcon className="w-6 h-6 lg:w-7 lg:h-7 text-violet-600" />
                        </div>
                      )}
                      <div className="min-w-0 pt-0.5">
                        <p className="font-bold text-gray-800 truncate text-sm lg:text-base">
                          {item.serviceName ||
                            item.serviceTitle ||
                            item.subcategory ||
                            item.category ||
                            'Service Booking'}
                        </p>
                        <p className="text-xs lg:text-sm text-gray-400 truncate mt-0.5">
                          {item.category || 'MyLocalForce Service'}
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] lg:text-xs font-bold uppercase shrink-0 ${bg} ${color}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {formatStatus(item.status)}
                    </span>
                  </div>

                  {/* View details bar */}
                  <div className="flex items-center justify-center gap-1 bg-violet-50 group-hover:bg-violet-100 rounded-xl py-2.5 mt-2 transition-colors">
                    <span className="text-sm font-semibold text-violet-600">View Details</span>
                    <FiChevronRight className="w-4 h-4 text-violet-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      <BookingDetailModal
        visible={bookingDetailVisible}
        bookingId={selectedBookingId}
        role="customer"
        onClose={() => {
          setBookingDetailVisible(false);
          setSelectedBookingId(null);
        }}
      />
    </div>
  );
};

export default Bookings;
