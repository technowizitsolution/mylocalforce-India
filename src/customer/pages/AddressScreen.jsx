import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiLoader, FiMapPin, FiSearch } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { fetchUserProfile } from '../../services/firebase';
import { fetchAutocompleteSuggestions, geocodeAddress } from '../../utils/googleMaps';

const AddressScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Extract all possible navigation state shapes — callers may pass flattened
  // keys (serviceData, providers, category, packageData) or a nested `params` object.
  const locationState = location.state || {};
  const {
    defaultAddress: defaultAddressParam = null,
    nextScreen = 'ProviderSelector',
    params: nestedParams = {},
    // Also extract flattened keys from callers like ServiceDetailsScreen
    serviceData: flatServiceData,
    providers: flatProviders,
    category: flatCategory,
    packageData: flatPackageData,
  } = locationState;

  // Merge flattened state into params so downstream navigation works correctly
  const params = {
    ...nestedParams,
    ...(flatServiceData ? { serviceData: flatServiceData } : {}),
    ...(flatProviders ? { providers: flatProviders } : {}),
    ...(flatCategory ? { category: flatCategory } : {}),
    ...(flatPackageData ? { packageData: flatPackageData } : {}),
  };

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [savedAddress, setSavedAddress] = useState(defaultAddressParam);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [savedAddressLoading, setSavedAddressLoading] = useState(false);
  const selectingRef = useRef(false);
  const debounceRef = useRef(null);

  const extractCoordsFromProfile = profile => {
    if (!profile) return { lat: null, lng: null };

    const lat =
      profile.latitude ??
      profile.lat ??
      profile.coords?.lat ??
      profile.coords?.latitude ??
      profile.location?.latitude ??
      profile.location?._lat ??
      null;

    const lng =
      profile.longitude ??
      profile.lng ??
      profile.coords?.lng ??
      profile.coords?.longitude ??
      profile.location?.longitude ??
      profile.location?._long ??
      null;

    return { lat, lng };
  };

  const resolveNextRoute = screenName => {
    if (!screenName || typeof screenName !== 'string') {
      return '/customer/provider-selector';
    }

    if (screenName.startsWith('/')) {
      return screenName;
    }

    if (screenName === 'ProviderSelector') {
      return '/customer/provider-selector';
    }

    return `/customer/${screenName.toLowerCase()}`;
  };

  useEffect(() => {
    let mounted = true;

    const loadSavedAddress = async () => {
      if (savedAddress || !user?.uid) return;

      setSavedAddressLoading(true);
      try {
        const profile = await fetchUserProfile(user.uid).catch(() => null);
        if (!mounted || !profile) return;

        const formatted =
          profile.formattedAddress ||
          profile.formatted_address ||
          profile.address ||
          null;

        const { lat, lng } = extractCoordsFromProfile(profile);

        if (formatted) {
          setSavedAddress({
            formattedAddress: formatted,
            lat: lat ?? null,
            lng: lng ?? null,
            raw: profile,
          });
        }
      } finally {
        if (mounted) setSavedAddressLoading(false);
      }
    };

    loadSavedAddress();

    return () => {
      mounted = false;
    };
  }, [savedAddress, user]);

  // Autocomplete — debounced, uses Google Maps JS SDK (CORS-safe)
  useEffect(() => {
    if (selectingRef.current) return;

    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchAutocompleteSuggestions(query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const goToNextStep = addr => {
    // Deep-clone the state to strip non-serializable values (functions, class
    // instances, Firestore refs, etc.) that would cause a DataCloneError when
    // the browser tries to push the entry onto the History stack.
    const rawState = { ...params, selectedAddress: addr };
    const safeState = JSON.parse(JSON.stringify(rawState));

    navigate(resolveNextRoute(nextScreen), { state: safeState });
  };

  const handleSelectSuggestion = async suggestion => {
    selectingRef.current = true;

    try {
      setQuery(suggestion.description);
      setSuggestions([]);

      console.log("I am here")

      const geocoded = await geocodeAddress(suggestion.description);
      console.log("Geocoded result:", geocoded);
      if (geocoded) {
        setSelectedAddress(geocoded);
        goToNextStep(geocoded);
        console.log("Navigating to next step with geocoded address");
      } else {
        // Even if geocoding fails, pass the text address forward
        const fallbackAddr = {
          formattedAddress: suggestion.description,
          lat: null,
          lng: null,
        };
        setSelectedAddress(fallbackAddr);
        goToNextStep(fallbackAddr);
      }
    } finally {
      selectingRef.current = false;
    }
  };

  const handleUseThis = async useSaved => {
    let addressToUse = null;

    if (useSaved) {
      addressToUse = savedAddress || null;
    } else {
      addressToUse = selectedAddress;
      if (!addressToUse && query) {
        const geocoded = await geocodeAddress(query);
        if (geocoded) {
          addressToUse = geocoded;
          setSelectedAddress(geocoded);
        } else {
          // Fallback: pass plain text address so navigation isn't blocked
          addressToUse = {
            formattedAddress: query.trim(),
            lat: null,
            lng: null,
          };
          setSelectedAddress(addressToUse);
        }
      }
    }

    if (!addressToUse) {
      window.alert(
        'Please enter or select an address to continue.',
      );
      return;
    }

    goToNextStep(addressToUse);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mb-6 rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => navigate(-1)}
              className="h-10 w-10 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-100 transition-colors"
            >
              <FiArrowLeft className="h-5 w-5 text-slate-700" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800">Enter Address</h1>
            <div className="h-10 w-10" />
          </div>
        </div>

        <div className="space-y-5 rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-6">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-3">
              Select Saved Address
            </h2>

            {savedAddress ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-indigo-700 mb-1">Saved Address</p>
                    <p className="text-sm text-slate-700 wrap-break-word">
                      {savedAddress.formattedAddress ||
                        savedAddress.address ||
                        JSON.stringify(savedAddress)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleUseThis(true)}
                  className="mt-4 inline-flex items-center justify-center rounded-lg border border-indigo-500 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  Use This
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                {savedAddressLoading ? (
                  <span className="flex items-center gap-2">
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Loading saved address...
                  </span>
                ) : (
                  'No saved address found.'
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-sm font-semibold text-slate-500">Or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div>
            <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-3">
              Enter New Address
            </h2>

            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Start typing your address..."
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {loading && (
                <FiLoader className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600 animate-spin" />
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {suggestions.map(item => (
                  <button
                    key={item.place_id}
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <span className="text-sm text-slate-700">{item.description}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleUseThis(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                <FiSearch className="h-4 w-4" />
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddressScreen;
