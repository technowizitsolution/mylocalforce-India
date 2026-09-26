import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiInbox,
  FiLock,
  FiMapPin,
  FiRadio,
  FiRefreshCw,
} from 'react-icons/fi';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../../context/AuthContext';
import { firestore } from '../../services/firebase/firebaseConfig';
import {
  saveNotificationToFirestore,
  sendPushNotification,
} from '../../services/firebase/notificationService';
import { formatAUD } from '../../utils/cartPricing';
import { notify } from '../../utils/toast';
import {
  OFFER_STATUSES,
  formatCreatedAt,
  formatRequestedDate,
  getCategoryIcon,
  getLeadCategory,
  getLeadServiceName,
  getLeadStatusInfo,
  getLeadStatusKey,
} from '../../utils/leadDisplay';

const SectionCard = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    {title ? <h3 className="mb-4 text-base font-bold text-slate-950">{title}</h3> : null}
    {children}
  </div>
);

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#6C63FF]/10 text-[#5A52E3]">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 break-words">{value}</p>
    </div>
  </div>
);

const TimelineStep = ({ state, title, desc, icon: Icon }) => {
  const circleClass =
    state === 'done' ? 'bg-emerald-500' : state === 'active' ? 'bg-amber-500' : 'bg-slate-300';
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${circleClass}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
    </div>
  );
};

