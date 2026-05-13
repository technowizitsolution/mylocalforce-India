import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiClock,
  FiCreditCard,
  FiHome,
  FiLoader,
  FiMapPin,
  FiShield,
  FiShoppingBag,
  FiTag,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firestore } from '../../services/firebase/firebaseConfig';
import { createBooking } from '../../services/firebase';
import { validateCouponCode } from '../../services/firebase/couponService';
import { notifyProviderNewBooking } from '../../services/firebase/notificationService';
import {
  createPaymentIntent,
  getStripeConfigFromFunctions,
  previewPaymentAmount,
  STRIPE_PUBLISHABLE_KEY,
} from '../../services/firebase/stripeService';
import { useAuth } from '../../context/AuthContext';
import {
  calculateCartQuote,
  formatAUD,
  formatPercentage,
  normalizeServiceItems,
  STRIPE_CARD_OPTIONS,
} from '../../utils/cartPricing';
import { notify, getUserFacingError } from '../../utils/toast';

const MIN_BOOKING_AMOUNT = 50;
const STRIPE_JS_URL = 'https://js.stripe.com/v3/';
const isPermissionDeniedError = (error) =>
  error?.code === 'permission-denied' ||
  String(error?.message || error || '')
    .toLowerCase()
    .includes('missing or insufficient permissions');

let stripeJsPromise;

const loadStripeJs = () => {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (stripeJsPromise) return stripeJsPromise;

  stripeJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = STRIPE_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.Stripe);
    script.onerror = () => reject(new Error('Unable to load Stripe payment form.'));
    document.body.appendChild(script);
  });

  return stripeJsPromise;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const DetailPill = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#5A52E3]">
      <Icon size={17} />
    </div>
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">{value || 'Not set'}</p>
    </div>
  </div>
);

const PriceRow = ({ label, value, strong = false, muted = false, discount = false }) => (
  <div className="flex items-center justify-between gap-4">
    <span
      className={`text-sm ${
        strong ? 'font-semibold text-slate-900' : muted ? 'text-slate-400' : 'text-slate-600'
      }`}
    >
      {label}
    </span>
    <span
      className={`text-sm ${
        strong
          ? 'font-bold text-slate-950'
          : discount
            ? 'font-semibold text-emerald-600'
            : 'font-semibold text-slate-800'
      }`}
    >
      {value}
    </span>
  </div>
);

