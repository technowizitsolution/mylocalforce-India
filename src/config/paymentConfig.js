/**
 * Payment & Settlement Configuration
 * Central configuration for all payment-related fees, taxes, and calculations
 */

export const PaymentConfig = {
  // Platform fees (as decimal, e.g., 0.10 = 10%)
  PLATFORM_FEE_RATE: 0.10, // 10% platform fee
  
  // Payment gateway charges (Stripe rates for Australia)
  GATEWAY: {
    // Stripe fees: 1.75% + $0.30 AUD for domestic cards
    PERCENTAGE_FEE: 0.0175, // 1.75%
    FIXED_FEE: 0.30, // $0.30 AUD
  },
  
  // Tax rates (GST - Goods and Services Tax in Australia)
  TAX: {
    GST_RATE: 0.10, // 10% GST
    INCLUDE_IN_PLATFORM_FEE: true, // GST is included in platform fee
    INCLUDE_IN_GATEWAY_FEE: false, // Stripe fees don't include GST separately
  },
  
  // Currency
  CURRENCY: 'AUD',
  CURRENCY_SYMBOL: '$',
};

/**
 * Calculate complete payment breakdown
 * @param {number} grossAmount - Total amount charged to customer
 * @returns {object} Complete payment breakdown
 */
export const calculatePaymentBreakdown = (grossAmount) => {
  const amount = parseFloat(grossAmount) || 0;
  
  // 1. Calculate Stripe/Gateway fees
  const gatewayFeePercentage = amount * PaymentConfig.GATEWAY.PERCENTAGE_FEE;
  const gatewayFeeFixed = PaymentConfig.GATEWAY.FIXED_FEE;
  const totalGatewayFee = gatewayFeePercentage + gatewayFeeFixed;
  
  // 2. Amount after gateway fees
  const amountAfterGateway = amount - totalGatewayFee;
  
  // 3. Calculate platform commission (on amount after gateway fees)
  const platformFeeGross = amountAfterGateway * PaymentConfig.PLATFORM_FEE_RATE;
  
  // 4. Calculate tax on platform fee (if applicable)
  let platformFeeTax = 0;
  let platformFeeNet = platformFeeGross;
  
  if (PaymentConfig.TAX.INCLUDE_IN_PLATFORM_FEE) {
    // GST is included in the platform fee
    // To extract GST: GST = Fee × (GST_RATE / (1 + GST_RATE))
    platformFeeTax = platformFeeGross * (PaymentConfig.TAX.GST_RATE / (1 + PaymentConfig.TAX.GST_RATE));
    platformFeeNet = platformFeeGross - platformFeeTax;
  }
  
  // 5. Calculate provider payout
  const providerPayout = amountAfterGateway - platformFeeGross;
  
  return {
    // Input
    grossAmount: amount,
    currency: PaymentConfig.CURRENCY,
    
    // Gateway fees breakdown
    gatewayFees: {
      percentageFee: gatewayFeePercentage,
      fixedFee: gatewayFeeFixed,
      total: totalGatewayFee,
      rate: `${(PaymentConfig.GATEWAY.PERCENTAGE_FEE * 100).toFixed(2)}% + ${PaymentConfig.CURRENCY_SYMBOL}${PaymentConfig.GATEWAY.FIXED_FEE}`,
    },
    
    // Amount after gateway
    amountAfterGateway,
    
    // Platform fees breakdown
    platformFees: {
      gross: platformFeeGross,
      tax: platformFeeTax,
      net: platformFeeNet,
      rate: `${(PaymentConfig.PLATFORM_FEE_RATE * 100).toFixed(0)}%`,
      includesTax: PaymentConfig.TAX.INCLUDE_IN_PLATFORM_FEE,
    },
    
    // Taxes breakdown
    taxes: {
      gstOnPlatformFee: platformFeeTax,
      total: platformFeeTax,
      rate: PaymentConfig.TAX.GST_RATE,
    },
    
    // Final provider payout
    providerPayout: {
      amount: providerPayout,
      percentage: amount > 0 ? (providerPayout / amount * 100) : 0,
    },
    
    // Summary
    summary: {
      customerPaid: amount,
      gatewayFeesDeducted: totalGatewayFee,
      platformFeesDeducted: platformFeeGross,
      taxesDeducted: platformFeeTax,
      providerReceives: providerPayout,
    },
  };
};

