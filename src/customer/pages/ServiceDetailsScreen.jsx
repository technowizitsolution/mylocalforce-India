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

const ServiceDetailsScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuth();

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
      category: service.category,
      subcategory: service.title,
      serviceData: {
        id: service.id,
        name: service.title,
        description: service.description,
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
        services: service.features || [service.description],
      },
    };

    if (!isLoggedIn) {
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
  const priceDisplay = typeof service.price === 'number' ? `$${service.price.toFixed(2)}` : service.price;

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 to-white pb-28 sm:pb-32">
      <div className="max-w-5xl mx-auto">
        {/* Service Image Section */}
        <div className="relative h-52 sm:h-72 md:h-80 lg:h-105 bg-indigo-100 overflow-hidden">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt={serviceTitle}
              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-indigo-100 via-indigo-50 to-purple-100">
              <div className="text-5xl sm:text-6xl lg:text-7xl">ðŸ“¦</div>
            </div>
          )}

          {/* Gradient overlays for depth */}
          <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/10 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-r from-black/10 to-transparent" />

          {/* Back Button */}
          <button
            onClick={handleBackPress}
            className="absolute top-3 left-3 sm:top-5 sm:left-5 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/90 backdrop-blur-md shadow-lg shadow-black/10 flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <FiArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-800" />
          </button>

          {/* Floating category badge on hero */}
          <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-10">
            <span className="inline-flex items-center px-3 py-1 sm:px-4 sm:py-1.5 bg-white/90 backdrop-blur-md rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-700 shadow-lg shadow-black/10">
              {service.category}
            </span>
          </div>
        </div>

        {/* Content Card */}
        <div className="relative -mt-5 sm:-mt-8 mx-2.5 sm:mx-5 lg:mx-6 rounded-2xl sm:rounded-3xl bg-white shadow-xl shadow-slate-200/60 p-4 sm:p-6 lg:p-8 xl:p-10 mb-4 sm:mb-6 border border-slate-100/80">

          {/* Title & Price Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6 mb-5 sm:mb-7">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
                {serviceTitle}
              </h1>
              {service.ownerName && (
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-500 flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-indigo-100">
                    <FiUser className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-600" />
                  </span>
                  by <span className="font-medium text-slate-700">{service.ownerName}</span>
                </p>
              )}
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-slate-400 mb-0.5">Starting at</p>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                {priceDisplay}
              </p>
            </div>
          </div>

          {/* Meta Pills */}
          {(service.rating || service.duration) && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 sm:mb-7">
              {service.rating && (
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-50 rounded-full border border-amber-100">
                  <FiStar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 fill-amber-400" />
                  <span className="text-xs sm:text-sm font-bold text-amber-700">{service.rating}</span>
                  {service.reviews && <span className="text-[10px] sm:text-xs text-amber-500/80">({service.reviews})</span>}
                </div>
              )}
              {service.duration && (
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-50 rounded-full border border-slate-200">
                  <FiClock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-700">{service.duration}</span>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-linear-to-r from-transparent via-slate-200 to-transparent mb-5 sm:mb-7" />

          {/* Description Section */}
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 sm:gap-2.5 mb-3 sm:mb-4">
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50">
                <FiFileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
              </div>
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-slate-800">About this service</h2>
            </div>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed sm:leading-7">
              {service.description}
            </p>
          </div>

          {/* Features Section */}
          {service.features && Array.isArray(service.features) && service.features.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-3 sm:mb-4">What's included</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {service.features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 sm:gap-3 bg-slate-50/80 rounded-xl p-3 sm:p-3.5 border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/40 transition-colors duration-200"
                  >
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-indigo-200">
                      <span className="text-white text-[10px] sm:text-xs font-bold">âœ“</span>
                    </div>
                    <span className="text-xs sm:text-sm text-slate-700 leading-snug">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price Summary Card */}
          <div className="bg-linear-to-br from-indigo-50 via-indigo-50/80 to-violet-50/60 border border-indigo-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm font-medium text-indigo-600/80 mb-0.5">Service Price</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-extrabold bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  {priceDisplay}
                </p>
                {service.duration && (
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Duration: {service.duration}</p>
                )}
              </div>
              <button
                onClick={handleBookNowPress}
                className="hidden sm:inline-flex items-center gap-2 px-6 lg:px-8 py-2.5 lg:py-3 bg-linear-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all duration-200 font-semibold shadow-lg shadow-indigo-200/50 text-sm lg:text-base hover:shadow-xl hover:shadow-indigo-200/60"
              >
                Book Now
                <FiArrowRight className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer - Book Now Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-30">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 lg:px-6 py-2.5 sm:py-3.5 lg:py-4 flex items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Total</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-extrabold bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent truncate">
              {priceDisplay}
            </p>
          </div>
          <button
            onClick={handleBookNowPress}
            className="shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-5 sm:px-7 lg:px-8 py-2.5 sm:py-3 bg-linear-to-r from-indigo-600 to-violet-600 text-white rounded-xl sm:rounded-2xl hover:from-indigo-700 hover:to-violet-700 active:scale-[0.98] transition-all duration-200 font-bold shadow-lg shadow-indigo-300/40 text-xs sm:text-sm lg:text-base"
          >
            Book Now
            <FiArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailsScreen;
