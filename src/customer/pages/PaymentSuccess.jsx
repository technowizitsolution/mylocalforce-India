import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '../../services/firebase/firebaseConfig';
import { notify } from '../../utils/toast';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id');
  const status = searchParams.get('status'); // 'success' or 'cancelled'

  const [pageState, setPageState] = useState('loading'); // loading | success | sync-warning | cancelled | error
  const [bookingData, setBookingData] = useState(null);

  useEffect(() => {
    const handlePaymentResult = async () => {
      // If user cancelled payment
      if (status === 'cancelled') {
        setPageState('cancelled');
        return;
      }

      // Payment success flow
      if (!bookingId) {
        setPageState('error');
        return;
      }

      try {
        // Fetch the booking to show confirmation details
        const bookingRef = doc(firestore, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (bookingSnap.exists()) {
          const data = bookingSnap.data();
          setBookingData(data);

          // Update booking payment status if still pending
          if (data.paymentStatus === 'pending') {
            await updateDoc(bookingRef, {
              paymentStatus: 'paid',
              stripeSessionId: sessionId || null,
              paidAt: new Date().toISOString(),
            });
          }
        } else {
          notify.warning('Payment received. Final confirmation may take a moment.', {
            id: 'payment-sync-warning',
          });
          setPageState('sync-warning');
          return;
        }

        setPageState('success');
      } catch (error) {
        console.error('Error processing payment result:', error);
        notify.warning('Payment received. Final confirmation may take a moment.', {
          id: 'payment-sync-warning',
        });
        setPageState('sync-warning');
      }
    };

    handlePaymentResult();
  }, [bookingId, sessionId, status]);

  if (pageState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
        <FiLoader size={48} className="text-indigo-500 animate-spin mb-4" />
        <p className="text-lg text-slate-600">Processing your payment...</p>
      </div>
    );
  }

  if (pageState === 'cancelled') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <FiXCircle size={64} className="text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Payment Cancelled</h1>
          <p className="text-sm text-slate-500 mb-6">
            Your payment was cancelled. Your booking has not been confirmed.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/customer/bookings')}
              className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
            >
              View Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <FiXCircle size={64} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-500 mb-6">
            We couldn&apos;t verify your payment. Please check your bookings or contact support.
          </p>
          <button
            onClick={() => navigate('/customer/bookings')}
            className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors"
          >
            View Bookings
          </button>
        </div>
      </div>
    );
  }

  const hasSyncWarning = pageState === 'sync-warning';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            hasSyncWarning ? 'bg-amber-100' : 'bg-emerald-100'
          }`}
        >
          {hasSyncWarning ? (
            <FiAlertTriangle size={46} className="text-amber-500" />
          ) : (
            <FiCheckCircle size={48} className="text-emerald-500" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          {hasSyncWarning ? 'Payment Received' : 'Payment Successful!'}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {hasSyncWarning
            ? 'Final booking confirmation may take a moment. Please check your bookings shortly.'
            : 'Your booking has been confirmed. You will receive a confirmation via email.'}
        </p>

        {bookingData && (
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
            {bookingData.serviceName && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Service</span>
                <span className="text-sm font-semibold text-slate-800">
                  {bookingData.serviceName}
                </span>
              </div>
            )}
            {bookingData.selectedDate && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Date</span>
                <span className="text-sm font-semibold text-slate-800">
                  {bookingData.selectedDate}
                </span>
              </div>
            )}
            {bookingData.selectedTime && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Time</span>
                <span className="text-sm font-semibold text-slate-800">
                  {bookingData.selectedTime}
                </span>
              </div>
            )}
            {bookingData.price != null && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Amount Paid</span>
                <span className="text-sm font-bold text-indigo-500">
                  ${bookingData.price}
                </span>
              </div>
            )}
            {bookingData.providerName && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Provider</span>
                <span className="text-sm font-semibold text-slate-800">
                  {bookingData.providerName}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/customer/bookings')}
            className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors"
          >
            View My Bookings
          </button>
          <button
            onClick={() => navigate('/customer')}
            className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
