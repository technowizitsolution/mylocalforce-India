import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiMapPin, FiBell } from 'react-icons/fi';

const Bookings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    serviceData,
    selectedProvider,
    selectedAddress,
    category,
    packageData,
    fromProviderSelector,
    isLead,
  } = location.state || {};

  /* ---------- Lead-capture view ---------- */
  if (isLead) {
    return (
      <div className="h-screen bg-slate-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-white">
          <button
            onClick={() => navigate(-1)}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            <FiArrowLeft size={22} className="text-slate-700" />
          </button>
          <h1 className="text-lg font-bold text-indigo-600 flex-1 text-center">Notification Set</h1>
          <div className="w-11" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
          <FiBell size={48} className="text-indigo-400" />
          <h2 className="text-xl font-bold text-slate-800">We'll notify you!</h2>
          <p className="text-sm text-slate-500 max-w-xs">
            No providers are available in your area right now.
            We'll send you a notification as soon as one becomes available
            {serviceData?.title ? ` for "${serviceData.title}"` : ''}.
          </p>
          <button
            onClick={() => navigate('/customer')}
            className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Booking confirmation view ---------- */
  const providerName =
    selectedProvider?.profile?.name ||
    selectedProvider?.profile?.displayName ||
    selectedProvider?.profile?.fullName ||
    'Provider';

  const addressText =
    selectedAddress?.formattedAddress ||
    selectedAddress?.address ||
    (typeof selectedAddress === 'string' ? selectedAddress : null) ||
    'Not specified';

  return (
    <div className="h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-white">
        <button
          onClick={() => navigate(-1)}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <FiArrowLeft size={22} className="text-slate-700" />
        </button>
        <h1 className="text-lg font-bold text-indigo-600 flex-1 text-center">Booking Summary</h1>
        <div className="w-11" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Confirmation badge */}
        {fromProviderSelector && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <FiCheckCircle size={24} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700 font-medium">Provider selected successfully</p>
          </div>
        )}

        {/* Service Info */}
        {serviceData && (
          <div className="p-4 border border-slate-200 rounded-xl bg-white">
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {serviceData.title || serviceData.name || 'Service'}
            </h3>
            {category && (
              <p className="text-xs text-slate-500 mb-2">Category: {typeof category === 'string' ? category : category.name || category.title || ''}</p>
            )}
            {packageData && (
              <p className="text-sm text-slate-600">
                Package: {packageData.name || packageData.title || 'Standard'}{' '}
                {packageData.price != null && <span className="font-semibold text-indigo-600">₹{packageData.price}</span>}
              </p>
            )}
          </div>
        )}

        {/* Provider */}
        {selectedProvider && (
          <div className="p-4 border border-slate-200 rounded-xl bg-white">
            <p className="text-xs text-slate-500 mb-1 font-semibold">Provider</p>
            <p className="text-base font-bold text-slate-800">{providerName}</p>
            {selectedProvider.distanceKm != null && (
              <p className="text-xs text-slate-500 mt-1">{selectedProvider.distanceKm.toFixed(1)} km away</p>
            )}
          </div>
        )}

        {/* Address */}
        <div className="p-4 border border-slate-200 rounded-xl bg-white flex items-start gap-3">
          <FiMapPin size={18} className="text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 mb-1 font-semibold">Service Address</p>
            <p className="text-sm text-slate-800">{addressText}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 bg-white">
        <button
          onClick={() => {
            // TODO: implement actual booking creation via Firebase
            alert('Booking confirmed! (Integration pending)');
            navigate('/customer');
          }}
          className="w-full py-3 px-6 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          Confirm Booking
        </button>
      </div>
    </div>
  );
};

export default Bookings;