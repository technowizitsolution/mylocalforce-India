import React, { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiClock, FiDollarSign } from 'react-icons/fi';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import {
  fetchProviderCommissionRate,
  subscribeToProviderBookings,
} from '../services/firebase/serviceService';
import BookingDetailModal from '../customer/components/BookingDetailModal';
import { calculatePaymentBreakdownV2, formatCurrency } from '../config/paymentConfig';

const statusLabels = {
  pending_payment: 'Pending Payment',
  upcoming: 'Upcoming',
  accepted: 'Accepted',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  paid: 'Paid',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = toDate(value);
  if (!date) return value || 'TBD';
  return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const parseAmount = (value) => parseFloat(String(value ?? '').replace(/[^0-9.]/g, '')) || 0;

const getProviderPricing = (booking, commissionRate) => {
  const serviceFee = parseAmount(booking.packageData?.price ?? booking.price);
  return calculatePaymentBreakdownV2(serviceFee, {
    companyCommissionRatePercent: commissionRate ?? undefined,
  });
};

const ProviderBookingsScreen = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [providerCommissionRate, setProviderCommissionRate] = useState(null);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribe = subscribeToProviderBookings(user.uid, (updatedBookings) => {
      setBookings(updatedBookings);
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    let mounted = true;
    fetchProviderCommissionRate(user.uid)
      .then((rate) => {
        if (mounted) setProviderCommissionRate(rate);
      })
      .catch((error) => {
        console.error('Error loading provider commission rate:', error);
      });

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const stats = useMemo(
    () => ({
      active: bookings.filter((booking) =>
        ['upcoming', 'accepted', 'arrived', 'in_progress'].includes(booking.status)
      ).length,
      completed: bookings.filter((booking) => ['completed', 'paid'].includes(booking.status))
        .length,
      total: bookings.length,
    }),
    [bookings]
  );

  if (loading) return <Loading fullScreen />;

  return (
    <ProviderAppLayout>
      <ProviderPageTitle title="Bookings" subtitle="Track all customer jobs assigned to you." />

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat value={stats.active} label="Active" />
        <Stat value={stats.completed} label="Completed" />
        <Stat value={stats.total} label="Total" />
      </div>

      <div className="mt-6 space-y-3">
        {bookings.length > 0 ? (
          bookings.map((booking) => {
            const pricing = getProviderPricing(booking, providerCommissionRate);

            return (
              <button
                type="button"
                key={booking.id}
                onClick={() => setSelectedBookingId(booking.id)}
                className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      {booking.customerName || 'Customer'}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {booking.serviceName || 'Service'}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {statusLabels[booking.status] || booking.status || 'Upcoming'}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <FiCalendar className="h-4 w-4" />
                    {formatDate(booking.selectedDate || booking.requestedDate || booking.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FiClock className="h-4 w-4" />
                    {booking.selectedTime || booking.requestedTime || booking.scheduledTime || 'TBD'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FiDollarSign className="h-4 w-4" />
                    Your earning {formatCurrency(pricing.providerPayout.amount)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs font-semibold text-slate-500 sm:grid-cols-3">
                  <span>Service fee: {formatCurrency(pricing.servicePrice)}</span>
                  <span>Platform fee: {pricing.platformFee.rate} ({formatCurrency(pricing.platformFee.amount)})</span>
                  <span>Commission: {pricing.companyCommission.rate}</span>
                </div>
              </button>
            );
          })
        ) : (
          <EmptyState title="No bookings yet" message="Customer bookings will appear here." />
        )}
      </div>

      <BookingDetailModal
        visible={Boolean(selectedBookingId)}
        bookingId={selectedBookingId}
        role="provider"
        onClose={() => setSelectedBookingId(null)}
      />

      <Footer />
    </ProviderAppLayout>
  );
};

const ProviderPageTitle = ({ title, subtitle }) => (
  <header className="border-b border-slate-200 pb-6">
    <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h1>
    <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
  </header>
);

const Stat = ({ value, label }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
    <p className="text-2xl font-semibold text-[#5A52E3]">{value}</p>
    <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
  </div>
);

const EmptyState = ({ title, message }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
    <p className="font-medium text-slate-800">{title}</p>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
  </div>
);

export default ProviderBookingsScreen;
