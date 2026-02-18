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
      <div className="flex-1 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-6">Service not found</p>
          <button
            onClick={() => navigate('/customer')}
            className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition-colors"
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
    <div className="min-h-screen bg-slate-50 pb-28 sm:pb-32">
      <div className="max-w-5xl mx-auto">
        {/* Service Image Section */}
        <div className="relative h-56 sm:h-72 lg:h-96 bg-indigo-100 overflow-hidden">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt={serviceTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-indigo-100 to-indigo-200">
              <div className="text-6xl text-indigo-600">📦</div>
            </div>
          )}

          <div className="absolute inset-0 bg-linear-to-t from-black/35 via-black/10 to-transparent" />

          {/* Back Button */}
          <button
            onClick={handleBackPress}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 backdrop-blur shadow-lg flex items-center justify-center hover:bg-white transition-colors"
          >
            <FiArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
        </div>

        {/* Content Card */}
        <div className="relative -mt-6 sm:-mt-8 mx-3 sm:mx-6 rounded-2xl sm:rounded-3xl bg-white shadow-lg p-4 sm:p-6 lg:p-8 mb-6 border border-slate-100">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 leading-tight mb-3">{serviceTitle}</h1>
              <div className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs sm:text-sm font-semibold border border-indigo-100">
                {service.category}
              </div>
            </div>
            <div className="lg:text-right">
              <p className="text-xs uppercase tracking-wide text-slate-500">Starting at</p>
              <p className="text-2xl sm:text-3xl font-bold text-indigo-600">{priceDisplay}</p>
            </div>
          </div>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-5 bg-slate-50 p-3 sm:p-4 rounded-xl mb-6 border border-slate-100">
            {service.rating && (
              <div className="flex items-center gap-2">
                <FiStar className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-slate-800">{service.rating}</span>
                {service.reviews && <span className="text-sm text-slate-500">({service.reviews})</span>}
              </div>
            )}
            {service.rating && service.duration && <div className="w-px h-5 bg-gray-200"></div>}
            {service.duration && (
              <div className="flex items-center gap-2">
                <FiClock className="w-5 h-5 text-indigo-600" />
                <span className="text-slate-700">{service.duration}</span>
              </div>
            )}
          </div>

          {/* Price Card */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 sm:p-5 mb-6">
            <p className="text-sm text-slate-600 mb-1">Service Price</p>
            <p className="text-2xl sm:text-3xl font-bold text-indigo-600">{priceDisplay}</p>
          </div>

          <div className="border-t border-gray-200 my-6"></div>

          {/* Provider Information */}
          {service.ownerName && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center">
                <FiUser className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Service Provider</p>
                <p className="font-semibold text-slate-800">{service.ownerName}</p>
              </div>
            </div>
          )}

          {/* Description Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FiFileText className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-800">Description</h2>
            </div>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{service.description}</p>
          </div>

          {/* Features Section */}
          {service.features && Array.isArray(service.features) && service.features.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Features</h3>
              <ul className="space-y-3">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-1">
                      <span className="text-white text-sm font-bold">✓</span>
                    </div>
                    <span className="text-sm sm:text-base text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Footer - Book Now Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="order-2 sm:order-1">
            <p className="text-xs text-slate-600">Total Price</p>
            <p className="text-2xl font-bold text-indigo-600">{priceDisplay}</p>
          </div>
          <button
            onClick={handleBookNowPress}
            className="order-1 sm:order-2 w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-md"
          >
            Book Now
            <FiArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetailsScreen;
