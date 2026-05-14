import React, { useEffect, useMemo, useState } from 'react';
import {
  FiBriefcase,
  FiCheck,
  FiClock,
  FiDollarSign,
  FiFilter,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import {
  fetchProviderBookings,
  fetchServicesByProvider,
} from '../services/firebase/serviceService';
import { fetchUserProfile } from '../services/firebase';
import { firestore } from '../services/firebase/firebaseConfig';
import { notify } from '../utils/toast';

const statusFilters = ['All', 'Active', 'Paused', 'Draft', 'Inactive'];
const sortOptions = [
  { id: 'price_low', label: 'Price: Low to High' },
  { id: 'price_high', label: 'Price: High to Low' },
  { id: 'popularity', label: 'Popularity' },
  { id: 'none', label: 'Default' },
];

const ProviderServicesScreen = () => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [processingIds, setProcessingIds] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [catalogSearchText, setCatalogSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSort, setSelectedSort] = useState('price_low');

  const loadProviderServices = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const [providerServices, providerBookings] = await Promise.all([
        fetchServicesByProvider(user.uid),
        fetchProviderBookings(user.uid).catch(() => []),
      ]);
      setBookings(providerBookings);
      setServices(withBookingStats(providerServices, providerBookings));
    } catch (error) {
      console.error('Error loading provider services:', error);
      notify.error('Failed to load provider services');
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    if (!user?.uid) return;

    try {
      setCatalogLoading(true);
      const servicesCol = collection(firestore, 'services');
      const servicesQuery = query(servicesCol, where('status', '==', 'active'));
      const servicesSnap = await getDocs(servicesQuery);
      const items = servicesSnap.docs
        .map((serviceDoc) => ({ id: serviceDoc.id, ...serviceDoc.data() }))
        .filter(
          (service) => !service.ownerId || service.ownerId === 'admin' || service.isCatalog === true
        )
        .map((service) => {
          const providers = Array.isArray(service.providers) ? service.providers : [];
          return {
            ...service,
            added: service.ownerId === user.uid || providers.includes(user.uid),
          };
        });

      setCatalog(items);
    } catch (error) {
      console.error('Error loading service catalog:', error);
      notify.error(
        error?.code === 'permission-denied'
          ? 'Insufficient permissions to read service catalog.'
          : 'Could not load service catalog'
      );
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    loadProviderServices();
  }, [user?.uid]);

  const openCatalog = async () => {
    setShowCatalog(true);
    await loadCatalog();
  };

  const markProcessing = (id, add = true) => {
    setProcessingIds((current) => (add ? [...current, id] : current.filter((item) => item !== id)));
  };

  const handleAdd = async (service) => {
    if (!user?.uid) {
      notify.warning('Please login to add services');
      return;
    }

    try {
      markProcessing(service.id, true);
      await checkProviderStatus(user.uid);
      await updateDoc(doc(firestore, 'services', service.id), {
        providers: arrayUnion(user.uid),
      });
      notify.success('Service added to your profile');
      setCatalog((current) =>
        current.map((item) => (item.id === service.id ? { ...item, added: true } : item))
      );
      await loadProviderServices();
    } catch (error) {
      console.error('Error adding provider service:', error);
      notify.error(error?.message || 'Could not add service');
    } finally {
      markProcessing(service.id, false);
    }
  };

  const handleRemove = async (service) => {
    if (!user?.uid) {
      notify.warning('Please login to remove services');
      return;
    }

    if (
      !window.confirm(
        `Remove "${service.name || service.title || 'this service'}" from your services?`
      )
    ) {
      return;
    }

    try {
      markProcessing(service.id, true);
      await updateDoc(doc(firestore, 'services', service.id), {
        providers: arrayRemove(user.uid),
      });
      notify.success('Service removed from your profile');
      setServices((current) => current.filter((item) => item.id !== service.id));
      setCatalog((current) =>
        current.map((item) => (item.id === service.id ? { ...item, added: false } : item))
      );
    } catch (error) {
      console.error('Error removing provider service:', error);
      notify.error(error?.message || 'Could not remove service');
    } finally {
      markProcessing(service.id, false);
    }
  };

  const filteredServices = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return [...services]
      .filter((service) => {
        const name = String(service.name || service.title || '').toLowerCase();
        const description = String(service.description || '').toLowerCase();
        const matchesSearch =
          !normalizedSearch ||
          name.includes(normalizedSearch) ||
          description.includes(normalizedSearch);
        const matchesStatus =
          selectedStatus === 'All' ||
          String(service.status || '').toLowerCase() === selectedStatus.toLowerCase();
        return matchesSearch && matchesStatus;
      })
      .sort((left, right) => {
        if (selectedSort === 'price_low') return toNumber(left.price) - toNumber(right.price);
        if (selectedSort === 'price_high') return toNumber(right.price) - toNumber(left.price);
        if (selectedSort === 'popularity') return (right.bookings || 0) - (left.bookings || 0);
        return 0;
      });
  }, [services, searchText, selectedStatus, selectedSort]);

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = catalogSearchText.trim().toLowerCase();
    return catalog.filter((service) => {
      const name = String(service.name || service.title || '').toLowerCase();
      const category = String(service.category || '').toLowerCase();
      return (
        !normalizedSearch || name.includes(normalizedSearch) || category.includes(normalizedSearch)
      );
    });
  }, [catalog, catalogSearchText]);

  const summary = useMemo(
    () => ({
      active: services.filter((service) => String(service.status || '').toLowerCase() === 'active')
        .length,
      bookings: services.reduce((sum, service) => sum + Number(service.bookings || 0), 0),
      earnings: services.reduce((sum, service) => sum + Number(service.earnings || 0), 0),
    }),
    [services]
  );

  if (loading) return <Loading fullScreen />;

  return (
    <ProviderAppLayout>
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <ProviderPageTitle
          title="My Services"
          subtitle={`${filteredServices.length} services assigned to your provider profile.`}
        />
        <button
          type="button"
          onClick={openCatalog}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#5A52E3] px-4 text-sm font-black text-white shadow-sm hover:bg-[#4b44c8]"
        >
          <FiPlus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3">
          <FiSearch className="h-4 w-4 text-slate-400" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search your services..."
            className="h-full flex-1 text-sm font-semibold outline-none"
          />
        </div>
        <select
          value={selectedSort}
          onChange={(event) => setSelectedSort(event.target.value)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 outline-none"
        >
          {sortOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 pb-1">
        {statusFilters.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setSelectedStatus(status)}
            className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm font-black ${
              selectedStatus === status
                ? 'bg-[#5A52E3] text-white'
                : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <SummaryItem value={summary.active} label="Active" />
        <SummaryItem value={summary.bookings} label="Bookings" />
        <SummaryItem value={`$${summary.earnings.toLocaleString('en-AU')}`} label="Earnings" />
      </div>

      <div className="mt-6 grid gap-3">
        {filteredServices.length > 0 ? (
          filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              processing={processingIds.includes(service.id)}
              onRemove={() => handleRemove(service)}
            />
          ))
        ) : (
          <EmptyState
            title="No services found"
            message="Try adjusting your search or add a service from the catalog."
            actionLabel="Add Service"
            onAction={openCatalog}
          />
        )}
      </div>

      {showCatalog ? (
        <CatalogModal
          services={filteredCatalog}
          loading={catalogLoading}
          searchText={catalogSearchText}
          onSearchChange={setCatalogSearchText}
          processingIds={processingIds}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onClose={() => setShowCatalog(false)}
        />
      ) : null}

      <Footer />
    </ProviderAppLayout>
  );
};

