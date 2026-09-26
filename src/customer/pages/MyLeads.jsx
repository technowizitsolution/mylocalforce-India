import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  FiArrowRight,
  FiAward,
  FiCalendar,
  FiCheck,
  FiChevronRight,
  FiFileText,
  FiInbox,
  FiMapPin,
  FiRefreshCw,
  FiSearch,
  FiTag,
} from 'react-icons/fi';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../../context/AuthContext';
import { firestore } from '../../services/firebase/firebaseConfig';
import { formatAUD } from '../../utils/cartPricing';
import {
  getCategoryIcon,
  getLeadCategory,
  getLeadServiceName,
  getLeadStatusInfo,
  getLeadStatusKey,
  getTimestampMillis,
  formatRequestedDate,
} from '../../utils/leadDisplay';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'lead', label: 'In Review' },
  { key: 'offer', label: 'Offers' },
  { key: 'accepted', label: 'Booked' },
];

const EMPTY_TITLES = {
  all: 'No Service Leads Yet',
  lead: 'No Leads In Review',
  offer: 'No Offers Yet',
  accepted: 'No Booked Leads',
};

const MyLeads = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!user?.uid) {
      setLeads([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const leadsQuery = query(collection(firestore, 'leads'), where('customerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      leadsQuery,
      (snapshot) => {
        const items = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
        setLeads(items);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading customer leads:', error);
        setLeads([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const counts = useMemo(() => {
    const result = { all: leads.length, lead: 0, offer: 0, accepted: 0 };
    leads.forEach((lead) => {
      result[getLeadStatusKey(lead)] += 1;
    });
    return result;
  }, [leads]);

  const filteredLeads = useMemo(
    () =>
      activeTab === 'all' ? leads : leads.filter((lead) => getLeadStatusKey(lead) === activeTab),
    [activeTab, leads]
  );

  const renderLeadCard = (lead) => {
    const statusKey = getLeadStatusKey(lead);
    const statusInfo = getLeadStatusInfo(lead);
    const StatusIcon = statusInfo.Icon;
    const hasOffer = statusKey === 'offer';
    const categoryName = getLeadCategory(lead);
    const CategoryIcon = getCategoryIcon(categoryName);
    const timeText = lead.requestedTime || lead.selectedTime || '';

    return (
      <button
        key={lead.id}
        type="button"
        onClick={() => navigate(`/customer/leads/${lead.id}`)}
        className={`w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
          hasOffer ? 'border-[#6C63FF]/40 ring-1 ring-[#6C63FF]/20' : 'border-slate-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6C63FF]/10 text-[#5A52E3]">
            <CategoryIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-400">
              {categoryName}
            </p>
            <h2 className="truncate text-base font-bold text-slate-950">
              {getLeadServiceName(lead)}
            </h2>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusInfo.bgClass} ${statusInfo.textClass}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {statusInfo.badgeText}
          </span>
        </div>

        {hasOffer && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#6C63FF]/20 bg-[#6C63FF]/5 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <FiAward className="h-5 w-5 shrink-0 text-[#5A52E3]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  Offer from {lead.providerName || 'Provider'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {lead.providerPrice
                    ? `Offered Price: ${formatAUD(lead.providerPrice)}`
                    : 'Open to view proposed rate'}
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#6C63FF] px-3 py-1 text-xs font-bold text-white">
              Review <FiChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FiCalendar className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">
              {formatRequestedDate(lead.requestedDate || lead.selectedDate)}
              {timeText ? ` • ${timeText}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FiMapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate">{lead.leadArea || lead.address || 'Address provided'}</span>
          </div>
          {lead.price && !hasOffer ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FiTag className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">Est. Price: {formatAUD(lead.price)}</span>
            </div>
          ) : null}
          {lead.specialInstructions ? (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FiFileText className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">Note: {lead.specialInstructions}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          {statusKey === 'lead' ? (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Broadcasting to providers
            </span>
          ) : statusKey === 'accepted' ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <FiCheck className="h-3.5 w-3.5" />
              {lead.orderNumber ? `Order #${lead.orderNumber}` : 'Booking Active'}
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-400">
              ID: {lead.id.slice(0, 8).toUpperCase()}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#5A52E3]">
            View Details <FiArrowRight className="h-4 w-4" />
          </span>
        </div>
      </button>
    );
  };

  return (
    <AccountLayout title="My Leads" subtitle="Track requests & provider offers">
      <div className="space-y-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ key, label }) => {
            const isActive = activeTab === key;
            const count = counts[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border-[#6C63FF] bg-[#6C63FF] text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-[#6C63FF]/40'
                }`}
              >
                {label}
                {(key === 'all' || count > 0) && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : key === 'offer'
                          ? 'bg-[#6C63FF] text-white'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <FiRefreshCw className="h-8 w-8 animate-spin text-[#5A52E3]" />
            <p className="mt-4 text-sm font-semibold text-slate-600">Loading your leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6C63FF]/10 text-[#5A52E3]">
              <FiInbox className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-950">{EMPTY_TITLES[activeTab]}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              When searching for services, choose "Create a Lead" to request personalized offers
              from local providers in your area.
            </p>
            <button
              type="button"
              onClick={() => navigate('/customer/services')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#6C63FF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#5A52E3]"
            >
              <FiSearch className="h-4 w-4" />
              Explore Services
            </button>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">{filteredLeads.map(renderLeadCard)}</div>
        )}
      </div>
    </AccountLayout>
  );
};

export default MyLeads;
