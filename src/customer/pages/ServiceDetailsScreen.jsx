import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiArrowLeft,
  FiStar,
  FiClock,
  FiFileText,
  FiUser,
  FiArrowRight,
} from 'react-icons/fi';
import { allServices } from '../../data/services';

const normalizeIncludedItems = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const getIncludedItems = (service) => {
  const dashboardItems = normalizeIncludedItems(
    service?.whatsIncluded ||
      service?.whatIncluded ||
      service?.included ||
      service?.includes
  );

  if (dashboardItems.length > 0) {
    return dashboardItems;
  }

  const featureItems = normalizeIncludedItems(service?.features);
  if (featureItems.length > 0) {
    return featureItems;
  }

  return [
    service?.duration ? `${service.duration} estimated duration` : null,
    'Verified local service provider',
    'Secure booking flow',
  ].filter(Boolean);
};

const getServiceImageStyle = (service) => ({
  objectFit: service?.imageFit || 'cover',
  objectPosition: `${service?.imagePositionX ?? 50}% ${service?.imagePositionY ?? 50}%`,
});

const ServiceDetailsScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoggedIn } = useAuth();
  const isSignedIn = isAuthenticated || isLoggedIn;

  const service = location.state?.service;
  const fromHome = location.state?.fromHome;

  const handleBackPress = () => {
    if (fromHome) {
      navigate('/customer');
    } else {
      navigate(-1);
    }
  };

  const handleBookNowPress = () => {
    // Try to find the canonical service entry (which may include `providers`) from
    // the local `allServices` dataset. This mirrors how ServiceList constructs
    // the params and ensures we forward providers when available.
    // Try multiple matching strategies to find a canonical service entry
    let canonical = null;
    try {
      const wantedId = service?.id || service?._id || null;
      const wantedTitle = (service?.title || service?.name || '').toString().trim();
      const wantedCategory = (service?.category || '').toString().trim();
      const wantedDesc = (service?.description || '').toString().trim();

      canonical = allServices?.find(s => {
        if (!s) return false;
        // exact id match
        if (wantedId && s.id != null && String(s.id) === String(wantedId)) return true;
        // direct name/title equality
        const sName = (s.name || s.title || '').toString().trim();
        if (sName && wantedTitle && (sName === wantedTitle)) return true;
        // looser contains matches
        if (sName && wantedTitle && (sName.toLowerCase().includes(wantedTitle.toLowerCase()) || wantedTitle.toLowerCase().includes(sName.toLowerCase()))) return true;
        // match by category + partial description
        const sCategory = (s.category || '').toString().trim();
        const sDesc = (s.description || '').toString().trim();
        if (wantedCategory && sCategory && wantedCategory === sCategory) {
          if (wantedTitle && sName && (sName.toLowerCase().includes(wantedTitle.toLowerCase()) || wantedTitle.toLowerCase().includes(sName.toLowerCase()))) return true;
          if (wantedDesc && sDesc && (sDesc.toLowerCase().includes(wantedDesc.toLowerCase()) || wantedDesc.toLowerCase().includes(sDesc.toLowerCase()))) return true;
        }
        return false;
      });
    } catch (e) {
      canonical = null;
    }

    // Compute providers array (canonical -> service -> ownerId fallback)
    let computedProviders = Array.isArray(canonical?.providers) && canonical.providers.length > 0
      ? canonical.providers
      : Array.isArray(service.providers) && service.providers.length > 0
      ? service.providers
      : service.ownerId
      ? [service.ownerId]
      : canonical?.ownerId
      ? [canonical.ownerId]
      : [];

    // If still empty, try a looser title/name-based fallback to find any canonical
    // service with providers (handles cases where the incoming `service` object
    // is a lightweight live-update entry without ids/providers).
    if ((!computedProviders || computedProviders.length === 0) && service?.title) {
      const wanted = String(service.title || service.name || '').toLowerCase().trim();
      const byTitle = allServices?.find(s => {
        const sTitle = (s?.title || s?.name || '').toLowerCase().trim();
        if (!sTitle) return false;
        // looser matching: includes either way
        const match = sTitle.includes(wanted) || wanted.includes(sTitle);
        return match && Array.isArray(s.providers) && s.providers.length > 0;
      });
      if (byTitle && Array.isArray(byTitle.providers) && byTitle.providers.length > 0) {
        computedProviders = byTitle.providers;
        canonical = byTitle;
        console.log('ServiceDetail: matched by looser title', { matchedTitle: byTitle.title || byTitle.name });
      }
    }

    console.log('ServiceDetail: canonical match', { found: !!canonical, canonicalId: canonical?.id || null });

    console.log('ServiceDetail: computedProviders for navigation', {
      computedProviders,
      canonicalExists: !!canonical,
      serviceProviders: Array.isArray(service.providers) ? service.providers.length : null,
      serviceOwnerId: service.ownerId || null,
    });

    const params = {
      backTo: '/customer/services',
      category: service.category,
      subcategory: service.title,
      serviceData: {
        id: service.id,
        name: service.title,
        description: service.description,
        whatsIncluded: normalizeIncludedItems(
          service.whatsIncluded ||
            service.whatIncluded ||
            service.included ||
            service.includes ||
            service.features
        ),
        imageFit: service.imageFit || 'cover',
        imagePositionX: service.imagePositionX ?? 50,
        imagePositionY: service.imagePositionY ?? 50,
        price: typeof service.price === 'number' ? service.price : parseFloat(String(service.price).replace(/[^0-9.]/g, '')) || 0,
        duration: service.duration,
        category: service.category,
        // Choose provider: prefer explicit ownerId, otherwise pick first assigned provider
        ownerId:
          service.ownerId ||
          (Array.isArray(service.providers) && service.providers.length > 0
            ? service.providers[0]
            : canonical?.ownerId || null),
        // Use computed providers
        providers: computedProviders,
        ownerName: service.ownerName || null,
        ownerEmail: service.ownerEmail || null,
        ownerPhone: service.ownerPhone || null,
        imageUrl: service.imageUrl,
      },
      packageData: {
        name: service.title,
        price: typeof service.price === 'number' ? `$${service.price}` : service.price,
        duration: service.duration,
        services: getIncludedItems(service),
      },
    };

    if (!isSignedIn) {
      navigate('/login', { state: { redirectTo: '/customer/address', params } });
      return;
    }

    navigate('/customer/address', {
      state: {
        nextScreen: 'ProviderSelector',
        serviceData: params.serviceData,
        providers: params.serviceData.providers || [],
        category: params.category,
        packageData: params.packageData,
      },
    });
  };

  if (!service) {
    return (
      <div className="flex-1 bg-linear-to-br from-slate-50 via-white to-indigo-50/30 min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm mx-auto">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-5 sm:mb-6 rounded-full bg-linear-to-br from-indigo-100 to-indigo-200 flex items-center justify-center shadow-lg shadow-indigo-100">
            <span className="text-3xl sm:text-4xl">ðŸ“¦</span>
          </div>
          <p className="text-base sm:text-lg font-semibold text-slate-600 mb-2">Service not found</p>
          <p className="text-xs sm:text-sm text-slate-400 mb-6 sm:mb-8">The service you're looking for may have been removed or is temporarily unavailable.</p>
          <button
            onClick={() => navigate('/customer')}
            className="px-6 sm:px-8 py-2.5 sm:py-3 bg-linear-to-r from-indigo-600 to-indigo-700 text-white rounded-full font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-200 text-sm sm:text-base"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const serviceTitle = service.title || service.name || 'Service';
  const serviceImage = service.imageUrl || service.image || service.thumbnail || null;
  const serviceDescription = service.description || 'Book this service with a trusted local provider.';
  const priceValue =
    typeof service.price === 'number'
      ? service.price
      : parseFloat(String(service.price || '').replace(/[^0-9.]/g, '')) || 0;
  const priceDisplay = priceValue > 0 ? `$${priceValue.toFixed(2)}` : 'Quote on request';
  const featureItems = getIncludedItems(service);

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <button
          onClick={handleBackPress}
          className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
          aria-label="Go back"
        >
          <FiArrowLeft className="h-5 w-5" />
        </button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-start">
          <div className="overflow-hidden rounded-3xl bg-slate-200 shadow-sm">
            {serviceImage ? (
              <img
                src={serviceImage}
                alt={serviceTitle}
                className="h-72 w-full sm:h-96 lg:h-[34rem]"
                style={getServiceImageStyle(service)}
              />
            ) : (
              <div className="flex h-72 w-full items-center justify-center bg-indigo-50 sm:h-96 lg:h-[34rem]">
                <FiFileText className="h-16 w-16 text-indigo-300" />
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:sticky lg:top-24">
            <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              {service.category || 'Service'}
            </span>

            <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
              {serviceTitle}
            </h1>

            {service.ownerName ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <FiUser className="h-4 w-4 text-indigo-600" />
                Provided by <span className="font-semibold text-slate-700">{service.ownerName}</span>
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {service.duration ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                  <FiClock className="h-4 w-4 text-indigo-600" />
                  {service.duration}
                </span>
              ) : null}
              {service.rating ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                  <FiStar className="h-4 w-4 fill-amber-400 text-amber-500" />
                  {service.rating}
                  {service.reviews ? ` (${service.reviews})` : ''}
                </span>
              ) : null}
            </div>

            <div className="mt-8 rounded-2xl bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Starting at</p>
              <p className="mt-1 text-4xl font-black text-indigo-600">{priceDisplay}</p>
            </div>

            <button
              onClick={handleBookNowPress}
              className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 text-base font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.99]"
            >
              Book Now
              <FiArrowRight className="h-5 w-5" />
            </button>
          </aside>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <FiFileText className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black text-slate-950">About Us</h2>
            </div>
            <p className="mt-5 text-base leading-8 text-slate-600">{serviceDescription}</p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-black text-slate-950">What&apos;s Included</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {featureItems.map((feature, idx) => (
                <span
                  key={`${feature}-${idx}`}
                  className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium leading-5 text-slate-700"
                >
                  {feature}
                </span>
              ))}
            </div>
          </section>
      </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Total</p>
            <p className="truncate text-xl font-black text-indigo-600 sm:text-2xl">{priceDisplay}</p>
          </div>
          <button
            onClick={handleBookNowPress}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.99] sm:px-8 sm:text-base"
          >
            Book Now
            <FiArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailsScreen;