const checkProviderStatus = async (providerId) => {
  const profile = await fetchUserProfile(providerId);
  const accountDisabled =
    profile?.providerAccountDisabled === true ||
    profile?.accountDisabled === true ||
    profile?.disabled === true;
  const visaStatus = profile?.visaStatus || profile?.profile?.visaStatus;
  const nationalityStatus = profile?.nationalityStatus || profile?.profile?.nationalityStatus;

  let visaExpiryDate = null;
  if (profile?.visaExpiryTimestamp?.toDate) {
    visaExpiryDate = profile.visaExpiryTimestamp.toDate();
  } else if (profile?.visaExpiryTimestamp) {
    visaExpiryDate = new Date(profile.visaExpiryTimestamp);
  } else if (profile?.profile?.visaExpiry) {
    visaExpiryDate = new Date(profile.profile.visaExpiry);
  }

  let visaExpired = false;
  if (visaExpiryDate && !Number.isNaN(visaExpiryDate.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    visaExpiryDate.setHours(0, 0, 0, 0);
    visaExpired = visaExpiryDate < today;
  }

  const hasVisaIssue = visaStatus === 'blocked' || visaExpired;
  const isNonAustralian = nationalityStatus && nationalityStatus !== 'australian_citizen';

  if (accountDisabled || (hasVisaIssue && isNonAustralian)) {
    console.warn('Provider account or VISA issue detected while adding a service.');
  }
};

const withBookingStats = (services, bookings) =>
  services.map((service) => {
    const serviceBookings = bookings.filter((booking) => booking.serviceId === service.id);
    return {
      ...service,
      bookings: serviceBookings.length,
      completedBookings: serviceBookings.filter((booking) => booking.status === 'completed').length,
      earnings: serviceBookings
        .filter((booking) => booking.status === 'completed')
        .reduce((sum, booking) => sum + (toNumber(booking.price) || toNumber(service.price)), 0),
    };
  });

const toNumber = (value) => Number.parseFloat(value) || 0;

const ProviderPageTitle = ({ title, subtitle }) => (
  <div>
    <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{title}</h1>
    <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
  </div>
);

const SummaryItem = ({ value, label }) => (
  <div className="p-4 text-center">
    <p className="text-xl font-black text-[#5A52E3] sm:text-2xl">{value}</p>
    <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">{label}</p>
  </div>
);

const ServiceCard = ({ service, processing, onRemove }) => (
  <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {service.imageUrl ? (
        <img
          src={service.imageUrl}
          alt={service.name || service.title || 'Service'}
          className="h-20 w-20 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
          <FiBriefcase className="h-7 w-7 text-[#5A52E3]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
              <FiCheck className="h-3 w-3" />
              {(service.status || 'active').toUpperCase()}
            </span>
            <h2 className="mt-2 text-lg font-black text-slate-950">
              {service.name || service.title || 'Service'}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {service.description || service.category || 'No description available'}
            </p>
          </div>
          <p className="text-xl font-black text-[#5A52E3]">${service.price || 0}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <FiClock className="h-4 w-4" />
            {service.duration || service.estimatedDuration || 'TBD'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FiBriefcase className="h-4 w-4" />
            {service.bookings || 0} bookings
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FiDollarSign className="h-4 w-4" />$
            {Number(service.earnings || 0).toLocaleString('en-AU')}
          </span>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            disabled={processing}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-600 disabled:opacity-60"
          >
            <FiTrash2 className="h-4 w-4" />
            {processing ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  </article>
);

const CatalogModal = ({
  services,
  loading,
  searchText,
  onSearchChange,
  processingIds,
  onAdd,
  onRemove,
  onClose,
}) => (
  <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 px-0 sm:items-center sm:justify-center sm:px-4">
    <div className="flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
        <div>
          <h2 className="text-xl font-black text-slate-950">Catalog Services</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Add or remove services from the platform catalog.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>
      <div className="flex min-h-11 items-center gap-2 border-b border-slate-100 px-5 py-3">
        <FiSearch className="h-4 w-4 text-slate-400" />
        <input
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search catalog services..."
          className="h-10 flex-1 text-sm font-semibold outline-none"
        />
        <FiFilter className="h-4 w-4 text-[#5A52E3]" />
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <p className="py-8 text-center font-semibold text-slate-500">Loading catalog...</p>
        ) : services.length ? (
          <div className="grid gap-3">
            {services.map((service) => (
              <CatalogCard
                key={service.id}
                service={service}
                processing={processingIds.includes(service.id)}
                onAdd={() => onAdd(service)}
                onRemove={() => onRemove(service)}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center font-semibold text-slate-500">
            No catalog services available
          </div>
        )}
      </div>
    </div>
  </div>
);

const CatalogCard = ({ service, processing, onAdd, onRemove }) => (
  <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center">
    {service.imageUrl ? (
      <img
        src={service.imageUrl}
        alt={service.name || service.title || 'Service'}
        className="h-16 w-16 rounded-lg object-cover"
      />
    ) : (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100">
        <FiBriefcase className="h-6 w-6 text-slate-400" />
      </div>
    )}
    <div className="min-w-0 flex-1">
      <p className="font-black text-slate-950">{service.name || service.title || 'Service'}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">
        {service.category || 'General'} - {service.duration || service.estimatedDuration || 'TBD'}
      </p>
      <p className="mt-1 font-black text-[#5A52E3]">${service.price || 0}</p>
    </div>
    {service.added ? (
      <button
        type="button"
        onClick={onRemove}
        disabled={processing}
        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-600 disabled:opacity-60"
      >
        {processing ? 'Removing...' : 'Remove'}
      </button>
    ) : (
      <button
        type="button"
        onClick={onAdd}
        disabled={processing}
        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-indigo-200 bg-white px-4 text-sm font-black text-[#5A52E3] disabled:opacity-60"
      >
        {processing ? 'Adding...' : 'Add'}
      </button>
    )}
  </div>
);

const EmptyState = ({ title, message, actionLabel, onAction }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
    <p className="font-bold text-slate-800">{title}</p>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
    {actionLabel ? (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-lg bg-[#5A52E3] px-4 py-2 text-sm font-black text-white"
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
);

export default ProviderServicesScreen;
