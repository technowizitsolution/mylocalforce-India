import { PaymentConfig } from '../config/paymentConfig';

const DEFAULT_FIXED_PLATFORM_FEE = 5;

export const STRIPE_CARD_OPTIONS = [
  {
    key: 'domestic',
    label: 'Domestic Card',
    feeLabel: '1.7% + A$0.30',
  },
  {
    key: 'international',
    label: 'International Card',
    feeLabel: '3.5% + A$0.30',
  },
];

export function formatAUD(value) {
  return `A$${Number(value || 0).toFixed(2)}`;
}

export function formatPercentage(value, digits = 2) {
  return `${(Number(value || 0) * 100).toFixed(digits)}%`;
}

export function normalizeServiceItems(bookingData, incomingServiceItems) {
  const routeItems = Array.isArray(incomingServiceItems) ? incomingServiceItems : [];
  const bookingItems = Array.isArray(bookingData?.serviceItems) ? bookingData.serviceItems : [];

  const source = routeItems.length > 0 ? routeItems : bookingItems;
  if (source.length > 0) {
    return source
      .map((item, index) => {
        const quantity = Number(item?.quantity ?? 1) || 1;
        const itemPrice = Number(item?.price ?? item?.amount ?? 0);
        const safePrice = Number.isFinite(itemPrice) && itemPrice >= 0 ? itemPrice : 0;
        const itemTotal = Number(item?.total);
        const total = Number.isFinite(itemTotal) ? itemTotal : safePrice * quantity;

        return {
          id: item?.id || `service-${index + 1}`,
          name: item?.name || item?.serviceName || `Service ${index + 1}`,
          quantity,
          price: safePrice,
          total: total >= 0 ? total : safePrice * quantity,
        };
      })
      .filter((item) => item.total >= 0);
  }

  const fallbackPrice = Number(bookingData?.price || 0);
  return [
    {
      id: bookingData?.serviceId || 'service-1',
      name: bookingData?.serviceName || 'Service',
      quantity: 1,
      price: Number.isFinite(fallbackPrice) ? fallbackPrice : 0,
      total: Number.isFinite(fallbackPrice) ? fallbackPrice : 0,
    },
  ];
}

export function resolvePlatformFee(platformSettings) {
  const fixedFeeCandidates = [
    platformSettings?.platformFee,
    PaymentConfig?.PLATFORM_FEE_FIXED,
    DEFAULT_FIXED_PLATFORM_FEE,
  ];

  for (const candidate of fixedFeeCandidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return {
        amount: parsed,
        label: 'Fixed',
      };
    }
  }

  return {
    amount: DEFAULT_FIXED_PLATFORM_FEE,
    label: 'Fixed',
  };
}

export function calculateCartQuote({
  serviceItems,
  platformSettings,
  couponDiscount,
  selectedCardType = 'domestic',
}) {
  const normalizedItems = Array.isArray(serviceItems) ? serviceItems : [];
  const serviceTotal = normalizedItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const platformFee = resolvePlatformFee(platformSettings);
  const subtotal = serviceTotal + platformFee.amount;

  const normalizedCouponDiscount = Math.max(0, Math.min(Number(couponDiscount || 0), serviceTotal));
  const taxableAmount = Math.max(0, subtotal - normalizedCouponDiscount);

  const gstRate = Number(PaymentConfig?.TAX?.GST_RATE ?? 0.1);
  const gstAmount = taxableAmount > 0 ? taxableAmount * (gstRate / (1 + gstRate)) : 0;
  const amountAfterGST = taxableAmount;
  const platformFeeEquivalentRate = serviceTotal > 0 ? platformFee.amount / serviceTotal : 0;
  const totalBeforeStripe = amountAfterGST;

  const domesticPercentageRate = Number(
    PaymentConfig?.GATEWAY?.STRIPE_DOMESTIC_PERCENTAGE_FEE ?? 0.017
  );
  const internationalPercentageRate = Number(
    PaymentConfig?.GATEWAY?.STRIPE_INTERNATIONAL_PERCENTAGE_FEE ?? 0.035
  );
  const fixedStripeFee = Number(PaymentConfig?.GATEWAY?.FIXED_FEE ?? 0.3);

  const stripeDomesticVariable = taxableAmount * domesticPercentageRate;
  const stripeInternationalVariable = taxableAmount * internationalPercentageRate;

  const stripeDomestic = {
    percentageRate: domesticPercentageRate,
    variable: taxableAmount > 0 ? stripeDomesticVariable : 0,
    fixed: taxableAmount > 0 ? fixedStripeFee : 0,
    total: taxableAmount > 0 ? stripeDomesticVariable + fixedStripeFee : 0,
  };

  const stripeInternational = {
    percentageRate: internationalPercentageRate,
    variable: taxableAmount > 0 ? stripeInternationalVariable : 0,
    fixed: taxableAmount > 0 ? fixedStripeFee : 0,
    total: taxableAmount > 0 ? stripeInternationalVariable + fixedStripeFee : 0,
  };

  const normalizedSelectedCardType =
    selectedCardType === 'international' ? 'international' : 'domestic';
  const selectedStripeCharge =
    normalizedSelectedCardType === 'international' ? stripeInternational : stripeDomestic;

  return {
    serviceTotal,
    platformFee,
    platformFeeEquivalentRate,
    subtotal,
    couponDiscount: normalizedCouponDiscount,
    taxableAmount,
    gstAmount,
    amountAfterGST,
    totalBeforeStripe,
    stripeDomestic,
    stripeInternational,
    selectedCardType: normalizedSelectedCardType,
    selectedStripeCharge,
    estimatedPayableDomestic: totalBeforeStripe + stripeDomestic.total,
    estimatedPayableInternational: totalBeforeStripe + stripeInternational.total,
    totalAmountToPay: totalBeforeStripe + selectedStripeCharge.total,
  };
}
