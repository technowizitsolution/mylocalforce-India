import { createCheckoutSession } from '../services/firebase/stripeService';

export function resolveBookingCheckoutAmount(bookingData) {
  const candidates = [
    bookingData?.amountBeforeStripe,
    bookingData?.amountAfterGST,
    bookingData?.totalAmount,
    bookingData?.subtotal,
    bookingData?.serviceTotal,
    bookingData?.price,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
}

export function buildCheckoutSessionPayload(bookingId, bookingData) {
  const serviceCount =
    Number(bookingData?.serviceCount || 0) ||
    (Array.isArray(bookingData?.serviceItems) ? bookingData.serviceItems.length : 0);
  const serviceName =
    bookingData?.serviceName ||
    (serviceCount > 1 ? `${serviceCount} services` : bookingData?.serviceTitle) ||
    'Service booking';
  const amount = resolveBookingCheckoutAmount(bookingData);

  return {
    bookingId,
    customerId: bookingData?.customerId,
    customerEmail: bookingData?.customerEmail,
    providerId: bookingData?.providerId,
    serviceName,
    price: amount,
    description:
      bookingData?.paymentDescription ||
      (bookingData?.selectedDate && bookingData?.selectedTime
        ? `${serviceName} - ${bookingData.selectedDate} at ${bookingData.selectedTime}`
        : serviceName),
    platformFee: bookingData?.platformFee,
    serviceTotal: bookingData?.serviceTotal ?? bookingData?.price,
    couponCode: bookingData?.couponCode || null,
    couponDiscount: bookingData?.couponDiscount || 0,
    expectedAmount: amount,
  };
}

export async function startCheckoutForBooking(bookingId, bookingData) {
  const checkoutSession = await createCheckoutSession(
    buildCheckoutSessionPayload(bookingId, bookingData)
  );

  if (!checkoutSession?.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  window.location.href = checkoutSession.url;
  return checkoutSession;
}
