// Shared display helpers for the customer "My Leads" pages. Mirrors the status
// wording used by the mobile app's CustomerLeadsScreen / LeadDetailScreen.
import {
  FiAward,
  FiCheckCircle,
  FiDroplet,
  FiEdit2,
  FiFilter,
  FiGrid,
  FiLock,
  FiRadio,
  FiScissors,
  FiSettings,
  FiShield,
  FiTool,
  FiZap,
} from 'react-icons/fi';

export const OFFER_STATUSES = ['offered', 'provider_accepted'];

export const LEAD_STATUS_CONFIG = {
  lead: {
    label: 'Finding Providers',
    badgeText: 'In Review',
    Icon: FiRadio,
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    heroTitle: 'Finding the Best Providers',
    heroDesc:
      'Your request has been broadcast to qualified providers in your area. You will receive a notification as soon as a provider accepts.',
  },
  offer: {
    label: 'Offer Received',
    badgeText: 'Offer Ready',
    Icon: FiAward,
    textClass: 'text-[#5A52E3]',
    bgClass: 'bg-[#6C63FF]/10',
    borderClass: 'border-[#6C63FF]/25',
    heroTitle: 'Provider Offer Ready!',
    heroDesc:
      'A qualified provider has reviewed your lead and accepted your request. Review their quote and confirm your booking below.',
  },
  accepted: {
    label: 'Booked',
    badgeText: 'Confirmed',
    Icon: FiCheckCircle,
    textClass: 'text-emerald-700',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    heroTitle: 'Booking Confirmed!',
    heroDesc:
      'Your service booking is confirmed and paid. Your provider has been scheduled for your requested time.',
  },
};

export const getLeadStatusKey = (lead) => {
  const status = lead?.status || 'lead';
  if (OFFER_STATUSES.includes(status)) return 'offer';
  if (status === 'accepted') return 'accepted';
  return 'lead';
};

export const getLeadStatusInfo = (lead) => LEAD_STATUS_CONFIG[getLeadStatusKey(lead)];

export const getCategoryIcon = (category = '') => {
  const cat = String(category).toLowerCase();
  if (cat.includes('clean')) return FiDroplet;
  if (cat.includes('plumb')) return FiTool;
  if (cat.includes('elect')) return FiZap;
  if (cat.includes('paint')) return FiEdit2;
  if (cat.includes('repair') || cat.includes('appliance')) return FiSettings;
  if (cat.includes('pest')) return FiShield;
  if (cat.includes('beauty') || cat.includes('salon')) return FiScissors;
  if (cat.includes('lock')) return FiLock;
  if (cat.includes('water')) return FiFilter;
  return FiGrid;
};

export const getLeadCategory = (lead) => lead?.leadCategory || lead?.category || 'Service';

export const getLeadServiceName = (lead) =>
  lead?.leadSubcategory || lead?.subcategory || lead?.serviceName || 'Custom Service Request';

export const getTimestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

// Leads store the requested date as YYYY-MM-DD; parse it as a local date.
const parseRequestedDate = (value) => {
  if (typeof value !== 'string') return null;
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatRequestedDate = (value, { long = false } = {}) => {
  if (!value) return 'Flexible Date';
  const d = parseRequestedDate(value);
  if (!d) return String(value);
  return d.toLocaleDateString(
    'en-AU',
    long
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short' }
  );
};

export const formatCreatedAt = (value) => {
  const millis = getTimestampMillis(value);
  if (!millis) return null;
  return new Date(millis).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
