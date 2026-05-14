import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  FiCheckCircle,
  FiClock,
  FiGift,
  FiInbox,
  FiMapPin,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../../context/AuthContext';
import { firestore } from '../../services/firebase/firebaseConfig';

const getTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDate = (value) => {
  const timestamp = getTimestamp(value);
  if (!timestamp) return 'Recently accepted';

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
};

const getAcceptedOffer = (lead) => {
  if (!Array.isArray(lead.offers)) return null;

  return (
    lead.offers.find((offer) => {
      const providerId = String(offer?.providerId || '');
      return providerId && providerId === String(lead.acceptedProviderId || lead.providerId || '');
    }) || null
  );
};

const AcceptedOffers = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLeads([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const leadsRef = collection(firestore, 'leads');
    const leadsQuery = query(leadsRef, where('customerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      leadsQuery,
      (snapshot) => {
        const acceptedLeads = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter((lead) => {
            const status = String(lead.status || '').toLowerCase();
            return (
              status === 'accepted' ||
              Boolean(lead.acceptedProviderId) ||
              Boolean(lead.acceptedByCustomerId)
            );
          })
          .sort(
            (a, b) =>
              getTimestamp(b.acceptedAt || b.updatedAt || b.createdAt) -
              getTimestamp(a.acceptedAt || a.updatedAt || a.createdAt)
          );

        setLeads(acceptedLeads);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading accepted offers:', error);
        setLeads([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const acceptedCount = leads.length;
  const summary = useMemo(
    () => (acceptedCount === 1 ? '1 accepted offer' : `${acceptedCount} accepted offers`),
    [acceptedCount]
  );

  return (
    <AccountLayout title="Accepted Offers" subtitle="Review provider offers you have accepted.">
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
              <FiCheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">{summary}</p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Accepted offers are finalized leads where you selected a provider and continued with
                the booking.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <FiRefreshCw className="h-8 w-8 animate-spin text-[#5A52E3]" />
            <p className="mt-4 text-sm font-semibold text-slate-600">Loading accepted offers...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <FiInbox className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-950">No accepted offers yet</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              When you accept a provider offer, it will appear here for quick reference.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {leads.map((lead) => {
              const offer = getAcceptedOffer(lead);
              const providerName =
                offer?.providerName ||
                lead.providerName ||
                lead.acceptedProviderName ||
                'Selected provider';
              const serviceName =
                lead.serviceName || lead.leadSubcategory || lead.subcategory || 'Service request';

              return (
                <article
                  key={lead.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#6C63FF]/25 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        <FiGift className="h-4 w-4" />
                        Accepted
                      </div>
                      <h2 className="truncate text-lg font-bold text-slate-950">{serviceName}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {lead.leadCategory || lead.category || 'My Local Force'}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-xl bg-[#6C63FF]/10 px-3 py-2 text-sm font-bold text-[#5A52E3]">
                      {lead.price || offer?.price || 'Quoted'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                      <FiUser className="mt-0.5 h-5 w-5 shrink-0 text-[#5A52E3]" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Provider</p>
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {providerName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                      <FiClock className="mt-0.5 h-5 w-5 shrink-0 text-[#5A52E3]" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Accepted</p>
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {formatDate(lead.acceptedAt || lead.updatedAt || lead.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {lead.address ? (
                    <div className="mt-3 flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                      <FiMapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#5A52E3]" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-slate-400">Address</p>
                        <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                          {lead.address}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
};

export default AcceptedOffers;
