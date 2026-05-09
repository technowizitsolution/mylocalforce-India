import { doc, getDoc } from 'firebase/firestore';
import { firestore } from './firebaseConfig';

const DEFAULT_POLICIES = {
  privacyPolicy: {
    title: 'Privacy Policy',
    description: 'How My Local Force collects, uses, stores, and protects your information.',
    sections: [
      {
        id: 'privacy-introduction',
        heading: 'Introduction',
        content:
          'My Local Force respects your privacy and is committed to protecting the personal information you share with us when using our website, mobile app, booking services, provider tools, and support channels.',
      },
      {
        id: 'privacy-information',
        heading: 'Information We Collect',
        content:
          'We may collect account details, contact information, service addresses, booking information, payment and payout references, identity or verification details for providers, messages, support requests, device information, and usage data needed to operate and improve the platform.',
      },
      {
        id: 'privacy-use',
        heading: 'How We Use Information',
        content:
          'We use information to create and manage accounts, connect customers with service providers, process bookings and payments, send service updates, prevent fraud, improve safety, provide customer support, comply with legal obligations, and improve My Local Force.',
      },
      {
        id: 'privacy-sharing',
        heading: 'Sharing Information',
        content:
          'We share information only when needed to provide the service, such as sharing booking details between customers and providers, working with payment processors, identity verification partners, hosting providers, analytics services, legal advisers, regulators, or authorities where required by law.',
      },
      {
        id: 'privacy-security',
        heading: 'Security and Retention',
        content:
          'We use reasonable technical and organisational safeguards to protect personal information. We keep information only for as long as needed for platform operations, legal compliance, dispute resolution, accounting, safety, and fraud prevention.',
      },
      {
        id: 'privacy-rights',
        heading: 'Your Choices',
        content:
          'You may request access, correction, or deletion of your information where available under applicable law. Some information may need to be retained for legitimate business, safety, tax, accounting, or legal reasons.',
      },
    ],
    lastUpdated: null,
  },
  termsCustomer: {
    title: 'Customer Terms and Conditions',
    description: 'Terms that apply when customers use My Local Force.',
    sections: [
      {
        id: 'customer-introduction',
        heading: 'Using My Local Force',
        content:
          'These customer terms apply when you use My Local Force to browse services, request quotes, book providers, communicate about jobs, make payments, or receive support through the platform.',
      },
      {
        id: 'customer-account',
        heading: 'Customer Account Responsibilities',
        content:
          'You are responsible for providing accurate account, contact, address, and booking information. You must keep your login details secure and notify us if you believe your account has been used without permission.',
      },
      {
        id: 'customer-bookings',
        heading: 'Bookings and Service Requests',
        content:
          'When you create a booking or service request, you agree to provide clear job details, safe access to the service location, and reasonable cooperation with the selected provider. Booking availability, timing, pricing, and completion may depend on provider acceptance and job conditions.',
      },
      {
        id: 'customer-payments',
        heading: 'Payments, Cancellations, and Refunds',
        content:
          'You agree to pay all confirmed charges, fees, taxes, cancellation charges, and other amounts shown or agreed through the platform. Refunds, adjustments, and cancellations are reviewed according to the booking status, provider work completed, payment processor rules, and applicable law.',
      },
      {
        id: 'customer-conduct',
        heading: 'Customer Conduct',
        content:
          'You must not misuse the platform, submit false information, harass providers, request unsafe or unlawful work, bypass platform payments where prohibited, interfere with platform operations, or use My Local Force for fraudulent activity.',
      },
      {
        id: 'customer-limits',
        heading: 'Service Provider Relationship',
        content:
          'Providers are independent service professionals and are responsible for performing the services they accept. My Local Force provides the platform used to connect customers and providers, manage bookings, and support platform workflows.',
      },
    ],
    lastUpdated: null,
  },
  termsProvider: {
    title: 'Provider Terms and Conditions',
    description: 'Terms that apply when service providers use My Local Force.',
    sections: [
      {
        id: 'provider-introduction',
        heading: 'Providing Services Through My Local Force',
        content:
          'These provider terms apply when you register, verify your profile, receive leads, accept bookings, communicate with customers, complete jobs, and receive payouts through My Local Force.',
      },
      {
        id: 'provider-eligibility',
        heading: 'Eligibility and Verification',
        content:
          'You must provide accurate business, identity, qualification, insurance, service area, banking, and tax information where requested. My Local Force may review, approve, reject, suspend, or remove provider access to protect customers and platform integrity.',
      },
      {
        id: 'provider-service',
        heading: 'Service Standards',
        content:
          'You are responsible for delivering accepted services professionally, safely, lawfully, and within the agreed scope, timing, and price. You must communicate clearly, attend bookings on time, and update booking status accurately.',
      },
      {
        id: 'provider-payments',
        heading: 'Fees, Payouts, and Commission',
        content:
          'Platform fees, commissions, lead charges, payout timing, refunds, deductions, and adjustments may apply as shown in the dashboard, booking flow, or provider agreement. Payouts may be delayed or withheld where verification, disputes, refunds, fraud checks, or legal requirements apply.',
      },
      {
        id: 'provider-conduct',
        heading: 'Provider Conduct',
        content:
          'You must not misuse customer information, bypass platform processes, request off-platform payments where prohibited, submit false documents, perform unsafe or unlawful work, harass customers, manipulate reviews, or interfere with platform operations.',
      },
      {
        id: 'provider-independent',
        heading: 'Independent Provider Status',
        content:
          'Providers operate as independent businesses or professionals. Nothing in these terms creates an employment, partnership, agency, or joint venture relationship between a provider and My Local Force unless a separate written agreement states otherwise.',
      },
    ],
    lastUpdated: null,
  },
};

const normalizeLegacyContent = (data, fallback) => {
  if (!data) return fallback;

  if (Array.isArray(data.sections)) {
    return {
      ...fallback,
      ...data,
      sections: data.sections,
    };
  }

  if (typeof data.content === 'string' && data.content.trim()) {
    return {
      ...fallback,
      ...data,
      sections: [
        {
          id: 'legacy-content',
          heading: data.title || fallback.title,
          content: data.content,
        },
      ],
    };
  }

  return {
    ...fallback,
    ...data,
    sections: fallback.sections,
  };
};

export const getPolicy = async (policyId) => {
  const fallback = DEFAULT_POLICIES[policyId] || {
    title: 'Policy',
    description: '',
    sections: [],
    lastUpdated: null,
  };

  const snapshot = await getDoc(doc(firestore, 'settings', policyId));
  return snapshot.exists()
    ? normalizeLegacyContent(snapshot.data(), fallback)
    : fallback;
};

export const getDefaultPolicy = (policyId) => DEFAULT_POLICIES[policyId];