const OrderSummary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const cardContainerRef = useRef(null);
  const stripeRef = useRef(null);
  const cardElementRef = useRef(null);

  const {
    bookingData = null,
    serviceItems: incomingServiceItems = [],
    platformSettings = null,
    leadId = null,
    leadExpectedProviderId = null,
  } = location.state || {};

  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [resolvedPlatformSettings, setResolvedPlatformSettings] = useState(platformSettings);
  const [createdBookingId, setCreatedBookingId] = useState(null);
  const [createdBookingData, setCreatedBookingData] = useState(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [stripeMode, setStripeMode] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState('');
  const [actualPaymentDetails, setActualPaymentDetails] = useState(null);

  useEffect(() => {
    if (!bookingData) return undefined;

    let disposed = false;

    const setupStripeCard = async () => {
      try {
        const Stripe = await loadStripeJs();
        if (disposed || !cardContainerRef.current) return;

        let publishableKey = STRIPE_PUBLISHABLE_KEY;
        let activeMode = null;

        try {
          const stripeConfig = await getStripeConfigFromFunctions();
          publishableKey = stripeConfig.publishableKey;
          activeMode = stripeConfig.mode;
        } catch (configError) {
          console.warn(
            'Could not load Stripe config from functions, using bundled fallback key:',
            configError?.message || configError
          );
        }

        if (disposed || !cardContainerRef.current) return;

        const stripe = Stripe(publishableKey);
        const elements = stripe.elements();
        const card = elements.create('card', {
          hidePostalCode: true,
          style: {
            base: {
              color: '#0f172a',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '16px',
              '::placeholder': {
                color: '#94a3b8',
              },
            },
            invalid: {
              color: '#dc2626',
            },
          },
        });

        card.mount(cardContainerRef.current);
        card.on('change', (event) => {
          setCardComplete(Boolean(event.complete));
          setCardError(event.error?.message || '');
          setActualPaymentDetails(null);
        });

        stripeRef.current = stripe;
        cardElementRef.current = card;
        setStripeMode(activeMode);
        setStripeReady(true);
      } catch (error) {
        console.error('Could not load Stripe card form:', error);
        setCardError(error?.message || 'Unable to load Stripe payment form.');
      }
    };

    setupStripeCard();

    return () => {
      disposed = true;
      if (cardElementRef.current) {
        cardElementRef.current.destroy();
        cardElementRef.current = null;
      }
      stripeRef.current = null;
      setStripeReady(false);
      setStripeMode(null);
      setCardComplete(false);
      setActualPaymentDetails(null);
    };
  }, [bookingData]);

  useEffect(() => {
    let mounted = true;

    const loadPlatformSettings = async () => {
      try {
        const settingsRef = doc(firestore, 'platformSettings', 'main');
        const settingsSnap = await getDoc(settingsRef);
        if (!mounted || !settingsSnap.exists()) return;

        const latest = settingsSnap.data();
        if (latest && typeof latest === 'object') {
          setResolvedPlatformSettings(latest);
        }
      } catch (error) {
        if (!isPermissionDeniedError(error)) {
          console.warn('Could not load platform settings in cart:', error?.message || error);
        }
      }
    };

    loadPlatformSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedServiceItems = useMemo(
    () => normalizeServiceItems(bookingData, incomingServiceItems),
    [bookingData, incomingServiceItems]
  );

  const quote = useMemo(
    () =>
      calculateCartQuote({
        serviceItems: normalizedServiceItems,
        platformSettings: resolvedPlatformSettings,
        couponDiscount: appliedCoupon?.discountAmount || 0,
      }),
    [normalizedServiceItems, resolvedPlatformSettings, appliedCoupon]
  );

  const serviceCount = normalizedServiceItems.length || 1;
  const serviceDisplayName =
    bookingData?.serviceName ||
    (serviceCount === 1 ? normalizedServiceItems[0]?.name : `${serviceCount} services`) ||
    'Service booking';
  const checkoutDescription =
    bookingData?.selectedDate && bookingData?.selectedTime
      ? `${serviceDisplayName} - ${bookingData.selectedDate} at ${bookingData.selectedTime}`
      : serviceDisplayName;
  const checkoutLocked = Boolean(createdBookingId);

  const handleApplyCoupon = async () => {
    if (couponLoading || checkoutLocked) return;

    const normalizedCode = String(couponCode || '')
      .trim()
      .toUpperCase();
    if (!normalizedCode) {
      setCouponError('Please enter a coupon code.');
      setCouponMessage('');
      return;
    }

    setCouponLoading(true);
    setCouponError('');
    setCouponMessage('');

    try {
      const result = await validateCouponCode({
        code: normalizedCode,
        customerId: bookingData?.customerId || user?.uid,
        serviceTotal: quote.serviceTotal,
      });

      if (!result.valid) {
        setAppliedCoupon(null);
        setCouponError(result.error || 'Invalid coupon code.');
        return;
      }

      setAppliedCoupon(result);
      setCouponCode(result.code);
      setCouponMessage(result.message || 'Coupon applied successfully.');
    } catch (error) {
      console.error('Coupon validation error:', error);
      setAppliedCoupon(null);
      setCouponError(error?.message || 'Unable to validate coupon right now.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    if (checkoutLocked) return;
    setAppliedCoupon(null);
    setCouponMessage('Coupon removed.');
    setCouponError('');
  };

  const buildBookingDataToSave = () => ({
    ...bookingData,
    customerId: bookingData?.customerId || user?.uid,
    customerName:
      bookingData?.customerName ||
      user?.fullName ||
      user?.displayName ||
      user?.name ||
      user?.email ||
      'Customer',
    customerEmail: bookingData?.customerEmail || user?.email || null,
    serviceItems: normalizedServiceItems,
    serviceCount,
    serviceName: serviceDisplayName,
    price: quote.serviceTotal,
    serviceTotal: quote.serviceTotal,
    platformFee: quote.platformFee.amount,
    platformFeeType: quote.platformFee.label,
    subtotal: quote.subtotal,
    couponCode: appliedCoupon?.code || null,
    couponDiscount: quote.couponDiscount,
    taxableAmount: quote.taxableAmount,
    gstAmount: quote.gstAmount,
    amountAfterGST: quote.amountAfterGST,
    stripeCardType: null,
    stripeCardCountry: null,
    stripeCharge: null,
    amountBeforeStripe: quote.totalBeforeStripe,
    totalAmount: quote.totalBeforeStripe,
    totalAmountPaid: null,
    currency: 'AUD',
    paymentStatus: 'pending',
    status: 'pending_payment',
    paymentDescription: checkoutDescription,
    paymentFlow: 'stripe_payment_intent',
    paymentProvider: 'stripe',
    createdFrom: 'web',
    leadId: leadId || bookingData?.leadId || null,
    leadExpectedProviderId: leadExpectedProviderId || bookingData?.leadExpectedProviderId || null,
  });

  const handleProceedToPayment = async () => {
    if (isProcessing) return;

    if (!user?.uid) {
      notify.info('Sign in to continue your payment.', { id: 'order-summary-login' });
      navigate('/login');
      return;
    }

    if (quote.totalBeforeStripe <= 0) {
      notify.error('Total payable amount must be greater than zero.', {
        id: 'order-summary-invalid-total',
      });
      return;
    }

    if (quote.totalBeforeStripe < MIN_BOOKING_AMOUNT) {
      notify.warning(`Minimum booking amount is ${formatAUD(MIN_BOOKING_AMOUNT)}.`, {
        id: 'order-summary-minimum',
      });
      return;
    }

    if (!stripeRef.current || !cardElementRef.current || !stripeReady) {
      notify.error('Payment form is still loading. Please try again in a moment.', {
        id: 'order-summary-stripe-loading',
      });
      return;
    }

    if (!cardComplete) {
      notify.warning('Please enter valid card details before paying.', {
        id: 'order-summary-card-incomplete',
      });
      return;
    }

    const paymentToastId = 'order-summary-payment-session';
    notify.loading('Processing secure payment...', { id: paymentToastId });
    setIsProcessing(true);
    let bookingCreatedDuringAttempt = null;

    try {
      const bookingDataToSave = createdBookingData || buildBookingDataToSave();
      let bookingId = createdBookingId;
      const stripe = stripeRef.current;
      const cardElement = cardElementRef.current;
      const billingDetails = {
        email: bookingDataToSave.customerEmail || user?.email || undefined,
        name: bookingDataToSave.customerName || user?.displayName || user?.name || undefined,
        phone: bookingDataToSave.phoneNumber || bookingDataToSave.customerPhone || undefined,
      };

      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: billingDetails,
      });

      if (paymentMethodError || !paymentMethod?.id) {
        throw new Error(paymentMethodError?.message || 'Unable to validate your card.');
      }

      const preview = await previewPaymentAmount({
        bookingData: bookingDataToSave,
        paymentMethodId: paymentMethod.id,
      });

      const paymentDetails = {
        paymentIntentId: null,
        stripeCardType: preview?.stripeCardType === 'international' ? 'international' : 'domestic',
        stripeCardCountry: preview?.stripeCardCountry || null,
        stripeCharge: toNumber(preview?.stripeCharge),
        amountBeforeStripe: toNumber(preview?.amountBeforeStripe),
        totalAmount: toNumber(preview?.amount),
      };

      setActualPaymentDetails(paymentDetails);

      if (!bookingId) {
        bookingId = await createBooking(user.uid, bookingDataToSave);
        bookingCreatedDuringAttempt = bookingId;
        setCreatedBookingId(bookingId);
        setCreatedBookingData(bookingDataToSave);
      }

      const paymentIntentResult = await createPaymentIntent({
        bookingId,
        paymentMethodId: paymentMethod.id,
        currency: 'aud',
        customerEmail: bookingDataToSave.customerEmail,
        customerId: bookingDataToSave.customerId,
        providerId: bookingDataToSave.providerId,
        description: checkoutDescription,
        idempotencyKey: `pi_${bookingId}_${paymentMethod.id}`,
      });

      const finalPaymentDetails = {
        ...paymentDetails,
        paymentIntentId: paymentIntentResult?.paymentIntentId || null,
        stripeCardType:
          paymentIntentResult?.stripeCardType === 'international' ? 'international' : 'domestic',
        stripeCardCountry:
          paymentIntentResult?.stripeCardCountry || paymentDetails.stripeCardCountry,
        stripeCharge: toNumber(paymentIntentResult?.stripeCharge || paymentDetails.stripeCharge),
        amountBeforeStripe: toNumber(
          paymentIntentResult?.amountBeforeStripe || paymentDetails.amountBeforeStripe
        ),
        totalAmount: toNumber(paymentIntentResult?.amount || paymentDetails.totalAmount),
      };

      setActualPaymentDetails(finalPaymentDetails);

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        paymentIntentResult.clientSecret,
        {
          payment_method: paymentMethod.id,
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message || 'Unable to process payment. Please try again.');
      }

      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error('Payment was not completed.');
      }

      const confirmedPaymentIntentId = finalPaymentDetails.paymentIntentId || paymentIntent.id;
      const bookingRef = doc(firestore, 'bookings', bookingId);

      await updateDoc(bookingRef, {
        paymentStatus: 'paid',
        status: 'upcoming',
        paymentIntentId: confirmedPaymentIntentId,
        stripePaymentIntentId: confirmedPaymentIntentId,
        stripeCardType: finalPaymentDetails.stripeCardType,
        stripeCardCountry: finalPaymentDetails.stripeCardCountry,
        stripeCharge: finalPaymentDetails.stripeCharge,
        amountBeforeStripe: finalPaymentDetails.amountBeforeStripe,
        totalAmount: finalPaymentDetails.totalAmount,
        totalAmountPaid: finalPaymentDetails.totalAmount,
        paidAt: serverTimestamp(),
        paymentConfirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (bookingDataToSave.providerId) {
        try {
          await notifyProviderNewBooking(bookingDataToSave.providerId, {
            bookingId,
            customerId: bookingDataToSave.customerId,
            customerName: bookingDataToSave.customerName || 'A customer',
            serviceName: bookingDataToSave.serviceName || 'a service',
          });
          await updateDoc(bookingRef, {
            providerNotifiedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (notificationError) {
          console.warn(
            'Payment confirmed but provider notification could not be sent:',
            notificationError?.message || notificationError
          );
        }
      }

      notify.success('Payment successful.', { id: paymentToastId });
      navigate(`/customer/payment-success?status=success&booking_id=${bookingId}`);
    } catch (error) {
      console.error('Error processing payment:', error);
      if (bookingCreatedDuringAttempt) {
        try {
          await deleteDoc(doc(firestore, 'bookings', bookingCreatedDuringAttempt));
          setCreatedBookingId(null);
          setCreatedBookingData(null);
        } catch (cleanupError) {
          console.warn(
            'Could not remove unpaid booking after payment failure:',
            cleanupError?.message || cleanupError
          );
        }
      }
      notify.error(getUserFacingError(error, 'Could not complete payment. Please try again.'), {
        id: paymentToastId,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-4 py-8">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-[#5A52E3]">
            <FiShoppingBag size={28} />
          </div>
          <h1 className="mt-5 text-xl font-bold text-slate-950">Cart is empty</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Select a service and booking time before reviewing your payment summary.
          </p>
          <button
            type="button"
            onClick={() => navigate('/customer/services')}
            className="mt-6 rounded-2xl bg-[#5A52E3] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:bg-[#4A43C8]"
          >
            Browse Services
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-[#5A52E3]"
          >
            <FiArrowLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Secure Checkout</p>
            <h1 className="text-lg font-bold text-slate-950 sm:text-xl">Cart Summary</h1>
          </div>
          <div className="h-11 w-11" />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:px-8 lg:py-8">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {bookingData.serviceImage ? (
              <img
                src={bookingData.serviceImage}
                alt={serviceDisplayName}
                className="h-48 w-full object-cover sm:h-64"
              />
            ) : null}
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#5A52E3]">
                    Booked Services
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-950">{serviceDisplayName}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Review your service details, coupon, fees, GST, and card charge before
                    confirming payment securely.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-600">
                  <FiShield size={15} />
                  Stripe protected
                </div>
              </div>

              <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {normalizedServiceItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Qty {item.quantity} x {formatAUD(item.price)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-950">{formatAUD(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailPill icon={FiCalendar} label="Date" value={bookingData.selectedDate} />
            <DetailPill icon={FiClock} label="Time" value={bookingData.selectedTime} />
            <DetailPill icon={FiUser} label="Provider" value={bookingData.providerName} />
            <DetailPill icon={FiMapPin} label="Service Area" value={bookingData.address} />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
                <FiTag size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">Coupon / Promotion Code</h2>
                <p className="text-sm text-slate-500">Discount applies to service price only.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Enter code"
                disabled={couponLoading || checkoutLocked}
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold uppercase text-slate-900 outline-none transition placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:border-[#5A52E3] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={couponLoading || checkoutLocked}
                className="min-h-12 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {couponLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <FiLoader className="animate-spin" />
                    Checking
                  </span>
                ) : (
                  'Apply'
                )}
              </button>
            </div>

            {appliedCoupon ? (
              <button
                type="button"
                onClick={handleRemoveCoupon}
                disabled={checkoutLocked}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheck size={14} />
                {appliedCoupon.code} applied
                <FiX size={14} />
              </button>
            ) : null}

            {couponError ? (
              <p className="mt-3 text-sm font-medium text-red-500">{couponError}</p>
            ) : null}
            {couponMessage ? (
              <p className="mt-3 text-sm font-medium text-emerald-600">{couponMessage}</p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-[#5A52E3]">
                <FiCreditCard size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">Stripe Card Charge</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  The final card-country Stripe charge is calculated securely before the booking is
                  confirmed.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {STRIPE_CARD_OPTIONS.map((option) => {
                const charge =
                  option.key === 'international' ? quote.stripeInternational : quote.stripeDomestic;
                return (
                  <div
                    key={option.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                    <p className="mt-1 text-xs text-slate-400">{option.feeLabel}</p>
                    <p className="mt-3 text-sm font-bold text-slate-950">
                      Est. {formatAUD(charge.total)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <FiCreditCard size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">Payment Method</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Enter card details to pay now. Booking is confirmed only after payment succeeds.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div ref={cardContainerRef} className="min-h-6" />
            </div>

            {!stripeReady ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500">
                <FiLoader className="animate-spin" />
                Loading secure card form...
              </p>
            ) : null}
            {stripeReady && stripeMode ? (
              <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Stripe {stripeMode} mode
              </p>
            ) : null}
            {cardError ? (
              <p className="mt-3 text-sm font-medium text-red-500">{cardError}</p>
            ) : null}

            {actualPaymentDetails ? (
              <div className="mt-5 grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:grid-cols-2">
                <PriceRow
                  label="Detected card"
                  value={
                    actualPaymentDetails.stripeCardType === 'international'
                      ? 'International'
                      : 'Domestic'
                  }
                />
                <PriceRow
                  label="Stripe charge"
                  value={formatAUD(actualPaymentDetails.stripeCharge)}
                />
                <PriceRow
                  label="Before Stripe"
                  value={formatAUD(actualPaymentDetails.amountBeforeStripe)}
                />
                <PriceRow
                  label="Final amount"
                  value={formatAUD(actualPaymentDetails.totalAmount)}
                  strong
                />
              </div>
            ) : null}
          </div>
        </section>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#5A52E3]/10 text-[#5A52E3]">
                <FiShoppingBag size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">Payment Summary</h2>
                <p className="text-sm text-slate-500">GST included for reference.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <PriceRow label="Total services price" value={formatAUD(quote.serviceTotal)} />
              <PriceRow
                label={`Platform fee (${quote.platformFee.label})`}
                value={formatAUD(quote.platformFee.amount)}
              />
              <PriceRow label="Subtotal" value={formatAUD(quote.subtotal)} />
              <PriceRow
                label="Coupon discount"
                value={
                  quote.couponDiscount > 0 ? `-${formatAUD(quote.couponDiscount)}` : formatAUD(0)
                }
                discount={quote.couponDiscount > 0}
              />
              <div className="border-t border-slate-200 pt-4">
                <PriceRow
                  label={`GST included (${formatPercentage(0.1, 0)})`}
                  value={formatAUD(quote.gstAmount)}
                  muted
                />
              </div>
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-200">Total before Stripe</span>
                  <span className="text-2xl font-bold">{formatAUD(quote.totalBeforeStripe)}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Card charge is calculated when you press Pay.
                </p>
              </div>
            </div>

            {quote.totalBeforeStripe < MIN_BOOKING_AMOUNT ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-700">
                Minimum booking amount is {formatAUD(MIN_BOOKING_AMOUNT)}.
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleProceedToPayment}
              disabled={
                isProcessing ||
                !stripeReady ||
                !cardComplete ||
                Boolean(cardError) ||
                quote.totalBeforeStripe < MIN_BOOKING_AMOUNT
              }
              className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-[#5A52E3] to-[#4ECDC4] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <FiLoader className="animate-spin" />
                  Processing Payment
                </>
              ) : (
                <>
                  <FiShield />
                  Pay Now
                </>
              )}
            </button>

            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              <FiHome className="mt-0.5 shrink-0 text-slate-400" />
              <span>
                Booking is created during payment processing and removed automatically if payment
                does not complete.
              </span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default OrderSummary;