/**
 * Format currency amount
 * @param {number} amount 
 * @returns {string}
 */
export const formatCurrency = (amount) => {
  return `${PaymentConfig.CURRENCY_SYMBOL}${parseFloat(amount || 0).toFixed(2)}`;
};

/**
 * Calculate settlement for a booking
 * This is used when processing payouts to providers
 * @param {number} grossAmount - Original booking amount
 * @param {object} options - Additional options (commission rate override, etc.)
 * @returns {object} Settlement details
 */
export const calculateSettlement = (grossAmount, options = {}) => {
  const breakdown = calculatePaymentBreakdown(grossAmount);
  
  // Custom commission rate (if provider has different rate)
  const customCommissionRate = options.commissionRate;
  if (customCommissionRate !== undefined && customCommissionRate !== null) {
    const customRate = parseFloat(customCommissionRate) / 100; // Convert percentage to decimal
    const amountAfterGateway = breakdown.amountAfterGateway;
    
    const customPlatformFee = amountAfterGateway * customRate;
    const customProviderPayout = amountAfterGateway - customPlatformFee;
    
    // Recalculate tax on custom platform fee
    let customPlatformFeeTax = 0;
    if (PaymentConfig.TAX.INCLUDE_IN_PLATFORM_FEE) {
      customPlatformFeeTax = customPlatformFee * (PaymentConfig.TAX.GST_RATE / (1 + PaymentConfig.TAX.GST_RATE));
    }
    
    return {
      ...breakdown,
      platformFees: {
        ...breakdown.platformFees,
        gross: customPlatformFee,
        tax: customPlatformFeeTax,
        net: customPlatformFee - customPlatformFeeTax,
        rate: `${customCommissionRate}%`,
        isCustomRate: true,
      },
      providerPayout: {
        amount: customProviderPayout,
        percentage: grossAmount > 0 ? (customProviderPayout / grossAmount * 100) : 0,
      },
      taxes: {
        gstOnPlatformFee: customPlatformFeeTax,
        total: customPlatformFeeTax,
        rate: PaymentConfig.TAX.GST_RATE,
      },
      summary: {
        customerPaid: grossAmount,
        gatewayFeesDeducted: breakdown.gatewayFees.total,
        platformFeesDeducted: customPlatformFee,
        taxesDeducted: customPlatformFeeTax,
        providerReceives: customProviderPayout,
      },
    };
  }
  
  return breakdown;
};

/**
 * Get settlement status based on booking status
 * @param {string} bookingStatus 
 * @returns {string}
 */
export const getSettlementStatus = (bookingStatus) => {
  const statusMap = {
    'completed': 'settled',
    'upcoming': 'pending',
    'accepted': 'pending',
    'paid': 'pending',
    'cancelled': 'cancelled',
    'declined': 'cancelled',
  };
  
  return statusMap[bookingStatus] || 'pending';
};

/**
 * Example settlement calculation
 * 
 * Customer pays: $100.00
 * 
 * Breakdown:
 * 1. Gateway Fee (Stripe): $100 × 1.75% + $0.30 = $2.05
 * 2. Amount after gateway: $100 - $2.05 = $97.95
 * 3. Platform Fee (10%): $97.95 × 10% = $9.80
 * 4. GST on Platform Fee: $9.80 × 10/110 = $0.89
 * 5. Provider Payout: $97.95 - $9.80 = $88.15
 * 
 * Final breakdown:
 * - Customer paid: $100.00
 * - Gateway fees: $2.05
 * - Platform fees: $9.80 (includes $0.89 GST)
 * - Provider receives: $88.15
 */

export default {
  PaymentConfig,
  calculatePaymentBreakdown,
  calculateSettlement,
  formatCurrency,
  getSettlementStatus,
};