const LeadDetail = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setNotFound(true);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'leads', leadId),
      (snap) => {
        if (snap.exists()) {
          setLead({ id: snap.id, ...snap.data() });
          setNotFound(false);
        } else {
          setLead(null);
          setNotFound(true);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to lead:', error);
        setNotFound(true);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [leadId]);

  const acceptProvider = async () => {
    if (!lead) return;
    if (!lead.providerId) {
      notify.error('No provider has offered this lead yet.');
      return;
    }
    if (!user?.uid) {
      notify.info('Please sign in to accept this offer.');
      return;
    }

    setProcessing(true);
    try {
      const fresh = await getDoc(doc(firestore, 'leads', lead.id));
      if (!fresh.exists()) throw new Error('Lead not found');
      const data = fresh.data();
      if (!OFFER_STATUSES.includes(data.status)) {
        notify.warning('This offer was already taken or expired.');
        return;
      }
      if (data.customerId && data.customerId !== user.uid) {
        notify.error('This lead does not belong to your account.');
        return;
      }
      if (!data.providerId) {
        notify.error('No provider is currently assigned to this lead.');
        return;
      }

      const basePrice = Number(data.providerPrice ?? data.price ?? 0);
      const serviceName = data.serviceName || data.subcategory || '';
      const providerName = data.providerName || 'Service Provider';
      const selectedProvider = {
        id: data.providerId,
        providerId: data.providerId,
        uid: data.providerId,
        name: providerName,
        ownerName: providerName,
      };
      const bookingServiceData = {
        id: data.serviceId || 'lead-service',
        serviceId: data.serviceId || 'lead-service',
        name: serviceName || 'Service',
        title: serviceName || 'Service',
        serviceName: serviceName || 'Service',
        category: data.category || '',
        subcategory: data.subcategory || serviceName || 'Service',
        price: basePrice,
        ownerId: data.providerId,
        providerId: data.providerId,
        ownerName: providerName,
        duration: data.duration || null,
        description: data.specialInstructions || '',
        providers: [selectedProvider],
      };

      navigate('/customer/booking', {
        state: {
          serviceData: bookingServiceData,
          category: data.category || '',
          providers: [selectedProvider],
          selectedProvider,
          selectedAddress: data.address
            ? { formattedAddress: data.address, address: data.address }
            : null,
          fromProviderSelector: true,
          prefillDate: data.requestedDate || data.selectedDate || null,
          prefillTime: data.requestedTime || data.selectedTime || '',
          prefillPhone: data.customerPhone || '',
          prefillEmail: data.customerEmail || user?.email || '',
          leadId: lead.id,
          leadExpectedProviderId: data.providerId,
        },
      });
    } catch (error) {
      console.error('acceptProvider error', error);
      notify.error('Failed to accept provider offer. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectOffer = async () => {
    if (!lead) return;
    const confirmed = window.confirm(
      'Are you sure you want to decline this offer? Your lead will be reopened for other providers in your area.'
    );
    if (!confirmed) return;

    setProcessing(true);
    try {
      const providerId = lead.providerId;
      await updateDoc(doc(firestore, 'leads', lead.id), {
        status: 'lead',
        providerId: null,
        providerName: null,
        providerPrice: null,
        rejectedByCustomerAt: serverTimestamp(),
      });

      if (providerId) {
        const notification = {
          title: 'Offer Declined',
          body: `${user?.name || user?.displayName || user?.email || 'Customer'} declined the offer for ${
            lead.serviceName || lead.subcategory || 'service'
          }.`,
          data: {
            type: 'LEAD_REJECTED',
            leadId: lead.id,
            role: 'provider',
          },
        };
        try {
          await saveNotificationToFirestore(providerId, notification);
          await sendPushNotification(providerId, notification, { saveToFirestore: false });
        } catch {
          // Notification is best effort; the decline itself already succeeded.
        }
      }

      notify.success('Offer declined. Your request is open again for other providers.');
    } catch (error) {
      console.error('Reject offer error', error);
      notify.error('Failed to decline offer. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Lead documents are readable by id, so only show the owner's own leads here.
  const isOwnLead = lead && (!lead.customerId || lead.customerId === user?.uid);

  if (loading) {
    return (
      <AccountLayout title="Lead Details">
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <FiRefreshCw className="h-8 w-8 animate-spin text-[#5A52E3]" />
          <p className="mt-4 text-sm font-semibold text-slate-600">Loading lead details...</p>
        </div>
      </AccountLayout>
    );
  }

  if (notFound || !isOwnLead) {
    return (
      <AccountLayout title="Lead Details">
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <FiInbox className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-slate-950">Lead not found</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            This lead request could not be found.
          </p>
          <button
            type="button"
            onClick={() => navigate('/customer/leads')}
            className="mt-6 rounded-xl bg-[#6C63FF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#5A52E3]"
          >
            Back to My Leads
          </button>
        </div>
      </AccountLayout>
    );
  }

  const statusKey = getLeadStatusKey(lead);
  const statusInfo = getLeadStatusInfo(lead);
  const StatusIcon = statusInfo.Icon;
  const hasOffer = statusKey === 'offer';
  const isBooked = statusKey === 'accepted';
  const categoryName = getLeadCategory(lead);
  const CategoryIcon = getCategoryIcon(categoryName);
  const createdDateStr = formatCreatedAt(lead.createdAt);

  return (
    <AccountLayout title="Lead Details" subtitle={getLeadServiceName(lead)}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/customer/leads')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <FiArrowLeft className="h-4 w-4" />
            My Leads
          </button>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${statusInfo.bgClass} ${statusInfo.textClass}`}
          >
            {statusInfo.badgeText}
          </span>
        </div>

        <div
          className={`flex items-start gap-4 rounded-2xl border p-5 ${statusInfo.bgClass} ${statusInfo.borderClass}`}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white ${statusInfo.textClass}`}
          >
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <p className={`text-base font-bold ${statusInfo.textClass}`}>{statusInfo.heroTitle}</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{statusInfo.heroDesc}</p>
          </div>
        </div>

        {hasOffer && (
          <div className="rounded-2xl border-2 border-[#6C63FF]/30 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#6C63FF] text-lg font-bold text-white">
                {(lead.providerName || 'P').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-base font-bold text-slate-950">
                  {lead.providerName || 'Verified Provider'}
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <FiCheck className="h-2.5 w-2.5" />
                  </span>
                </p>
                <p className="text-sm text-slate-500">Ready to take your request</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-semibold text-slate-600">Offered Rate:</span>
              <span className="text-lg font-bold text-[#5A52E3]">
                {lead.providerPrice
                  ? formatAUD(lead.providerPrice)
                  : lead.price
                    ? formatAUD(lead.price)
                    : 'Custom Quote'}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={acceptProvider}
                disabled={processing}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#6C63FF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#5A52E3] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing ? 'Please wait...' : 'Accept & Book'}
                {!processing && <FiArrowRight className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleRejectOffer}
                disabled={processing}
                className="rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Decline Offer
              </button>
            </div>
          </div>
        )}

        {isBooked && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <FiCheckCircle className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-base font-bold text-slate-950">Booking Active</p>
                <p className="text-sm text-slate-500">
                  Provider: {lead.providerName || 'Assigned Provider'}
                </p>
              </div>
            </div>
            {lead.orderNumber && (
              <p className="mt-3 text-sm text-slate-600">
                Order ID: <span className="font-semibold text-slate-900">{lead.orderNumber}</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => navigate('/customer/bookings')}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#5A52E3] hover:text-[#6C63FF]"
            >
              View in My Bookings <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6C63FF]/10 text-[#5A52E3]">
              <CategoryIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {categoryName}
              </p>
              <p className="truncate text-base font-bold text-slate-950">
                {getLeadServiceName(lead)}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Category</p>
              <p className="font-semibold text-slate-800">{categoryName}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Base Price</p>
              <p className="font-semibold text-slate-800">
                {lead.price ? formatAUD(lead.price) : 'On Request'}
              </p>
            </div>
            {lead.duration && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Duration</p>
                <p className="font-semibold text-slate-800">{lead.duration}</p>
              </div>
            )}
            {createdDateStr && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Requested On</p>
                <p className="font-semibold text-slate-800">{createdDateStr}</p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Schedule & Location">
          <div className="space-y-4">
            <InfoRow
              icon={FiCalendar}
              label="Preferred Date"
              value={formatRequestedDate(lead.requestedDate || lead.selectedDate, { long: true })}
            />
            <InfoRow
              icon={FiClock}
              label="Preferred Time"
              value={lead.requestedTime || lead.selectedTime || 'Flexible Time'}
            />
            <InfoRow
              icon={FiMapPin}
              label="Service Address"
              value={lead.address || lead.leadArea || 'Address not provided'}
            />
          </div>
        </SectionCard>

        {lead.specialInstructions || lead.serviceDetails ? (
          <SectionCard title="Your Special Instructions">
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
              <FiFileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="text-sm leading-6 text-slate-700">
                {lead.specialInstructions || lead.serviceDetails}
              </p>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title="Contact Details">
          <div className="space-y-2 text-sm">
            <p className="text-slate-600">
              Phone:{' '}
              <span className="font-semibold text-slate-900">
                {lead.customerPhone || 'Not provided'}
              </span>
            </p>
            <p className="text-slate-600">
              Email:{' '}
              <span className="font-semibold text-slate-900">
                {lead.customerEmail || user?.email || 'Not provided'}
              </span>
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            * When a provider accepts, notifications will be sent to your registered contact
            details.
          </p>
        </SectionCard>

        <SectionCard title="Lead Lifecycle">
          <div className="space-y-4">
            <TimelineStep
              state="done"
              icon={FiCheck}
              title="1. Request Broadcasted"
              desc="Your request was sent to local verified providers."
            />
            <TimelineStep
              state={hasOffer || isBooked ? 'done' : 'active'}
              icon={hasOffer || isBooked ? FiCheck : FiRadio}
              title="2. Provider Accepts & Offers"
              desc={
                hasOffer
                  ? `Offer received from ${lead.providerName || 'provider'}.`
                  : isBooked
                    ? 'Offer accepted.'
                    : 'Awaiting provider response in your area.'
              }
            />
            <TimelineStep
              state={isBooked ? 'done' : 'pending'}
              icon={isBooked ? FiCheck : FiLock}
              title="3. Confirmation & Service Delivery"
              desc={
                isBooked
                  ? 'Booking confirmed and scheduled.'
                  : 'Accept the offer to complete your booking.'
              }
            />
          </div>
        </SectionCard>
      </div>
    </AccountLayout>
  );
};

export default LeadDetail;
