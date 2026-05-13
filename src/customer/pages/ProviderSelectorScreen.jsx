import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiArrowLeft, FiStar, FiMapPin, FiMail, FiUser, FiAward, FiThumbsUp, FiUserPlus, FiMessageCircle, FiX, FiChevronRight, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { fetchUserProfile } from '../../services/firebase';
import { fetchServicesByProvider } from '../../services/firebase/serviceService';
import app, { auth as firebaseAuth } from '../../services/firebase/firebaseConfig';
import { geocodeAddress } from '../../utils/googleMaps';

const ProviderSelectorScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Freeze location.state in a ref — default values like [] create new
  // references every render, causing an infinite effect loop.
  const stableState = useRef(location.state || {});
  const serviceData = stableState.current.serviceData ?? null;
  const initialProviders = stableState.current.providers ?? [];
  const category = stableState.current.category ?? null;
  const packageData = stableState.current.packageData ?? null;
  const selectedAddress = stableState.current.selectedAddress ?? stableState.current.address ?? null;

  // Mutable ref so async callbacks always see the latest auth user.
  const userRef = useRef(user);
  userRef.current = user;

  const [loading, setLoading] = useState(true);
  const [nearby, setNearby] = useState([]);
  const customerCoordsRef = useRef({ lat: null, lng: null });
  const [selectedProviderProfile, setSelectedProviderProfile] = useState(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [providerServices, setProviderServices] = useState([]);
  const [providerServicesLoading, setProviderServicesLoading] = useState(false);
  const [showAllProviderServices, setShowAllProviderServices] = useState(false);

  const extractCoordsFromProfile = useCallback(profile => {
    if (!profile) return null;
    if (
      profile.location &&
      (profile.location.latitude || profile.location._lat)
    ) {
      const lat = profile.location.latitude ?? profile.location._lat ?? null;
      const lng = profile.location.longitude ?? profile.location._long ?? null;
      if (lat != null && lng != null)
        return { lat: Number(lat), lng: Number(lng) };
    }
    if (profile.coords && (profile.coords.lat || profile.coords.latitude)) {
      const lat = profile.coords.lat ?? profile.coords.latitude ?? null;
      const lng = profile.coords.lng ?? profile.coords.longitude ?? null;
      if (lat != null && lng != null)
        return { lat: Number(lat), lng: Number(lng) };
    }
    if (profile.latitude != null && profile.longitude != null) {
      return { lat: Number(profile.latitude), lng: Number(profile.longitude) };
    }
    if (profile.lat != null && profile.lng != null) {
      return { lat: Number(profile.lat), lng: Number(profile.lng) };
    }
    if (
      profile.geopoint &&
      (profile.geopoint.latitude || profile.geopoint._lat)
    ) {
      const lat = profile.geopoint.latitude ?? profile.geopoint._lat ?? null;
      const lng = profile.geopoint.longitude ?? profile.geopoint._long ?? null;
      if (lat != null && lng != null)
        return { lat: Number(lat), lng: Number(lng) };
    }
    return null;
  }, []);

  // geocodeAddress is imported from ../../utils/googleMaps (CORS-safe SDK)
  // Address coords are resolved inside the main load effect below.

  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const toRad = v => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const normalizeCoords = c => {
    if (!c) return null;
    let lat = Number(c.lat ?? c.latitude ?? c._lat ?? null);
    let lng = Number(c.lng ?? c.longitude ?? c._long ?? c._lng ?? null);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const latValid = lat >= -90 && lat <= 90;
    const lngValid = lng >= -180 && lng <= 180;
    if (!latValid && lngValid && lng >= -90 && lng <= 90 && lat >= -180 && lat <= 180) {
      const _lat = lat;
      lat = lng;
      lng = _lat;
      console.warn('ProviderSelector: swapped coords', c, { lat, lng });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };

  const getDisplayName = profile => {
    if (!profile) return 'Provider';
    return (
      profile.name ||
      profile.fullName ||
      profile.full_name ||
      profile.displayName ||
      profile.display_name ||
      profile.formattedAddress ||
      profile.formatted_address ||
      profile.address ||
      (profile.firstName || profile.first_name
        ? `${profile.firstName || profile.first_name || ''} ${
            profile.lastName || profile.last_name || ''
          }`.trim()
        : null) ||
      profile.businessName ||
      profile.company ||
      'Provider'
    );
  };

  const getAvatarUrl = profile => {
    if (!profile) return null;
    return (
      profile.photoURL ||
      profile.photoUrl ||
      profile.avatar ||
      profile.photo ||
      profile.profileImage ||
      profile.picture ||
      profile.profile_image ||
      null
    );
  };

  const getRating = profile => {
    if (!profile) return null;
    const r =
      profile.rating ??
      profile.avgRating ??
      profile.ratingAvg ??
      profile.rating_value ??
      profile.ratingsAvg ??
      profile.ratingAverage ??
      profile.rating_score;
    if (r == null) return null;
    const n = Number(r);
    return Number.isFinite(n) ? n : null;
  };

  const getServiceLabel = profile => {
    if (!profile) return null;
    const svc =
      profile.services ||
      profile.servicesOffered ||
      profile.offeredServices ||
      profile.providedServices ||
      profile.skills ||
      null;
    if (!svc) return null;
    if (Array.isArray(svc) && svc.length > 0) {
      const first = svc[0];
      if (typeof first === 'string') return first;
      if (first.name || first.title || first.label)
        return first.name || first.title || first.label;
    }
    return null;
  };

  const getInitials = profile => {
    const display = getDisplayName(profile) || '';
    const parts = display.split(' ').filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  const resolveProviderCoords = useCallback(
    async providerId => {
      if (serviceData) {
        const candidates = [
          serviceData.location,
          serviceData.coords,
          serviceData.providerLocation,
          serviceData.ownerLocation,
          serviceData.latitude && serviceData.longitude
            ? {
                latitude: serviceData.latitude,
                longitude: serviceData.longitude,
              }
            : null,
        ];
        for (const c of candidates) {
          if (!c) continue;
          const lat = c.latitude ?? c.lat ?? c._lat ?? null;
          const lng = c.longitude ?? c.lng ?? c._long ?? null;
          if (lat != null && lng != null)
            return { lat: Number(lat), lng: Number(lng) };
        }
      }

      let providerProfile = null;
      try {
        providerProfile = await fetchUserProfile(providerId);
        const coords = extractCoordsFromProfile(providerProfile);
        if (coords) return coords;
      } catch (err) {
        providerProfile = null;
      }

      try {
        const projectId = app?.options?.projectId || 'mylocalforce-295b8';
        const url = `https://us-central1-${projectId}.cloudfunctions.net/getProviderPublicProfile`;
        let idToken = null;
        try {
          if (
            firebaseAuth &&
            firebaseAuth.currentUser &&
            firebaseAuth.currentUser.getIdToken
          ) {
            idToken = await firebaseAuth.currentUser.getIdToken();
          } else if (userRef.current?.getIdToken) {
            idToken = await userRef.current.getIdToken();
          }
        } catch (tErr) {
          idToken = null;
        }

        if (idToken) {
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ providerId }),
          });
          if (resp.ok) {
            const json = await resp.json();
            const loc = json?.location;
            if (
              loc &&
              (loc.latitude != null || loc.lat != null) &&
              (loc.longitude != null || loc.lng != null)
            ) {
              return {
                lat: Number(loc.latitude ?? loc.lat),
                lng: Number(loc.longitude ?? loc.lng),
              };
            }
          }
        }
      } catch (err) {
        // ignore
      }

      return null;
    },
    [serviceData, extractCoordsFromProfile],
  );

  // Note: user profile fallback for coords is handled inside the main load effect below

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      let results = [];

      try {
        let custCoords = customerCoordsRef.current;
        const addrParam = selectedAddress;
        if (addrParam) {
          if (addrParam.lat != null && addrParam.lng != null) {
            custCoords = { lat: Number(addrParam.lat), lng: Number(addrParam.lng) };
            customerCoordsRef.current = custCoords;
          } else if (addrParam.formattedAddress) {
            try {
              const g = await geocodeAddress(addrParam.formattedAddress);
              if (g && g.lat != null && g.lng != null) {
                custCoords = g;
                customerCoordsRef.current = g;
              }
            } catch (e) {
              // ignore geocode failure
            }
          }
        }

        if ((!custCoords || custCoords.lat == null || custCoords.lng == null) && userRef.current?.uid) {
          try {
            const prof = await fetchUserProfile(userRef.current.uid);
            const coords = extractCoordsFromProfile(prof);
            if (coords) {
              custCoords = coords;
              const c = { lat: coords.lat, lng: coords.lng };
              customerCoordsRef.current = c;
            }
            if (!coords && prof?.address) {
              const geo = await geocodeAddress(prof.address);
              if (geo) {
                custCoords = geo;
                const c = { lat: geo.lat, lng: geo.lng };
                customerCoordsRef.current = c;
              }
            }
          } catch (e) {
            // ignore
          }
        }

        const src =
          Array.isArray(initialProviders) && initialProviders.length > 0
            ? initialProviders
            : Array.isArray(serviceData?.providers) && serviceData.providers.length > 0
            ? serviceData.providers
            : serviceData && (serviceData.ownerId || serviceData.ownerId === 0)
            ? [serviceData.ownerId]
            : [];
        if (!src || src.length === 0) {
          if (mounted) {
            setNearby([]);
            setLoading(false);
          }
          return;
        }

        for (const p of src) {
          const pid =
            typeof p === 'string'
              ? p
              : p.id || p.providerId || p.ownerId || p.uid;
          if (!pid) continue;

          let profile = null;
          try {
            profile = await fetchUserProfile(pid);
          } catch (err) {
            profile = null;
          }

          if (!profile) {
            try {
              const projectId = app?.options?.projectId || 'mylocalforce-295b8';
              const url = `https://us-central1-${projectId}.cloudfunctions.net/getProviderPublicProfile`;
              let idToken = null;
              try {
                if (
                  firebaseAuth &&
                  firebaseAuth.currentUser &&
                  firebaseAuth.currentUser.getIdToken
                ) {
                  idToken = await firebaseAuth.currentUser.getIdToken();
                } else if (userRef.current?.getIdToken) {
                  idToken = await userRef.current.getIdToken();
                }
              } catch (tErr) {
                idToken = null;
              }
              if (idToken) {
                const resp = await fetch(url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({ providerId: pid }),
                });
                if (resp.ok) {
                  const json = await resp.json();
                  if (json) profile = json;
                }
              }
            } catch (pfErr) {
              // ignore
            }
          }

          let coords = extractCoordsFromProfile(profile);
          if (!coords && !profile) {
            // Only call resolveProviderCoords if we have no profile yet
            // (it already fetches profile + cloud function internally)
            try {
              coords = await resolveProviderCoords(pid);
            } catch (err) {
              coords = null;
            }
          }

          let distanceKm = null;
          if (coords && custCoords && custCoords.lat != null && custCoords.lng != null) {
            try {
              const a = normalizeCoords(custCoords);
              const b = normalizeCoords(coords);
              if (a && b) {
                distanceKm = getDistanceKm(a.lat, a.lng, b.lat, b.lng);
              } else {
                distanceKm = null;
              }
            } catch (dErr) {
              console.warn('ProviderSelector: distance calc failed', dErr);
              distanceKm = null;
            }
          }

          if (distanceKm != null) {
            if (distanceKm <= 20) {
              results.push({ id: pid, profile, coords, distanceKm });
            }
          } else {
            results.push({
              id: pid,
              profile,
              coords: coords || null,
              distanceKm: null,
              unknownDistance: true,
            });
          }
        }

        if (mounted) {
          results.sort((a, b) => {
            const aNull = a.distanceKm == null;
            const bNull = b.distanceKm == null;
            if (aNull && bNull) return 0;
            if (aNull) return 1;
            if (bNull) return -1;
            return a.distanceKm - b.distanceKm;
          });
          setNearby(results);
        }
      } catch (err) {
        console.warn('ProviderSelector: load error', err);
        if (mounted) setNearby([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleSelect = provider => {
    navigate('/customer/booking', {
      state: {
        serviceData,
        category,
        packageData,
        providers: [provider],
        selectedProvider: provider,
        selectedAddress,
        fromProviderSelector: true,
      },
    });
  };

  const handleViewProfile = async provider => {
    setSelectedProviderProfile(provider);
    setShowAllProviderServices(false);
    setProfileModalVisible(true);
    try {
      setProviderServicesLoading(true);
      const pid = provider?.id || provider?.uid || provider?.userId || provider?.providerId;
      if (pid) {
        const svcs = await fetchServicesByProvider(pid);
        setProviderServices(Array.isArray(svcs) ? svcs : []);
      } else {
        setProviderServices([]);
      }
    } catch (err) {
      setProviderServices([]);
    } finally {
      setProviderServicesLoading(false);
    }
  };

  const handleSelectFromProfile = () => {
    if (selectedProviderProfile) {
      setProfileModalVisible(false);
      setShowAllProviderServices(false);
      handleSelect(selectedProviderProfile);
    }
  };

  const profileServices = useMemo(() => {
    if (providerServicesLoading) return [];

    if (Array.isArray(providerServices) && providerServices.length > 0) {
      return providerServices;
    }

    const fallbackServices =
      selectedProviderProfile?.profile?.services ||
      selectedProviderProfile?.profile?.servicesOffered ||
      [];

    return Array.isArray(fallbackServices) ? fallbackServices : [];
  }, [providerServices, providerServicesLoading, selectedProviderProfile]);

  const visibleProfileServices = showAllProviderServices
    ? profileServices
    : profileServices.slice(0, 3);

  const hasMoreProfileServices = profileServices.length > 3;

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
        <h1 className="text-lg font-bold text-indigo-600 flex-1 text-center">Service Provider's</h1>
        <div className="w-11" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : nearby && nearby.length > 0 ? (
          <div className="space-y-4">
            {nearby.map(item => {
              const name = getDisplayName(item.profile);
              const avatar = getAvatarUrl(item.profile);
              const rating = getRating(item.profile);
              const serviceLabel = getServiceLabel(item.profile);
              const initials = getInitials(item.profile);

              return (
                <button
                  key={item.id}
                  onClick={() => handleViewProfile(item)}
                  className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl bg-white hover:shadow-md transition-shadow text-left"
                >
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-full overflow-hidden shrink-0">
                    {avatar ? (
                      <img src={avatar} alt={name} className="w-14 h-14 object-cover" />
                    ) : (
                      <div className="w-14 h-14 bg-slate-300 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">{initials}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-slate-800 truncate">{name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {rating != null && (
                        <span className="text-xs text-slate-500">★ {Number(rating).toFixed(1)}</span>
                      )}
                      {serviceLabel && (
                        <span className="text-xs text-slate-500">{serviceLabel}</span>
                      )}
                      {item.distanceKm != null ? (
                        <span className="text-xs text-slate-500">{item.distanceKm.toFixed(1)} km</span>
                      ) : (
                        <span className="text-xs text-slate-500">Distance unknown</span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <FiChevronRight size={20} className="text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-6 px-4 text-center">
            <p className="text-lg text-slate-800 font-medium">
              Currently, no service provider is available in your area. We will notify you as soon as a provider becomes available for this service.
            </p>
            <button
              onClick={() => navigate('/customer/booking', {
                state: {
                  serviceData,
                  category,
                  packageData,
                  selectedAddress,
                  address: selectedAddress,
                  isLead: true,
                },
              })}
              className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
            >
              Notify me when available
            </button>
          </div>
        )}
      </div>

      {/* Provider Profile Modal */}
      {profileModalVisible && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg flex flex-col w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-white rounded-t-3xl sm:rounded-t-2xl shrink-0">
              <button
                onClick={() => {
                  setShowAllProviderServices(false);
                  setProfileModalVisible(false);
                }}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
              >
                <FiX size={24} className="text-slate-700" />
              </button>
              <h2 className="text-lg font-bold text-slate-800 flex-1 text-center">Provider Profile</h2>
              <div className="w-11" />
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {selectedProviderProfile && (
                <>
                  {/* Profile Header */}
                  <div className="text-center pb-6 border-b border-slate-200 mb-6">
                    <div className="w-24 h-24 rounded-full overflow-hidden mx-auto mb-4">
                      {getAvatarUrl(selectedProviderProfile.profile) ? (
                        <img
                          src={getAvatarUrl(selectedProviderProfile.profile)}
                          alt="Provider"
                          className="w-24 h-24 object-cover"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-indigo-600 flex items-center justify-center">
                          <span className="text-white font-bold text-xl">{getInitials(selectedProviderProfile.profile)}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{getDisplayName(selectedProviderProfile.profile)}</h3>
                    {getRating(selectedProviderProfile.profile) != null && (
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <FiStar size={18} className="text-amber-500" />
                        <span className="text-base font-semibold text-slate-800">
                          {Number(getRating(selectedProviderProfile.profile)).toFixed(1)} Rating
                        </span>
                      </div>
                    )}
                    {selectedProviderProfile.distanceKm != null && (
                      <div className="flex items-center justify-center gap-2">
                        <FiMapPin size={16} className="text-slate-500" />
                        <span className="text-sm text-slate-500">
                          {selectedProviderProfile.distanceKm.toFixed(1)} km away
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details Section */}
                  <div className="mb-6">
                    <h4 className="text-base font-bold text-slate-800 mb-4">Details</h4>
                    <div className="space-y-3">
                      {selectedProviderProfile.profile?.gender && (
                        <div className="flex items-start gap-3">
                          <FiUser size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-slate-500 font-semibold">Gender:</p>
                            <p className="text-sm text-slate-800">
                              {selectedProviderProfile.profile.gender.charAt(0).toUpperCase() + 
                               selectedProviderProfile.profile.gender.slice(1)}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedProviderProfile.profile?.email && (
                        <div className="flex items-start gap-3">
                          <FiMail size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-slate-500 font-semibold">Email:</p>
                            <p className="text-sm text-slate-800">{selectedProviderProfile.profile.email}</p>
                          </div>
                        </div>
                      )}
                      {selectedProviderProfile.profile?.address && (
                        <div className="flex items-start gap-3">
                          <FiMapPin size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm text-slate-500 font-semibold">Location:</p>
                            <p className="text-sm text-slate-800">{selectedProviderProfile.profile.address}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Services Offered */}
                  {(providerServicesLoading || profileServices.length > 0) && (
                    <div className="mb-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h4 className="text-base font-bold text-slate-800">Services Offered</h4>
                        {!providerServicesLoading && hasMoreProfileServices && (
                          <button
                            type="button"
                            onClick={() => setShowAllProviderServices(prev => !prev)}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            <span>{showAllProviderServices ? 'View less' : 'View more'}</span>
                            {showAllProviderServices ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {providerServicesLoading && (
                          <p className="text-sm text-slate-500">Loading services...</p>
                        )}

                        {!providerServicesLoading && visibleProfileServices.length > 0 &&
                          visibleProfileServices.map((svc, idx) => (
                            <div
                              key={
                                typeof svc === 'string'
                                  ? `service-${idx}`
                                  : (svc.id || svc._id || svc.name || `service-${idx}`)
                              }
                              className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg"
                            >
                              <p className="text-sm font-semibold">
                                {typeof svc === 'string'
                                  ? svc
                                  : (svc.title || svc.name || svc.serviceName || svc.displayName || 'Service')}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* About Section */}
                  {(selectedProviderProfile.profile?.bio ||
                    selectedProviderProfile.profile?.description ||
                    selectedProviderProfile.profile?.about) && (
                    <div className="mb-6">
                      <h4 className="text-base font-bold text-slate-800 mb-3">About</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {selectedProviderProfile.profile.bio ||
                          selectedProviderProfile.profile.description ||
                          selectedProviderProfile.profile.about}
                      </p>
                    </div>
                  )}

                  {/* Experience Section */}
                  {selectedProviderProfile.profile?.experience && (
                    <div className="mb-6">
                      <h4 className="text-base font-bold text-slate-800 mb-3">Experience</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {selectedProviderProfile.profile.experience}
                      </p>
                    </div>
                  )}

                  {/* Rating & Reviews */}
                  <div className="mb-6">
                    <h4 className="text-base font-bold text-slate-800 mb-4">Rating & Reviews</h4>
                    <div className="p-4 border border-slate-200 rounded-xl mb-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="text-4xl font-bold text-indigo-600 mb-2">
                            {getRating(selectedProviderProfile.profile) != null
                              ? Number(getRating(selectedProviderProfile.profile)).toFixed(1)
                              : '—'}
                          </p>
                          <div className="flex gap-0.5 mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <FiStar
                                key={star}
                                size={16}
                                className={
                                  getRating(selectedProviderProfile.profile) != null &&
                                  star <= getRating(selectedProviderProfile.profile)
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-slate-300'
                                }
                              />
                            ))}
                          </div>
                          <p className="text-sm text-slate-500">
                            {selectedProviderProfile.profile?.ratingCount || 0} rating
                            {(selectedProviderProfile.profile?.ratingCount || 0) !== 1 ? 's' : ''}
                          </p>
                        </div>

                        <div>
                          {getRating(selectedProviderProfile.profile) != null && 
                           getRating(selectedProviderProfile.profile) >= 4.5 ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100 rounded-lg">
                              <FiAward size={20} className="text-emerald-600" />
                              <span className="text-sm font-semibold text-emerald-600">Top Rated</span>
                            </div>
                          ) : getRating(selectedProviderProfile.profile) != null && 
                             getRating(selectedProviderProfile.profile) >= 4.0 ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-100 rounded-lg">
                              <FiThumbsUp size={20} className="text-indigo-600" />
                              <span className="text-sm font-semibold text-indigo-600">Recommended</span>
                            </div>
                          ) : (selectedProviderProfile.profile?.ratingCount || 0) === 0 ? (
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                              <FiUserPlus size={20} className="text-slate-500" />
                              <span className="text-sm font-semibold text-slate-500">New Provider</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {(selectedProviderProfile.profile?.ratingCount || 0) === 0 && (
                      <div className="p-6 bg-slate-100 rounded-xl text-center border-2 border-dashed border-slate-300">
                        <FiMessageCircle size={24} className="text-slate-500 mx-auto mb-3" />
                        <p className="text-base font-semibold text-slate-800 mb-1">No reviews yet</p>
                        <p className="text-sm text-slate-500">Be the first to review this provider!</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-white rounded-b-3xl sm:rounded-b-2xl shrink-0">
              <button
                onClick={handleSelectFromProfile}
                className="w-full py-3 px-6 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                Select This Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderSelectorScreen;
