const COUPON_VALIDATION_URL =
  'https://us-central1-mylocalforce-295b8.cloudfunctions.net/validateCouponCode';

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function validateCouponCode({ code, customerId, serviceTotal, subtotal }) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return {
      valid: false,
      error: 'Please enter a coupon code.',
    };
  }

  const parsedServiceTotal = Math.max(0, asNumber(serviceTotal ?? subtotal, 0));
  if (parsedServiceTotal <= 0) {
    return {
      valid: false,
      error: 'Coupon can only be applied when service total is greater than A$0.00.',
    };
  }

  try {
    const response = await fetch(COUPON_VALIDATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: normalizedCode,
        customerId: customerId || null,
        serviceTotal: parsedServiceTotal,
      }),
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (_parseError) {
      payload = {};
    }

    if (!response.ok) {
      return {
        valid: false,
        error: payload?.error || 'Unable to validate coupon right now.',
      };
    }

    return payload;
  } catch (error) {
    return {
      valid: false,
      error: error?.message || 'Unable to validate coupon right now.',
    };
  }
}

export default {
  validateCouponCode,
};
