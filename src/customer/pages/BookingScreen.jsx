import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiHome,
  FiMinus,
  FiPlus,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { fetchUserProfile } from '../../services/firebase';
import { fetchServicesByProvider } from '../../services/firebase/serviceService';
import app, { auth as firebaseAuth, firestore } from '../../services/firebase/firebaseConfig';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import {
  saveNotificationToFirestore,
  sendPushNotification,
} from '../../services/firebase/notificationService';
import { notify, getUserFacingError } from '../../utils/toast';
import { calculateCartQuote, formatAUD, normalizeServiceItems } from '../../utils/cartPricing';
import { saveCartDraft } from '../../utils/cartDraft';
import { fetchServiceDistanceSetting, isWithinServiceDistance } from '../../utils/serviceDistanceSetting';

// NOTE: geocoding fallback uses the Google Geocoding API. Ensure this key has Geocoding enabled.
const GOOGLE_GEOCODING_API_KEY = 'AIzaSyBfeBvLPaPSEyHpwuqcUXCa-YJnZ3iJu1Q';

const generateTimeSlots = () => {
  const slots = [];
  for (let h = 6; h <= 23; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hours12 = h % 12 || 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const minutesStr = m < 10 ? `0${m}` : `${m}`;
      slots.push(`${hours12}:${minutesStr} ${ampm}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();
const EMPTY_SERVICE_ITEMS = [];
const isPermissionDeniedError = (error) =>
  error?.code === 'permission-denied' ||
  String(error?.message || error || '')
    .toLowerCase()
    .includes('missing or insufficient permissions');

const parsePrice = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseServicePrice = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 0 ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(parsed)) return parsed >= 0 ? parsed : 0;
  }

  return null;
};

const getServiceIdentity = (service) =>
  String(
    service?.id ||
      service?.serviceId ||
      service?._id ||
      service?.name ||
      service?.title ||
      service?.serviceName ||
      ''
  ).trim();

const getServiceDisplayName = (service) =>
  service?.name || service?.title || service?.serviceName || 'Service';

const getProviderId = (provider) => {
  if (!provider) return null;
  if (typeof provider === 'string') return provider;
  return provider.id || provider.providerId || provider.ownerId || provider.uid || null;
};

const getProviderName = (provider, fallback = 'Service Provider') => {
  if (!provider) return fallback;
  if (typeof provider === 'string') return fallback;
  return (
    provider.name || provider.fullName || provider.ownerName || provider.displayName || fallback
  );
};

const BookingScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const {
    category = 'Service',
    subcategory = '',
    packageData = null,
    serviceData = null,
    isLead = false,
    selectedAddress: incomingSelectedAddress = null,
    address: incomingAddress = null,
    providers: incomingProviders = null,
    selectedProvider: routeSelectedProvider = null,
    fromProviderSelector = false,
    platformSettings: incomingPlatformSettings = null,
    leadId = null,
    leadExpectedProviderId = null,
    serviceItems: incomingServiceItems = EMPTY_SERVICE_ITEMS,
  } = location.state || {};

  // Date and Time states
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTimeModal, setShowTimeModal] = useState(false);

  // Address states
  const incomingAddr = incomingSelectedAddress || incomingAddress || null;
  const initialAddressString =
    incomingAddr?.formattedAddress ||
    incomingAddr?.address ||
    (typeof incomingAddr === 'string' ? incomingAddr : '');
  const [defaultAddress, setDefaultAddress] = useState(initialAddressString);
  const [customerCoords, setCustomerCoords] = useState({
    lat: incomingAddr?.lat ?? null,
    lng: incomingAddr?.lng ?? null,
  });

  useEffect(() => {
    if (!serviceData) return;

    saveCartDraft({
      category,
      subcategory,
      packageData,
      serviceData,
      isLead,
      selectedAddress: incomingSelectedAddress,
      address: incomingAddress,
      providers: incomingProviders,
      selectedProvider: routeSelectedProvider,
      fromProviderSelector,
      serviceItems: incomingServiceItems,
    });
  }, [
    category,
    fromProviderSelector,
    incomingAddress,
    incomingSelectedAddress,
    incomingProviders,
    incomingServiceItems,
    isLead,
    packageData,
    routeSelectedProvider,
    serviceData,
    subcategory,
  ]);

  // If location state changes with a new address, apply it
  useEffect(() => {
    const incoming = incomingSelectedAddress || incomingAddress || null;
    if (!incoming) return;
    const formatted =
      incoming.formattedAddress ||
      incoming.address ||
      (typeof incoming === 'string' ? incoming : '');
    setDefaultAddress(formatted);
    setCustomerCoords({ lat: incoming.lat ?? null, lng: incoming.lng ?? null });
  }, [incomingSelectedAddress, incomingAddress]);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Provider selection
  const [providersList, setProvidersList] = useState(
    incomingProviders || serviceData?.providers || []
  );
  const [selectedProvider, setSelectedProvider] = useState(null);
  const originalProvidersRef = useRef(incomingProviders || serviceData?.providers || []);
  const [platformSettings, setPlatformSettings] = useState(incomingPlatformSettings);
  const selectedProviderId = useMemo(
    () =>
      selectedProvider
        ? getProviderId(selectedProvider)
        : serviceData?.ownerId || serviceData?.providerId || null,
    [selectedProvider, serviceData?.ownerId, serviceData?.providerId]
  );
  const selectedProviderName = useMemo(
    () =>
      selectedProvider
        ? getProviderName(selectedProvider)
        : serviceData?.ownerName || 'Service Provider',
    [selectedProvider, serviceData?.ownerName]
  );

  useEffect(() => {
    if (!serviceData) return;
    saveCartDraft({
      category,
      subcategory,
      packageData,
      serviceData,
      isLead,
      selectedAddress: incomingSelectedAddress,
      address: incomingAddress,
      providers: selectedProvider ? [selectedProvider] : incomingProviders,
      selectedProvider,
      fromProviderSelector,
      serviceItems: incomingServiceItems,
    });
  }, [
    category,
    fromProviderSelector,
    incomingAddress,
    incomingSelectedAddress,
    incomingProviders,
    incomingServiceItems,
    isLead,
    packageData,
    selectedProvider,
    serviceData,
    subcategory,
  ]);

  // Confirmation modal state (replaces Alert)
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    if (providersList && providersList.length > 0) {
      setSelectedProvider(providersList[0]);
    }
  }, [providersList]);

  useEffect(() => {
    let mounted = true;

    const loadPlatformSettings = async () => {
      try {
        const settingsRef = doc(firestore, 'platformSettings', 'main');
        const settingsSnap = await getDoc(settingsRef);
        if (!mounted || !settingsSnap.exists()) return;

        const latest = settingsSnap.data();
        if (latest && typeof latest === 'object') {
          setPlatformSettings(latest);
        }
      } catch (error) {
        if (!isPermissionDeniedError(error)) {
          console.warn('Could not load platform settings in booking:', error?.message || error);
        }
      }
    };

    loadPlatformSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const serviceBasePrice = useMemo(() => {
    if (serviceData?.price != null) return parsePrice(serviceData.price, 50);
    if (packageData?.price != null) return parsePrice(packageData.price, 50);
    return 50;
  }, [packageData?.price, serviceData?.price]);

  const serviceName = useMemo(
    () =>
      serviceData?.name ||
      serviceData?.title ||
      serviceData?.serviceName ||
      subcategory ||
      'Service',
    [serviceData?.name, serviceData?.serviceName, serviceData?.title, subcategory]
  );

  const bookingPreviewData = useMemo(
    () => ({
      serviceId: serviceData?.id || null,
      serviceName,
      price: serviceBasePrice,
    }),
    [serviceBasePrice, serviceData?.id, serviceName]
  );

  const baseServiceItems = useMemo(
    () => normalizeServiceItems(bookingPreviewData, incomingServiceItems),
    [bookingPreviewData, incomingServiceItems]
  );

  const [selectedServiceItems, setSelectedServiceItems] = useState(baseServiceItems);
  const [providerServices, setProviderServices] = useState([]);
  const [providerServicesLoading, setProviderServicesLoading] = useState(false);
  const [providerServicesError, setProviderServicesError] = useState('');

  const cartServiceItems = useMemo(
    () => selectedServiceItems.filter((item) => Number(item?.total || 0) > 0),
    [selectedServiceItems]
  );

  const totalSelectedServiceCount = useMemo(
    () => cartServiceItems.reduce((sum, item) => sum + (Number(item?.quantity || 0) || 0), 0),
    [cartServiceItems]
  );

  const primaryServiceName = useMemo(
    () => cartServiceItems[0]?.name || bookingPreviewData.serviceName,
    [bookingPreviewData.serviceName, cartServiceItems]
  );

  const primaryServiceItemId = useMemo(
    () => getServiceIdentity(baseServiceItems[0] || bookingPreviewData),
    [baseServiceItems, bookingPreviewData]
  );

  const serviceQuantityMap = useMemo(() => {
    const quantities = new Map();
    cartServiceItems.forEach((item) => {
      quantities.set(getServiceIdentity(item), Number(item?.quantity || 0));
    });
    return quantities;
  }, [cartServiceItems]);

  const availableProviderServices = useMemo(() => {
    const servicesMap = new Map();

    const addService = (service, isPrimary = false) => {
      if (!service) return;

      const identity = getServiceIdentity(service);
      const price = parseServicePrice(service?.price ?? service?.amount ?? service?.total);
      if (!identity || price == null || price <= 0) return;
      if (!isPrimary && service?.status && service.status !== 'active') return;

      const existing = servicesMap.get(identity);
      servicesMap.set(identity, {
        id: service?.id || service?.serviceId || identity,
        serviceId: service?.id || service?.serviceId || identity,
        name: getServiceDisplayName(service),
        price,
        description: service?.description || null,
        duration: service?.duration || null,
        category: service?.category || null,
        subcategory: service?.subcategory || null,
        isPrimary: Boolean(existing?.isPrimary || isPrimary),
      });
    };

    addService(
      {
        id: bookingPreviewData.serviceId || primaryServiceItemId,
        serviceId: bookingPreviewData.serviceId || primaryServiceItemId,
        name: bookingPreviewData.serviceName,
        price: serviceBasePrice,
        description: serviceData?.description || null,
        duration: serviceData?.duration || packageData?.duration || null,
        category: serviceData?.category || category,
        subcategory: serviceData?.subcategory || subcategory,
        status: 'active',
      },
      true
    );

    providerServices.forEach((service) => addService(service));

    return Array.from(servicesMap.values()).sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [
    bookingPreviewData,
    category,
    packageData?.duration,
    primaryServiceItemId,
    providerServices,
    serviceBasePrice,
    serviceData?.category,
    serviceData?.description,
    serviceData?.duration,
    serviceData?.subcategory,
    subcategory,
  ]);

  useEffect(() => {
    setSelectedServiceItems(baseServiceItems);
  }, [baseServiceItems, selectedProviderId]);

  useEffect(() => {
    let mounted = true;

    const loadProviderServices = async () => {
      if (!selectedProviderId || isLead) {
        if (mounted) {
          setProviderServices([]);
          setProviderServicesError('');
          setProviderServicesLoading(false);
        }
        return;
      }

      try {
        if (mounted) {
          setProviderServicesLoading(true);
          setProviderServicesError('');
        }

        const services = await fetchServicesByProvider(selectedProviderId);
        if (!mounted) return;
        setProviderServices(Array.isArray(services) ? services : []);
      } catch (error) {
        if (!mounted) return;
        console.warn('Could not load provider services in BookingScreen:', error?.message || error);
        setProviderServices([]);
        setProviderServicesError('Unable to load more services from this provider right now.');
      } finally {
        if (mounted) setProviderServicesLoading(false);
      }
    };

    loadProviderServices();
    return () => {
      mounted = false;
    };
  }, [isLead, selectedProviderId]);

  const updateServiceQuantity = useCallback(
    (service, delta) => {
      if (!delta) return;

      const serviceIdentity = getServiceIdentity(service);
      const parsedPrice = parseServicePrice(service?.price ?? service?.amount ?? service?.total);
      if (!serviceIdentity || parsedPrice == null || parsedPrice <= 0) return;

      setSelectedServiceItems((prevItems) => {
        const existingIndex = prevItems.findIndex(
          (item) => getServiceIdentity(item) === serviceIdentity
        );
        const minimumQuantity = serviceIdentity === primaryServiceItemId ? 1 : 0;

        if (existingIndex === -1) {
          if (delta < 0) return prevItems;

          return [
            ...prevItems,
            {
              id: service?.id || serviceIdentity,
              serviceId: service?.serviceId || service?.id || serviceIdentity,
              name: getServiceDisplayName(service),
              quantity: 1,
              price: parsedPrice,
              total: parsedPrice,
            },
          ];
        }

        const existingItem = prevItems[existingIndex];
        const currentQuantity = Number(existingItem?.quantity || 0);
        const nextQuantity = Math.max(minimumQuantity, currentQuantity + delta);

        if (nextQuantity === 0) {
          return prevItems.filter((_, index) => index !== existingIndex);
        }

        const updatedItems = [...prevItems];
        updatedItems[existingIndex] = {
          ...existingItem,
          id: existingItem.id || service?.id || serviceIdentity,
          serviceId: existingItem.serviceId || service?.serviceId || service?.id || serviceIdentity,
          name: getServiceDisplayName(service),
          quantity: nextQuantity,
          price: parsedPrice,
          total: parsedPrice * nextQuantity,
        };
        return updatedItems;
      });
    },
    [primaryServiceItemId]
  );

  const bookingQuote = useMemo(
    () =>
      calculateCartQuote({
        serviceItems: cartServiceItems,
        platformSettings,
      }),
    [cartServiceItems, platformSettings]
  );

  const minimumBookingTotal = 50;
  const minimumOrderShortfall = Math.max(0, minimumBookingTotal - bookingQuote.totalBeforeStripe);
  const meetsMinimumBookingAmount = isLead || bookingQuote.totalBeforeStripe >= minimumBookingTotal;

  // ── Helpers ──

  const extractCoordsFromProfile = useCallback((profile) => {
    if (!profile) return null;
    if (profile.location && (profile.location.latitude || profile.location._lat)) {
      const lat = profile.location.latitude ?? profile.location._lat ?? null;
      const lng = profile.location.longitude ?? profile.location._long ?? null;
      if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
    }
    if (profile.coords && (profile.coords.lat || profile.coords.latitude)) {
      const lat = profile.coords.lat ?? profile.coords.latitude ?? null;
      const lng = profile.coords.lng ?? profile.coords.longitude ?? null;
      if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
    }
    if (profile.latitude != null && profile.longitude != null) {
      return { lat: Number(profile.latitude), lng: Number(profile.longitude) };
    }
    if (profile.lat != null && profile.lng != null) {
      return { lat: Number(profile.lat), lng: Number(profile.lng) };
    }
    if (profile.geopoint && (profile.geopoint.latitude || profile.geopoint._lat)) {
      const lat = profile.geopoint.latitude ?? profile.geopoint._lat ?? null;
      const lng = profile.geopoint.longitude ?? profile.geopoint._long ?? null;
      if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
    }
    return null;
  }, []);

  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const geocodeAddress = useCallback(async (address) => {
    if (!address) return null;
    try {
      const encoded = encodeURIComponent(address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_GEOCODING_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);
      const data = await res.json();
      if (data.status === 'OK' && data.results && data.results[0]) {
        const loc = data.results[0].geometry.location;
        return { lat: Number(loc.lat), lng: Number(loc.lng) };
      }
      console.warn('Geocoding returned no results', data.status, data);
      return null;
    } catch (err) {
      console.warn('Geocoding error', err);
      return null;
    }
  }, []);

  const resolveProviderCoords = useCallback(
    async (providerId) => {
      if (serviceData) {
        const candidates = [
          serviceData.location,
          serviceData.coords,
          serviceData.providerLocation,
          serviceData.ownerLocation,
          serviceData.latitude && serviceData.longitude
            ? { latitude: serviceData.latitude, longitude: serviceData.longitude }
            : null,
        ];
        for (const c of candidates) {
          if (!c) continue;
          const lat = c.latitude ?? c.lat ?? c._lat ?? null;
          const lng = c.longitude ?? c.lng ?? c._long ?? null;
          if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
        }
      }

      let providerProfile = null;
      if (providerId) {
        try {
          providerProfile = await fetchUserProfile(providerId);
          const coords = extractCoordsFromProfile(providerProfile);
          if (coords) return coords;
        } catch (err) {
          const msg = err?.message || String(err);
          const isPermissionError =
            err?.code === 'permission-denied' || /permission|insufficient permissions/i.test(msg);
          if (!isPermissionError) {
            console.warn('Failed to fetch provider profile for coords:', msg);
          }

          try {
            const projectId = app?.options?.projectId || 'mylocalforce-295b8';
            const url = `https://us-central1-${projectId}.cloudfunctions.net/getProviderPublicProfile`;
            let idToken = null;
            try {
              if (firebaseAuth?.currentUser?.getIdToken) {
                idToken = await firebaseAuth.currentUser.getIdToken();
              } else if (user?.getIdToken) {
                idToken = await user.getIdToken();
              }
            } catch (tErr) {
              console.warn('Could not retrieve ID token:', tErr?.message || tErr);
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
          } catch (fnErr) {
            console.warn('Server-side provider profile fetch failed:', fnErr?.message || fnErr);
          }
        }
      }

      const possibleAddress =
        (serviceData &&
          (serviceData.address || serviceData.ownerAddress || serviceData.providerAddress)) ||
        (providerProfile && providerProfile.address) ||
        null;

      if (possibleAddress) {
        try {
          const geocoded = await geocodeAddress(possibleAddress);
          if (geocoded) return geocoded;
        } catch (gerr) {
          console.warn('Geocoding failed for provider address', gerr);
        }
      }

      return null;
    },
    [serviceData, extractCoordsFromProfile, geocodeAddress, user]
  );

  // Prompt helper using a custom modal instead of Alert
  const confirmProceedWithoutLocation = (message) => {
    return new Promise((resolve) => {
      setConfirmModal({
        title: 'Location unavailable',
        message,
        onCancel: () => {
          setConfirmModal(null);
          resolve(false);
        },
        onConfirm: () => {
          setConfirmModal(null);
          resolve(true);
        },
      });
    });
  };

  // ── Load nearby providers ──
  useEffect(() => {
    let mounted = true;

    const loadNearbyProviders = async () => {
      const initial = originalProvidersRef.current || [];
      if (!initial || initial.length === 0) {
        if (mounted) setProvidersList([]);
        return;
      }

      let custCoords = customerCoords;
      if ((!custCoords || custCoords.lat == null || custCoords.lng == null) && defaultAddress) {
        try {
          const geo = await geocodeAddress(defaultAddress);
          if (geo) {
            custCoords = geo;
            if (mounted) setCustomerCoords(geo);
          }
        } catch (_e) {
          /* ignore */
        }
      }

      const nearby = [];

      const distanceSetting = await fetchServiceDistanceSetting(
        serviceData?.id || serviceData?.serviceId,
        'Booking provider list',
      );

      for (const p of initial) {
        const pid = typeof p === 'string' ? p : p.id || p.providerId || p.ownerId || p.uid;
        if (!pid) continue;

        let profile = null;
        try {
          profile = await fetchUserProfile(pid);
        } catch (_err) {
          profile = null;
        }

        if (!profile) {
          try {
            const projectId = app?.options?.projectId || 'mylocalforce-295b8';
            const url = `https://us-central1-${projectId}.cloudfunctions.net/getProviderPublicProfile`;
            let idToken = null;
            try {
              if (firebaseAuth?.currentUser?.getIdToken) {
                idToken = await firebaseAuth.currentUser.getIdToken();
              } else if (user?.getIdToken) {
                idToken = await user.getIdToken();
              }
            } catch (_tErr) {
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
          } catch (_pfErr) {
            /* ignore */
          }
        }

        let coords = extractCoordsFromProfile(profile);
        if (!coords) {
          try {
            coords = await resolveProviderCoords(pid);
          } catch (_err) {
            coords = null;
          }
        }

        let distanceKm = null;
        if (coords && custCoords && custCoords.lat != null && custCoords.lng != null) {
          distanceKm = getDistanceKm(custCoords.lat, custCoords.lng, coords.lat, coords.lng);
        }

        // When the service's distance limit is ON, include only providers within it; a provider
        // whose distance can't be computed is skipped to strictly satisfy the limit.
        // When the admin turned the limit OFF for this service, include every provider.
        if (distanceSetting.enabled && distanceKm == null) continue;

        if (isWithinServiceDistance(distanceKm, distanceSetting)) {
          nearby.push({
            id: pid,
            name:
              profile?.name ||
              profile?.fullName ||
              profile?.displayName ||
              (typeof p === 'object' && (p.name || p.fullName)) ||
              'Provider',
            profile,
            coords,
            distanceKm,
            ...(typeof p === 'object' ? p : {}),
          });
        }
      }

      if (mounted) {
        setProvidersList(nearby);
        if (nearby.length > 0) setSelectedProvider(nearby[0]);
      }
    };

    loadNearbyProviders();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingProviders, serviceData, customerCoords, defaultAddress]);

  // ── Load user profile on mount ──
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user?.uid) {
        try {
          const profile = await fetchUserProfile(user.uid);
          const incoming = incomingSelectedAddress || incomingAddress || null;
          if (!incoming && profile?.address) {
            setDefaultAddress(profile.address);
          }
          if (profile?.phone) setPhoneNumber(profile.phone);
          if (profile?.email) {
            setCustomerEmail(profile.email);
          } else if (user?.email) {
            setCustomerEmail(user.email);
          }
          if (profile) {
            const coords = extractCoordsFromProfile(profile);
            if (coords) setCustomerCoords({ lat: coords.lat, lng: coords.lng });
          }
        } catch (error) {
          console.log('Error loading user profile:', error);
        }
      }
    };
    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Calendar logic ──
  const getCalendarDates = () => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const calendarDates = getCalendarDates();

  const isBookingTimeValid = (date, timeString) => {
    if (!date || !timeString) return false;
    const timeParts = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!timeParts) return false;
    let hours = parseInt(timeParts[1]);
    const minutes = parseInt(timeParts[2]);
    const isPM = timeParts[3].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    const bookingDateTime = new Date(date);
    bookingDateTime.setHours(hours, minutes, 0, 0);
    const now = new Date();
    const eightHoursFromNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return bookingDateTime >= eightHoursFromNow;
  };

  const canDateHaveValidBooking = (date) => {
    const now = new Date();
    const dateAtMidnight = new Date(date);
    dateAtMidnight.setHours(0, 0, 0, 0);
    const nowAtMidnight = new Date(now);
    nowAtMidnight.setHours(0, 0, 0, 0);
    if (dateAtMidnight > nowAtMidnight) return true;
    const latestBookingTime = new Date(date);
    latestBookingTime.setHours(23, 45, 0, 0);
    const eightHoursFromNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return latestBookingTime >= eightHoursFromNow;
  };

  const getMonthDates = () =>
    calendarDates.filter(
      (d) =>
        d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()
    );

  const goToPreviousMonth = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() - 1);
    if (newMonth >= today) setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + 1);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2);
    if (newMonth <= maxDate) setCurrentMonth(newMonth);
  };

  const handleTimeSelect = (time) => {
    if (!time) return;

    if (selectedDate && !isBookingTimeValid(selectedDate, time)) {
      notify.warning('Bookings must be made at least 8 hours in advance.', {
        id: 'booking-time-window',
      });
      return;
    }

    setSelectedTime(time);
    setShowTimeModal(false);
  };

  // ── Submit booking ──
  const handleSubmitBooking = async () => {
    if (isLoading) return;

    const finalAddress = defaultAddress;

    if (!selectedDate || !selectedTime || !finalAddress || !phoneNumber) {
      notify.error('Add date, time, address, and phone to continue.', {
        id: 'booking-validation',
      });
      return;
    }

    if (!isBookingTimeValid(selectedDate, selectedTime)) {
      notify.warning('Bookings must be made at least 8 hours in advance.', {
        id: 'booking-time-window',
      });
      return;
    }

    if (!user) {
      notify.info('Sign in to continue your booking.', { id: 'booking-login-required' });
      navigate('/login');
      return;
    }

    if (!isLead && !serviceData?.ownerId && !selectedProvider) {
      notify.error('Service information is missing. Select the service again.', {
        id: 'booking-service-missing',
      });
      return;
    }

    if (!isLead && !meetsMinimumBookingAmount) {
      notify.warning(
        `Minimum booking total is ${formatAUD(minimumBookingTotal)} before Stripe charges. Add ${formatAUD(minimumOrderShortfall)} more in services to continue.`,
        { id: 'booking-minimum-total' }
      );
      return;
    }

    setIsLoading(true);

    try {
      const chosenProviderId = selectedProvider
        ? getProviderId(selectedProvider)
        : serviceData?.ownerId || serviceData?.providerId || null;
      const chosenProviderName = selectedProvider
        ? getProviderName(selectedProvider)
        : serviceData?.ownerName || 'Service Provider';

      if (!isLead) {
        // A cart can hold several services; the strictest ON setting among them applies.
        const distanceSetting = await fetchServiceDistanceSetting(
          [serviceData?.id, ...cartServiceItems.map((item) => item?.id || item?.serviceId)],
          'Booking submit',
        );

        const providerCoords = distanceSetting.enabled
          ? await resolveProviderCoords(chosenProviderId)
          : null;

        let skipDistanceCheck = !distanceSetting.enabled;
        if (distanceSetting.enabled && !providerCoords) {
          const proceed = await confirmProceedWithoutLocation(
            `Unable to verify provider location. Do you want to proceed without verifying the ${distanceSetting.limitKm} km distance?`
          );
          if (!proceed) {
            setIsLoading(false);
            return;
          }
          skipDistanceCheck = true;
        }

        const providerAlreadyValidated = routeSelectedProvider || fromProviderSelector;

        if (!skipDistanceCheck && !providerAlreadyValidated) {
          let effectiveCustomerCoords = null;
          if (customerCoords?.lat && customerCoords?.lng) {
            effectiveCustomerCoords = { lat: customerCoords.lat, lng: customerCoords.lng };
          } else {
            try {
              const geoCust = await geocodeAddress(finalAddress);
              if (geoCust) {
                effectiveCustomerCoords = { lat: geoCust.lat, lng: geoCust.lng };
                setCustomerCoords({ lat: geoCust.lat, lng: geoCust.lng });
              } else {
                notify.error(
                  'We could not confirm your location. Choose an address and try again.',
                  {
                    id: 'booking-location-unavailable',
                  }
                );
                setIsLoading(false);
                return;
              }
            } catch (_gErr) {
              notify.error('We could not confirm your location. Choose an address and try again.', {
                id: 'booking-location-unavailable',
              });
              setIsLoading(false);
              return;
            }
          }

          const distanceKm = getDistanceKm(
            effectiveCustomerCoords.lat,
            effectiveCustomerCoords.lng,
            providerCoords.lat,
            providerCoords.lng
          );
          if (!isWithinServiceDistance(distanceKm, distanceSetting)) {
            notify.warning('This provider is outside the service range. Choose another provider.', {
              id: 'booking-provider-distance',
            });
            setIsLoading(false);
            return;
          }
        }
      }

      const bookingData = {
        customerId: user.uid,
        customerName: user.fullName || user.displayName || user.name || user.email,
        customerEmail: customerEmail || user.email || null,
        customerPhone: phoneNumber,
        address: finalAddress,
        phoneNumber,
        specialInstructions,
        serviceId: cartServiceItems[0]?.id || serviceData?.id || null,
        serviceName:
          cartServiceItems.length > 1
            ? `${primaryServiceName} + ${cartServiceItems.length - 1} more`
            : primaryServiceName,
        serviceTitle: primaryServiceName,
        serviceImage: serviceData?.imageUrl || null,
        serviceDescription: serviceData?.description || null,
        category: serviceData?.category || category,
        subcategory: serviceData?.subcategory || subcategory,
        providerId: chosenProviderId,
        providerName: chosenProviderName,
        selectedDate: selectedDate.toISOString().split('T')[0],
        selectedTime,
        duration: serviceData?.duration || packageData?.duration || 'TBD',
        price: serviceBasePrice,
        serviceItems: cartServiceItems,
        serviceCount: cartServiceItems.length,
        stripeCardType: null,
        stripeCardCountry: null,
        stripeCharge: null,
        amountBeforeStripe: bookingQuote.totalBeforeStripe,
        totalAmount: bookingQuote.totalBeforeStripe,
        paymentStatus: 'pending',
        status: 'pending',
      };

      if (!isLead) {
        navigate('/customer/order-summary', {
          state: {
            bookingData,
            serviceItems: bookingData.serviceItems,
            platformSettings,
            leadId,
            leadExpectedProviderId,
          },
        });
        setIsLoading(false);
        return;
      }

      if (isLead) {
        const leadToastId = 'booking-lead-request';
        notify.loading('Sending your request to providers...', { id: leadToastId });

        const addressPayload = incomingSelectedAddress || incomingAddress || null;
        const deriveLeadArea = () => {
          if (addressPayload && typeof addressPayload === 'object') {
            const objectArea =
              addressPayload.area ||
              addressPayload.locality ||
              addressPayload.suburb ||
              addressPayload.city ||
              addressPayload.state;

            if (objectArea) return String(objectArea).trim();

            const payloadAddress = addressPayload.formattedAddress || addressPayload.address;
            if (payloadAddress) {
              const payloadParts = String(payloadAddress)
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean);

              if (payloadParts.length >= 3) return payloadParts[payloadParts.length - 2];
              if (payloadParts.length === 2) return payloadParts[1];
              if (payloadParts.length === 1) return payloadParts[0];
            }
          }

          const addressParts = String(finalAddress || '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);

          if (addressParts.length >= 3) return addressParts[addressParts.length - 2];
          if (addressParts.length === 2) return addressParts[1];
          if (addressParts.length === 1) return addressParts[0];
          return 'Area not provided';
        };

        const leadArea = deriveLeadArea();
        let leadCustomerCoords = null;

        if (customerCoords?.lat != null && customerCoords?.lng != null) {
          leadCustomerCoords = {
            lat: Number(customerCoords.lat),
            lng: Number(customerCoords.lng),
          };
        } else {
          try {
            const geocodedCustomer = await geocodeAddress(finalAddress);
            if (geocodedCustomer?.lat != null && geocodedCustomer?.lng != null) {
              leadCustomerCoords = {
                lat: Number(geocodedCustomer.lat),
                lng: Number(geocodedCustomer.lng),
              };
              setCustomerCoords(leadCustomerCoords);
            }
          } catch (geoErr) {
            console.warn(
              'Could not geocode customer location for lead:',
              geoErr?.message || geoErr
            );
          }
        }

        const leadData = {
          status: 'lead',
          customerId: user.uid,
          customerName: bookingData.customerName || user.email || null,
          customerEmail: bookingData.customerEmail || user.email || null,
          customerPhone: phoneNumber,
          address: finalAddress,
          leadArea,
          specialInstructions,
          serviceDetails:
            specialInstructions ||
            bookingData.serviceDescription ||
            bookingData.serviceName ||
            'Not provided',
          serviceId: serviceData?.id || null,
          serviceName: bookingData.serviceName,
          leadCategory: bookingData.category,
          leadSubcategory: bookingData.subcategory,
          category: bookingData.category,
          subcategory: bookingData.subcategory,
          requestedDate: bookingData.selectedDate,
          requestedTime: bookingData.selectedTime,
          duration: bookingData.duration,
          price: bookingData.price,
          ...(leadCustomerCoords
            ? {
                customerLocation: {
                  latitude: leadCustomerCoords.lat,
                  longitude: leadCustomerCoords.lng,
                },
                location: {
                  latitude: leadCustomerCoords.lat,
                  longitude: leadCustomerCoords.lng,
                },
              }
            : {}),
          createdAt: serverTimestamp(),
        };

        const leadsRef = collection(firestore, 'leads');
        const leadRef = await addDoc(leadsRef, leadData);

        try {
          const broadcastResponse = await fetch(
            'https://us-central1-mylocalforce-295b8.cloudfunctions.net/broadcastLeadToProviders',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leadId: leadRef.id,
                category: bookingData.category,
                subcategory: bookingData.subcategory,
                price: bookingData.price,
                serviceName: bookingData.serviceName,
                customerName: leadData.customerName,
                customerAddress: leadData.address,
                customerLocation: leadData.customerLocation || null,
              }),
            }
          );
          const broadcastResult = await broadcastResponse.json();

          if (broadcastResult.success) {
            notify.success(
              'Your lead is saved. When a provider is available, we will let you know.',
              { id: leadToastId }
            );
          } else {
            notify.info('Your lead is saved. Providers will be notified.', {
              id: leadToastId,
            });
          }

          navigate(-1);
          setIsLoading(false);
          return;
        } catch (_broadcastErr) {
          // Fallback notification
          try {
            const servicesRef = collection(firestore, 'services');
            let q = query(
              servicesRef,
              where('category', '==', String(bookingData.category)),
              where('subcategory', '==', String(bookingData.subcategory))
            );
            let snap = await getDocs(q);

            if (snap.size === 0) {
              q = query(servicesRef, where('category', '==', String(bookingData.category)));
              snap = await getDocs(q);
            }

            const providerIds = new Set();
            snap.forEach((sdoc) => {
              const s = sdoc.data();
              if (s.providers && Array.isArray(s.providers)) {
                s.providers.forEach((p) => providerIds.add(p));
              }
              if (s.ownerId) providerIds.add(s.ownerId);
              if (s.providerId) providerIds.add(s.providerId);
            });

            if (
              providerIds.size === 0 &&
              serviceData &&
              Array.isArray(serviceData.providers) &&
              serviceData.providers.length > 0
            ) {
              serviceData.providers.forEach((p) => providerIds.add(p));
            }

            const notifiedProviderIds = Array.from(providerIds);
            try {
              await updateDoc(doc(firestore, 'leads', leadRef.id), { notifiedProviderIds });
            } catch (_uErr) {
              /* ignore */
            }

            let notified = 0;
            for (const pid of providerIds) {
              try {
                const notification = {
                  title: 'New Lead Available',
                  body: `${leadData.subcategory} requested — ${leadData.price ? `$${leadData.price}` : 'Price on request'}`,
                  data: {
                    type: 'NEW_LEAD',
                    leadId: leadRef.id,
                    category: leadData.category,
                    subcategory: leadData.subcategory,
                    price: leadData.price,
                    role: 'provider',
                  },
                };
                await saveNotificationToFirestore(pid, notification);
                await sendPushNotification(pid, notification);
                notified++;
              } catch (_nerr) {
                /* ignore */
              }
            }
            notify.success(`Request saved and notified ${notified} providers.`, {
              id: leadToastId,
            });
          } catch (_sErr) {
            notify.warning('Request saved, but provider notification failed.', {
              id: leadToastId,
            });
          }

          navigate(-1);
          setIsLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      notify.error(getUserFacingError(error, 'Could not start payment. Please try again.'), {
        id: isLead ? 'booking-lead-request' : 'booking-payment-session',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Calendar rendering helpers ──
  const renderCalendar = () => {
    const monthDates = getMonthDates();
    const monthName = currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const weeks = [];
    let currentWeek = [];
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startDay = firstDayOfMonth.getDay();

    for (let i = 0; i < startDay; i++) currentWeek.push(null);

    monthDates.forEach((date) => {
      currentWeek.push(date);
      if (currentWeek.length === 7) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2);

    return (
      <div className="mb-4 sm:mb-6">
        <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">Select Date</h3>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3 sm:mb-4 px-1 sm:px-2">
          <button
            onClick={goToPreviousMonth}
            disabled={currentMonth <= today}
            className="p-1.5 sm:p-2 disabled:opacity-30"
          >
            <FiChevronLeft
              className={`w-5 h-5 sm:w-6 sm:h-6 ${currentMonth <= today ? 'text-slate-400' : 'text-indigo-500'}`}
            />
          </button>
          <span className="text-base sm:text-lg font-bold text-slate-800">{monthName}</span>
          <button
            onClick={goToNextMonth}
            disabled={currentMonth >= maxDate}
            className="p-1.5 sm:p-2 disabled:opacity-30"
          >
            <FiChevronRight
              className={`w-5 h-5 sm:w-6 sm:h-6 ${currentMonth >= maxDate ? 'text-slate-400' : 'text-indigo-500'}`}
            />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1.5 sm:mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="text-center text-[10px] sm:text-xs font-semibold text-slate-400"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="bg-white rounded-xl p-0.5 sm:p-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {week.map((date, dayIndex) => {
                if (!date) {
                  return <div key={dayIndex} className="aspect-square" />;
                }

                const isToday = date.toDateString() === today.toDateString();
                const isSelected =
                  selectedDate && date.toDateString() === selectedDate.toDateString();
                const isPast = date < today;
                const canBook = canDateHaveValidBooking(date);
                const isDisabled = isPast || !canBook;

                return (
                  <button
                    key={dayIndex}
                    onClick={() => {
                      if (!isDisabled) {
                        setSelectedDate(date);
                        setSelectedTime('');
                      }
                    }}
                    disabled={isDisabled}
                    className={`
                      aspect-square flex items-center justify-center rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-colors
                      ${isSelected ? 'bg-indigo-500 text-white font-bold' : ''}
                      ${isDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-indigo-50 cursor-pointer'}
                      ${isToday && !isSelected ? 'border-2 border-indigo-500 text-indigo-500 font-bold' : ''}
                      ${!isSelected && !isDisabled && !isToday ? 'text-slate-800' : ''}
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Provider selector ──
  const renderProviderSelector = () => {
    if (!providersList || providersList.length <= 1) return null;

    return (
      <div className="mb-4 sm:mb-6">
        <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
          Choose Provider
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {providersList.map((p, idx) => {
            const providerObject = typeof p === 'string' ? null : p;
            const pid = getProviderId(p) || idx;
            const displayName =
              getProviderName(providerObject, null) ||
              providerObject?.profile?.name ||
              providerObject?.profile?.fullName ||
              providerObject?.profile?.displayName ||
              'Provider';
            const subtitle =
              providerObject?.formattedAddress ||
              providerObject?.address ||
              providerObject?.city ||
              providerObject?.profile?.city ||
              '';
            const distText =
              providerObject?.distanceKm != null
                ? `${providerObject.distanceKm.toFixed(1)} km`
                : null;
            const avatar =
              providerObject?.profile?.photoURL ||
              providerObject?.profile?.avatar ||
              providerObject?.profile?.photo ||
              providerObject?.photoURL ||
              providerObject?.imageUrl ||
              null;
            const rating =
              providerObject?.profile?.rating ||
              providerObject?.profile?.avgRating ||
              providerObject?.profile?.ratingAvg ||
              providerObject?.rating ||
              providerObject?.avgRating ||
              null;
            const selectedId = getProviderId(selectedProvider);
            const isSelected = selectedId
              ? selectedId === pid
              : idx === 0 && selectedProvider == null;

            return (
              <button
                key={pid}
                onClick={() => setSelectedProvider(p)}
                className={`
                w-full text-left bg-white rounded-xl border p-3 sm:p-4 transition-colors
                ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}
              `}
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={displayName}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover bg-slate-100"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                      {displayName}
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 flex-wrap">
                      {subtitle && (
                        <span className="text-[10px] sm:text-xs text-slate-400 truncate max-w-30 sm:max-w-none">
                          {subtitle}
                        </span>
                      )}
                      {rating != null && (
                        <span className="text-[10px] sm:text-xs text-slate-400">
                          ★ {Number(rating).toFixed(1)}
                        </span>
                      )}
                      {distText && (
                        <span className="text-[10px] sm:text-xs text-slate-400">{distText}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Render ──
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 mx-auto max-w-sm w-full shadow-xl">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-2">
              {confirmModal.title}
            </h3>
            <p className="text-sm text-slate-600 mb-5 sm:mb-6">{confirmModal.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={confirmModal.onCancel}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-lg bg-indigo-500 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <FiArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-slate-800" />
        </button>
        <h1 className="text-base sm:text-lg font-bold text-slate-800">Book Service</h1>
        <div className="w-9 sm:w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl">
          {/* Service Summary Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 my-4 sm:my-6 shadow-md">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <FiCalendar className="w-5 h-5 text-indigo-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-800">Service Details</h2>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              {serviceData?.imageUrl && (
                <img
                  src={serviceData.imageUrl}
                  alt="Service"
                  className="w-full h-32 sm:h-40 md:h-48 rounded-xl mb-3 sm:mb-4"
                  style={{
                    objectFit: serviceData.imageFit || 'cover',
                    objectPosition: `${serviceData.imagePositionX ?? 50}% ${serviceData.imagePositionY ?? 50}%`,
                  }}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {(serviceData?.name || serviceData?.title) && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5 items-center sm:items-start">
                    <span className="text-xs sm:text-sm text-slate-400">Service:</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 text-right sm:text-left">
                      {primaryServiceName}
                    </span>
                  </div>
                )}

                <div className="flex justify-between sm:flex-col sm:gap-0.5 items-center sm:items-start">
                  <span className="text-xs sm:text-sm text-slate-400">Category:</span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-800 text-right sm:text-left">
                    {serviceData?.category || category}
                  </span>
                </div>

                {(serviceData?.subcategory || subcategory) && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5 items-center sm:items-start">
                    <span className="text-xs sm:text-sm text-slate-400">Subcategory:</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 text-right sm:text-left">
                      {serviceData?.subcategory || subcategory}
                    </span>
                  </div>
                )}

                {providersList && providersList.length > 0 && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5 items-center sm:items-start">
                    <span className="text-xs sm:text-sm text-slate-400">Provider:</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 text-right sm:text-left">
                      {selectedProvider
                        ? selectedProvider.name ||
                          selectedProvider.ownerName ||
                          selectedProvider.fullName
                        : serviceData?.ownerName || 'Service Provider'}
                    </span>
                  </div>
                )}

                {(serviceData?.price != null || packageData?.price) && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5 items-center sm:items-start">
                    <span className="text-xs sm:text-sm text-slate-400">Services Total:</span>
                    <span className="text-sm sm:text-base font-bold text-indigo-500">
                      {formatAUD(bookingQuote.serviceTotal)}
                    </span>
                  </div>
                )}

                {cartServiceItems.length > 0 && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5 items-center sm:items-start">
                    <span className="text-xs sm:text-sm text-slate-400">Items:</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 text-right sm:text-left">
                      {totalSelectedServiceCount}
                    </span>
                  </div>
                )}

                {(serviceData?.duration || packageData?.duration) && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5 items-center sm:items-start">
                    <span className="text-xs sm:text-sm text-slate-400">Duration:</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 text-right sm:text-left">
                      {serviceData?.duration || packageData?.duration}
                    </span>
                  </div>
                )}
              </div>

              {serviceData?.description && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-xs sm:text-sm text-slate-400">Description:</span>
                  <p className="text-xs sm:text-sm text-slate-800 leading-5 mt-1">
                    {serviceData.description}
                  </p>
                </div>
              )}

              {cartServiceItems.length > 1 && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-xs sm:text-sm text-slate-400">Selected Services:</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cartServiceItems.map((item) => (
                      <span
                        key={getServiceIdentity(item)}
                        className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600"
                      >
                        {item.quantity} x {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Provider Selector */}
          {renderProviderSelector()}

          {!isLead && selectedProviderId && (
            <div className="mb-4 sm:mb-6 rounded-2xl bg-white p-4 sm:p-6 shadow-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">
                    Add More Services
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500">
                    {meetsMinimumBookingAmount
                      ? `Add more services from ${selectedProviderName} if you want to build your cart.`
                      : `Minimum booking total is ${formatAUD(minimumBookingTotal)} before Stripe charges. Add ${formatAUD(minimumOrderShortfall)} more from ${selectedProviderName} to continue.`}
                  </p>
                </div>
                {!meetsMinimumBookingAmount && (
                  <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                    Min A$50
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm text-slate-500">Services Total</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {formatAUD(bookingQuote.serviceTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm text-slate-500">
                    Platform Fee ({bookingQuote.platformFee.label})
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {formatAUD(bookingQuote.platformFee.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm text-slate-500">Total Before Stripe</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {formatAUD(bookingQuote.totalBeforeStripe)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm text-slate-500">Services In Cart</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    {totalSelectedServiceCount}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                {providerServicesLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                    Loading provider services...
                  </div>
                ) : availableProviderServices.length > 0 ? (
                  <div className="space-y-3">
                    {availableProviderServices.map((service) => {
                      const serviceId = getServiceIdentity(service);
                      const quantity = serviceQuantityMap.get(serviceId) || 0;
                      const canDecrease = quantity > (serviceId === primaryServiceItemId ? 1 : 0);
                      const subtitle = [service.category, service.subcategory, service.duration]
                        .filter(Boolean)
                        .join(' • ');

                      return (
                        <div
                          key={serviceId}
                          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-bold text-slate-800">{service.name}</p>
                              {service.isPrimary && (
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                                  Included
                                </span>
                              )}
                            </div>
                            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
                            {service.description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                                {service.description}
                              </p>
                            )}
                            <p className="mt-2 text-sm font-bold text-indigo-500">
                              {formatAUD(service.price)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center justify-end">
                            {quantity > 0 ? (
                              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                <button
                                  type="button"
                                  onClick={() => updateServiceQuantity(service, -1)}
                                  disabled={!canDecrease}
                                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                                    canDecrease
                                      ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  }`}
                                >
                                  <FiMinus size={16} />
                                </button>
                                <span className="min-w-6 text-center text-sm font-bold text-slate-800">
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateServiceQuantity(service, 1)}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-indigo-600 transition-colors hover:bg-indigo-50"
                                >
                                  <FiPlus size={16} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => updateServiceQuantity(service, 1)}
                                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-600"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                    No additional active services found for this provider.
                  </div>
                )}

                {providerServicesError && (
                  <p className="mt-3 text-xs font-semibold text-red-500">{providerServicesError}</p>
                )}
              </div>
            </div>
          )}

          {/* Date Selection */}
          {renderCalendar()}

          {/* Time Selection */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              Select Time
            </h3>

            <button
              type="button"
              onClick={() => setShowTimeModal(true)}
              className="w-full flex items-center gap-2.5 sm:gap-3 bg-white rounded-xl border border-slate-200 p-3 sm:p-4 hover:border-slate-300 transition-colors"
            >
              <FiClock className="w-5 h-5 text-indigo-500" />
              <span
                className={`flex-1 text-left text-sm sm:text-base ${selectedTime ? 'text-slate-800' : 'text-slate-400'}`}
              >
                {selectedTime || 'Choose a time'}
              </span>
              <FiChevronDown className="w-5 h-5 text-slate-400" />
            </button>

            {showTimeModal && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
                <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200">
                    <h4 className="text-base sm:text-lg font-bold text-slate-800">Select Time</h4>
                    <button
                      type="button"
                      onClick={() => setShowTimeModal(false)}
                      className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
                    >
                      <FiChevronDown className="w-5 h-5 text-slate-700 rotate-180" />
                    </button>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6">
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                      {TIME_SLOTS.map((time) => {
                        const isActive = selectedTime === time;
                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => handleTimeSelect(time)}
                            className={`rounded-lg border px-2 py-3 text-sm font-semibold transition-colors ${
                              isActive
                                ? 'bg-indigo-500 border-indigo-500 text-white'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200'
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Address Section */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              Service Address
            </h3>
            {defaultAddress ? (
              <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  <FiHome className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                  <span className="text-xs sm:text-sm font-semibold text-indigo-500">
                    Selected Address
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-800 leading-5 wrap-break-word">
                  {defaultAddress}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-slate-800">
                  No address selected. Please choose an address from the Address screen before
                  booking.
                </p>
              </div>
            )}
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 mb-4 sm:mb-6">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              <div className="flex items-center">
                <span className="text-xs sm:text-sm text-slate-400 pr-2">Phone:</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-800 break-all">
                  {phoneNumber || 'Not set'}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-xs sm:text-sm text-slate-400 pr-2">Email:</span>
                <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  {customerEmail || 'Not set'}
                </span>
              </div>
            </div>
            <p className="mt-2.5 sm:mt-3 text-[10px] sm:text-xs text-slate-400 italic">
              * All notifications and service-related information will be sent to your registered
              email and phone number.
            </p>
          </div>

          {/* Special Instructions */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-3 sm:mb-4">
              Special Instructions
            </h3>
            <textarea
              className="w-full bg-white rounded-xl border border-slate-200 p-3 sm:p-4 text-xs sm:text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Any special requirements or instructions"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={3}
            />
          </div>

          {isLead && (
            <div className="mb-4 sm:mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs sm:text-sm text-amber-900">
              Minimum booking total applies when a provider accepts and the booking is confirmed.
            </div>
          )}

          {!isLead && !meetsMinimumBookingAmount && (
            <div className="mb-4 sm:mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs sm:text-sm text-amber-900">
              Add {formatAUD(minimumOrderShortfall)} more in services to reach the minimum booking
              total of {formatAUD(minimumBookingTotal)}.
            </div>
          )}

          {/* Book Button */}
          <button
            onClick={handleSubmitBooking}
            disabled={isLoading || (!isLead && !meetsMinimumBookingAmount)}
            className={`
            w-full sm:w-auto sm:min-w-70 sm:mx-auto flex items-center justify-center py-3 sm:py-4 rounded-2xl mt-4 sm:mt-6 font-bold text-sm sm:text-base text-white shadow-md transition-colors
            ${isLoading || (!isLead && !meetsMinimumBookingAmount) ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600 cursor-pointer'}
          `}
          >
            {isLoading ? 'Processing...' : isLead ? 'Save Lead Request' : 'Review Cart'}
          </button>

          {/* Bottom spacer */}
          <div className="h-6 sm:h-8" />
        </div>
      </div>
    </div>
  );
};

export default BookingScreen;
