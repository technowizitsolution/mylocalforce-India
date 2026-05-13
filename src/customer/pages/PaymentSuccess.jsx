import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiXCircle, FiLoader } from 'react-icons/fi';
import { deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firestore } from '../../services/firebase/firebaseConfig';
import {
  notifyProviderNewBooking,
  saveNotificationToFirestore,
  sendPushNotification,
} from '../../services/firebase/notificationService';
import { resolveBookingCheckoutAmount } from '../../utils/bookingPayments';
import { notify } from '../../utils/toast';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id');
  const status = searchParams.get('status'); // 'success' or 'cancelled'
  const isCancelledReturn = status === 'cancelled' || location.pathname.includes('payment-cancelled');

  const [pageState, setPageState] = useState('loading'); // loading | success | sync-warning | cancelled | error
  const [bookingData, setBookingData] = useState(null);

  useEffect(() => {
    const finalizeLeadAfterPayment = async (data, paidBookingId = bookingId) => {
      const leadId = data?.leadId;
      if (!leadId) return;

      try {
        const leadRef = doc(firestore, 'leads', leadId);
        const leadSnap = await getDoc(leadRef);
        if (!leadSnap.exists()) {
          console.warn('Lead not found after web payment success:', leadId);
          return;
        }

        const leadData = leadSnap.data() || {};
        const providerId =
          leadData.providerId ||
          data.leadExpectedProviderId ||
          data.providerId ||
          null;

        if (!providerId) {
          console.warn('Lead has no provider after web payment success:', leadId);
          return;
        }

        if (
          leadData.status === 'accepted' &&
          String(leadData.bookingId || '') === String(paidBookingId)
        ) {
          return;
        }

        if (
          data.leadExpectedProviderId &&
          leadData.providerId &&
          String(data.leadExpectedProviderId) !== String(leadData.providerId)
        ) {
          console.warn(
            'Lead provider changed before web payment confirmation',
            leadId,
            data.leadExpectedProviderId,
            leadData.providerId
          );
        }

        await updateDoc(leadRef, {
          status: 'accepted',
          bookingId: paidBookingId,
          paymentStatus: 'paid',
          acceptedAt: serverTimestamp(),
          acceptedByCustomerId: data.customerId || leadData.customerId || null,
          acceptedProviderId: providerId,
          updatedAt: serverTimestamp(),
        });

        const providerAcceptNotification = {
          title: 'Lead Accepted',
          body: `${data.customerName || leadData.customerName || 'A customer'} accepted your offer for ${data.serviceName || leadData.serviceName || 'this service'}.`,
          data: {
            type: 'LEAD_ACCEPTED',
            leadId,
            bookingId: paidBookingId,
            role: 'provider',
          },
        };

        try {
          await saveNotificationToFirestore(providerId, providerAcceptNotification);
          await sendPushNotification(providerId, providerAcceptNotification, {
            saveToFirestore: false,
          });
        } catch (notificationError) {
          console.warn(
            'Failed to notify accepted provider after web payment:',
            notificationError?.message || notificationError
          );
        }

        const providerSet = new Set();
        if (Array.isArray(leadData.notifiedProviderIds)) {
          leadData.notifiedProviderIds.forEach((pid) => {
            if (pid) providerSet.add(pid);
          });
        }
        if (Array.isArray(leadData.offers)) {
          leadData.offers.forEach((offer) => {
            if (offer?.providerId) providerSet.add(offer.providerId);
          });
        }
        providerSet.add(providerId);

        const finalizedNotification = {
          title: 'Lead Finalized',
          body: `${data.providerName || leadData.providerName || 'A provider'} was accepted for this lead. No further offers will be accepted.`,
          data: {
            type: 'LEAD_FINALIZED',
            leadId,
            bookingId: paidBookingId,
            acceptedProviderId: providerId,
            role: 'provider',
          },
        };

        for (const pid of providerSet) {
          if (String(pid) === String(providerId)) continue;
          try {
            await saveNotificationToFirestore(pid, finalizedNotification);
            await sendPushNotification(pid, finalizedNotification, {
              saveToFirestore: false,
            });
          } catch (notifyError) {
            console.warn(
              'Failed to send web lead finalized notification:',
              pid,
              notifyError?.message || notifyError
            );
          }
        }
      } catch (error) {
        console.error('Error finalizing web lead after payment:', error);
      }
    };

    const handlePaymentResult = async () => {
      if (!bookingId) {
        setPageState(isCancelledReturn ? 'cancelled' : 'error');
        return;
      }

      try {
        const bookingRef = doc(firestore, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (bookingSnap.exists()) {
          const data = bookingSnap.data();
          setBookingData(data);

          if (isCancelledReturn) {
            if (data.paymentStatus !== 'paid' && data.status === 'pending_payment') {
              try {
                await deleteDoc(bookingRef);
                setBookingData(null);
              } catch (deleteError) {
                console.warn(
                  'Payment cancelled but pending booking could not be removed:',
                  deleteError?.message || deleteError
                );
              }
            }

            setPageState('cancelled');
            return;
          }

          const alreadyPaid = data.paymentStatus === 'paid';
          const amountPaid = resolveBookingCheckoutAmount(data);

          if (!alreadyPaid) {
            const paymentUpdate = {
              paymentStatus: 'paid',
              status: 'upcoming',
              stripeSessionId: sessionId || null,
              totalAmountPaid: amountPaid,
              paidAt: serverTimestamp(),
              paymentConfirmedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            await updateDoc(bookingRef, paymentUpdate);
            setBookingData({
              ...data,
              ...paymentUpdate,
              paidAt: new Date(),
              paymentConfirmedAt: new Date(),
            });

            if (data.providerId && !data.providerNotifiedAt) {
              try {
                await notifyProviderNewBooking(data.providerId, {
                  bookingId,
                  customerId: data.customerId,
                  customerName: data.customerName || 'A customer',
                  serviceName: data.serviceName || 'a service',
                });
                await updateDoc(bookingRef, {
                  providerNotifiedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (notificationError) {
                console.warn(
                  'Payment confirmed but provider notification could not be sent:',
                  notificationError
                );
              }
            }

            await finalizeLeadAfterPayment(data);
          } else if (data.status === 'pending_payment') {
            await updateDoc(bookingRef, {
              status: 'upcoming',
              updatedAt: serverTimestamp(),
            });
            setBookingData({
              ...data,
              status: 'upcoming',
            });

            if (data.providerId && !data.providerNotifiedAt) {
              try {
                await notifyProviderNewBooking(data.providerId, {
                  bookingId,
                  customerId: data.customerId,
                  customerName: data.customerName || 'A customer',
                  serviceName: data.serviceName || 'a service',
                });
                await updateDoc(bookingRef, {
                  providerNotifiedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } catch (notificationError) {
                console.warn(
                  'Payment was already marked paid but provider notification could not be sent:',
                  notificationError
                );
              }
            }

            await finalizeLeadAfterPayment(data);
          } else {
            await finalizeLeadAfterPayment(data);
          }
        } else {
          if (isCancelledReturn) {
            setPageState('cancelled');
            return;
          }

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
  }, [bookingId, isCancelledReturn, sessionId]);

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
            Your booking has not been confirmed. Start again when you are ready to complete
            payment.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/customer/services')}
              className="w-full py-3 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-600 transition-colors"
            >
              Book Again
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
            {(bookingData.totalAmountPaid != null ||
              bookingData.amountBeforeStripe != null ||
              bookingData.totalAmount != null ||
              bookingData.price != null) && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-400">Amount Paid</span>
                <span className="text-sm font-bold text-indigo-500">
                  A${Number(
                    bookingData.totalAmountPaid ??
                      bookingData.amountBeforeStripe ??
                      bookingData.totalAmount ??
                      bookingData.price ??
                      0
                  ).toFixed(2)}
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
