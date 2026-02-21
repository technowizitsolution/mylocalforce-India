import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiHome,
  FiInfo,
  FiCopy,
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { createBooking, fetchUserProfile } from '../../services/firebase';
import app, { auth as firebaseAuth, firestore } from '../../services/firebase/firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { saveNotificationToFirestore, sendPushNotification } from '../../services/firebase/notificationService';
import { createCheckoutSession } from '../../services/firebase/stripeService';

// NOTE: geocoding fallback uses the Google Geocoding API. Ensure this key has Geocoding enabled.
const GOOGLE_GEOCODING_API_KEY = 'AIzaSyBfeBvLPaPSEyHpwuqcUXCa-YJnZ3iJu1Q';

// Generate time slots in 15-minute intervals
const generateTimeSlots = () => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hours12 = h % 12 || 12;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const minutesStr = m < 10 ? '0' + m : m;
      slots.push(`${hours12}:${minutesStr} ${ampm}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

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
  } = location.state || {};

  // Debug: Log what data we received
  console.log('📋 BookingScreen received params:');
  console.log('  category:', category);
  console.log('  subcategory:', subcategory);
  console.log('  packageData:', packageData);
  console.log('  serviceData:', serviceData);
  if (serviceData) {
    console.log('  serviceData.price:', serviceData.price);
    console.log('  serviceData.name:', serviceData.name);
    console.log('  serviceData.title:', serviceData.title);
  }

  // Date and Time states
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
  const originalProvidersRef = useRef(
    incomingProviders || serviceData?.providers || []
  );

  // Confirmation modal state (replaces Alert)
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    if (providersList && providersList.length > 0) {
      setSelectedProvider(providersList[0]);
    }
  }, [providersList]);

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
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
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
          if (lat != null && lng != null)
            return { lat: Number(lat), lng: Number(lng) };
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
            err?.code === 'permission-denied' ||
            /permission|insufficient permissions/i.test(msg);
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

      for (const p of initial) {
        const pid =
          typeof p === 'string'
            ? p
            : p.id || p.providerId || p.ownerId || p.uid;
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

        if (distanceKm == null) continue;

        if (distanceKm <= 20) {
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
        d.getMonth() === currentMonth.getMonth() &&
        d.getFullYear() === currentMonth.getFullYear()
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
    if (selectedDate && !isBookingTimeValid(selectedDate, time)) {
      alert('Bookings must be made at least 8 hours in advance. Please select a different time or date.');
      return;
    }
    setSelectedTime(time);
    setShowTimePicker(false);
  };

  // ── Submit booking ──
  const handleSubmitBooking = async () => {
    if (isLoading) return;

    const finalAddress = defaultAddress;

    if (!selectedDate || !selectedTime || !finalAddress || !phoneNumber) {
      alert('Please fill in all required fields (date, time, address, phone).');
      return;
    }

    if (!isBookingTimeValid(selectedDate, selectedTime)) {
      alert('Bookings must be made at least 8 hours in advance. Please select a different date or time.');
      return;
    }

    if (!user) {
      alert('Please log in to make a booking.');
      navigate('/login');
      return;
    }

    if (!serviceData?.ownerId && !selectedProvider) {
      alert('Service information missing. Please try selecting the service again.');
      return;
    }

    setIsLoading(true);

    try {
      const chosenProviderId = selectedProvider
        ? selectedProvider.id || selectedProvider.providerId || selectedProvider.ownerId || selectedProvider.uid
        : serviceData?.ownerId || serviceData?.providerId || null;
      const chosenProviderName = selectedProvider
        ? selectedProvider.name || selectedProvider.fullName || selectedProvider.ownerName || 'Service Provider'
        : serviceData?.ownerName || 'Service Provider';

      const providerCoords = await resolveProviderCoords(chosenProviderId);

      let skipDistanceCheck = false;
      if (!providerCoords) {
        const proceed = await confirmProceedWithoutLocation(
          'Unable to verify provider location. Do you want to proceed without verifying the 20 km distance?'
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
              alert('Your location is unavailable. Please set your address in your profile.');
              setIsLoading(false);
              return;
            }
          } catch (_gErr) {
            alert('Your location is unavailable. Please set your address in your profile.');
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
        if (distanceKm > 20) {
          alert('This provider is more than 20 km away. Booking is only allowed within 20 km.');
          setIsLoading(false);
          return;
        }
      }

      const bookingData = {
        customerId: user.uid,
        customerName: user.name || user.email,
        customerEmail: user.email,
        customerPhone: phoneNumber,
        address: finalAddress,
        phoneNumber,
        specialInstructions,
        serviceId: serviceData?.id || null,
        serviceName: serviceData?.name || serviceData?.title || serviceData?.serviceName || subcategory,
        serviceTitle: serviceData?.title || serviceData?.name || subcategory,
        serviceImage: serviceData?.imageUrl || null,
        serviceDescription: serviceData?.description || null,
        category: serviceData?.category || category,
        subcategory: serviceData?.subcategory || subcategory,
        providerId: chosenProviderId,
        providerName: chosenProviderName,
        selectedDate: selectedDate.toISOString().split('T')[0],
        selectedTime,
        duration: serviceData?.duration || packageData?.duration || 'TBD',
        price: (() => {
          if (serviceData?.price != null && typeof serviceData.price === 'number') return serviceData.price;
          if (packageData?.price) {
            const parsed = parseFloat(String(packageData.price).replace(/[^0-9.]/g, ''));
            return !isNaN(parsed) && parsed >= 0 ? parsed : 50;
          }
          return 50;
        })(),
        paymentStatus: 'pending',
        status: 'pending',
      };

      if (!isLead) {
        const bookingId = await createBooking(user.uid, bookingData);
        console.log('Booking created with ID:', bookingId);

        const stripeSessionData = {
          bookingId,
          customerId: user.uid,
          customerEmail: user.email,
          providerId: bookingData.providerId,
          serviceName: bookingData.serviceName,
          price: bookingData.price,
          description: `${bookingData.serviceName} - ${bookingData.selectedDate} at ${selectedTime}`,
        };

        const checkoutSession = await createCheckoutSession(stripeSessionData);
        console.log('Checkout session created:', checkoutSession.sessionId);

        window.location.href = checkoutSession.url;
        alert('You will be redirected to Stripe to complete your payment.');
      }

      if (isLead) {
        const leadData = {
          status: 'lead',
          customerId: user.uid,
          customerName: user.name || user.email || null,
          customerEmail: user.email || null,
          customerPhone: phoneNumber,
          address: finalAddress,
          specialInstructions,
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
              }),
            }
          );
          const broadcastResult = await broadcastResponse.json();

          if (broadcastResult.success) {
            alert(
              `Your request has been sent to ${broadcastResult.notifiedCount} providers. They will receive email, SMS and app notifications.`
            );
          } else {
            alert('Your request has been saved. Providers will be notified.');
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
            alert(`Lead saved and notified ${notified} providers.`);
          } catch (_sErr) {
            alert('Lead saved, but failed to notify providers.');
          }

          navigate(-1);
          setIsLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Sorry, there was an error processing your booking. Please try again.');
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
    const firstDayOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );
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
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-800 mb-4">Select Date</h3>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4 px-2">
          <button
            onClick={goToPreviousMonth}
            disabled={currentMonth <= today}
            className="p-2 disabled:opacity-30"
          >
            <FiChevronLeft
              size={24}
              className={currentMonth <= today ? 'text-slate-400' : 'text-indigo-500'}
            />
          </button>
          <span className="text-lg font-bold text-slate-800">{monthName}</span>
          <button
            onClick={goToNextMonth}
            disabled={currentMonth >= maxDate}
            className="p-2 disabled:opacity-30"
          >
            <FiChevronRight
              size={24}
              className={currentMonth >= maxDate ? 'text-slate-400' : 'text-indigo-500'}
            />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="bg-white rounded-xl p-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-0.5">
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
                      aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-colors
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
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-800 mb-4">Choose Provider</h3>
        {providersList.map((p, idx) => {
          const pid = p.id || p.providerId || p.ownerId || p.uid || idx;
          const displayName =
            p.name ||
            p.fullName ||
            p.ownerName ||
            p.profile?.name ||
            p.profile?.fullName ||
            p.profile?.displayName ||
            'Provider';
          const subtitle =
            p.formattedAddress || p.address || p.city || p.profile?.city || '';
          const distText =
            p.distanceKm != null ? `${p.distanceKm.toFixed(1)} km` : null;
          const avatar =
            p.profile?.photoURL ||
            p.profile?.avatar ||
            p.profile?.photo ||
            p.photoURL ||
            p.imageUrl ||
            null;
          const rating =
            p.profile?.rating ||
            p.profile?.avgRating ||
            p.profile?.ratingAvg ||
            p.rating ||
            p.avgRating ||
            null;
          const selectedId =
            selectedProvider &&
            (selectedProvider.id ||
              selectedProvider.providerId ||
              selectedProvider.ownerId ||
              selectedProvider.uid);
          const isSelected = selectedId
            ? selectedId === pid
            : idx === 0 && selectedProvider == null;

          return (
            <button
              key={pid}
              onClick={() => setSelectedProvider(p)}
              className={`
                w-full text-left bg-white rounded-xl border p-4 mb-2 transition-colors
                ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}
              `}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="w-12 h-12 rounded-full object-cover bg-slate-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-200" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {subtitle && (
                      <span className="text-xs text-slate-400">{subtitle}</span>
                    )}
                    {rating != null && (
                      <span className="text-xs text-slate-400">
                        ★ {Number(rating).toFixed(1)}
                      </span>
                    )}
                    {distText && (
                      <span className="text-xs text-slate-400">{distText}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // ── Render ──
  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-slate-600 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={confirmModal.onCancel}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-lg bg-indigo-500 text-sm font-medium text-white hover:bg-indigo-600"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
        >
          <FiArrowLeft size={24} className="text-slate-800" />
        </button>
        <h1 className="text-lg font-bold text-slate-800">Book Service</h1>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6">
        {/* Service Summary Card */}
        <div className="bg-white rounded-2xl p-6 my-6 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <FiCalendar size={20} className="text-indigo-500" />
            <h2 className="text-base font-bold text-slate-800">Service Details</h2>
          </div>

          <div className="space-y-3">
            {serviceData?.imageUrl && (
              <img
                src={serviceData.imageUrl}
                alt="Service"
                className="w-full h-40 object-cover rounded-xl mb-4"
              />
            )}

            {(serviceData?.name || serviceData?.title) && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Service:</span>
                <span className="text-sm font-semibold text-slate-800">
                  {serviceData.name || serviceData.title}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Category:</span>
              <span className="text-sm font-semibold text-slate-800">
                {serviceData?.category || category}
              </span>
            </div>

            {(serviceData?.subcategory || subcategory) && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Subcategory:</span>
                <span className="text-sm font-semibold text-slate-800">
                  {serviceData?.subcategory || subcategory}
                </span>
              </div>
            )}

            {serviceData?.description && (
              <div className="mt-2">
                <span className="text-sm text-slate-400">Description:</span>
                <p className="text-sm text-slate-800 leading-5 mt-1">
                  {serviceData.description}
                </p>
              </div>
            )}

            {providersList && providersList.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Provider:</span>
                <span className="text-sm font-semibold text-slate-800">
                  {selectedProvider
                    ? selectedProvider.name ||
                      selectedProvider.ownerName ||
                      selectedProvider.fullName
                    : serviceData?.ownerName || 'Service Provider'}
                </span>
              </div>
            )}

            {(serviceData?.price != null || packageData?.price) && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Price:</span>
                <span className="text-base font-bold text-indigo-500">
                  {serviceData?.price != null
                    ? serviceData.price
                    : packageData?.price || '50'}
                </span>
              </div>
            )}

            {(serviceData?.duration || packageData?.duration) && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Duration:</span>
                <span className="text-sm font-semibold text-slate-800">
                  {serviceData?.duration || packageData?.duration}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Provider Selector */}
        {renderProviderSelector()}

        {/* Date Selection */}
        {renderCalendar()}

        {/* Time Selection */}
        <div className="mb-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Select Time</h3>

          <button
            onClick={() => setShowTimePicker(!showTimePicker)}
            className="w-full flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors"
          >
            <FiClock size={20} className="text-indigo-500" />
            <span className={`flex-1 text-left text-base ${selectedTime ? 'text-slate-800' : 'text-slate-400'}`}>
              {selectedTime || 'Choose a time'}
            </span>
            <FiChevronDown
              size={20}
              className={`text-slate-400 transition-transform ${showTimePicker ? 'rotate-180' : ''}`}
            />
          </button>

          {showTimePicker && (
            <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-lg max-h-60 overflow-y-auto">
              {TIME_SLOTS.map((time) => {
                const isActive = selectedTime === time;
                return (
                  <button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    className={`
                      w-full text-left px-4 py-2.5 text-sm transition-colors
                      ${isActive ? 'bg-indigo-500 text-white font-semibold' : 'text-slate-700 hover:bg-indigo-50'}
                    `}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Address Section */}
        <div className="mb-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">Service Address</h3>
          {defaultAddress ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FiHome size={20} className="text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-500">
                  Selected Address
                </span>
              </div>
              <p className="text-sm text-slate-800 leading-5">{defaultAddress}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-800">
                No address selected. Please choose an address from the Address screen
                before booking.
              </p>
            </div>
          )}
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">
            Contact Information
          </h3>
          <div className="flex items-center mb-1">
            <span className="text-sm text-slate-400 pr-2">Phone:</span>
            <span className="text-sm font-semibold text-slate-800">
              {phoneNumber || 'Not set'}
            </span>
          </div>
          <div className="flex items-center mb-1">
            <span className="text-sm text-slate-400 pr-2">Email:</span>
            <span className="text-sm font-semibold text-slate-800">
              {customerEmail || 'Not set'}
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-400 italic">
            * All notifications and service-related information will be sent to your
            registered email and phone number.
          </p>
        </div>

        {/* Special Instructions */}
        <div className="mb-6">
          <h3 className="text-base font-bold text-slate-800 mb-4">
            Special Instructions
          </h3>
          <textarea
            className="w-full bg-white rounded-xl border border-slate-200 p-4 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Any special requirements or instructions"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={3}
          />
        </div>

        {/* Test Payment Card */}
        <div className="bg-amber-50 rounded-2xl border border-amber-300 p-4 mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FiInfo size={16} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-800">
              Test Mode - No Real Charges
            </span>
          </div>

          {/* Credit Card UI */}
          <div className="bg-[#1e3a5f] rounded-xl p-4 mb-4 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <div className="w-10 h-7 bg-yellow-600 rounded" />
              <span className="text-xl font-bold text-white italic tracking-widest">
                VISA
              </span>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText('4242424242424242');
                alert('Card number copied to clipboard!');
              }}
              className="w-full flex items-center justify-between bg-white/10 rounded-md py-2 px-3 mb-6 hover:bg-white/20 transition-colors"
            >
              <span className="text-[15px] font-semibold text-white tracking-wider font-mono">
                4242 4242 4242 4242
              </span>
              <div className="bg-white/20 rounded p-1.5">
                <FiCopy size={14} className="text-white" />
              </div>
            </button>

            <div className="flex justify-between">
              <div className="flex-1">
                <p className="text-[8px] text-slate-400 tracking-widest mb-0.5">
                  EXPIRY
                </p>
                <p className="text-xs text-white font-semibold tracking-wider">
                  12/28
                </p>
              </div>
              <div className="flex-1">
                <p className="text-[8px] text-slate-400 tracking-widest mb-0.5">
                  CVC
                </p>
                <p className="text-xs text-white font-semibold tracking-wider">
                  123
                </p>
              </div>
              <div className="flex-1">
                <p className="text-[8px] text-slate-400 tracking-widest mb-0.5">
                  NAME
                </p>
                <p className="text-xs text-white font-semibold tracking-wider">
                  TEST USER
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs font-semibold text-amber-800 text-center bg-amber-100 py-2 px-4 rounded-lg">
            ⚠️ Use the card details above for testing. No real money will be charged.
          </p>
        </div>

        {/* Book Button */}
        <button
          onClick={handleSubmitBooking}
          disabled={isLoading}
          className={`
            w-full flex items-center justify-center py-4 rounded-2xl mt-6 font-bold text-base text-white shadow-md transition-colors
            ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600 cursor-pointer'}
          `}
        >
          {isLoading ? 'Processing...' : 'Continue to Payment'}
        </button>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default BookingScreen;
