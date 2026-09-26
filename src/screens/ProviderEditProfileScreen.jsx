import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiLoader, FiMapPin } from 'react-icons/fi';
import { doc, setDoc } from 'firebase/firestore';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { fetchProviderDetails, fetchUserProfile } from '../services/firebase';
import { firestore } from '../services/firebase/firebaseConfig';
import { updateProviderDetails } from '../services/firebase/providerOnboardingService';
import { fetchAutocompleteSuggestions, geocodeAddress } from '../utils/googleMaps';
import { EXPERIENCE_TUPLES } from '../utils/helpers';
import { notify } from '../utils/toast';
import { formatLocalDateYMD } from '../utils/helpers';

const ProviderEditProfileScreen = () => {
  const { user, refreshUserData } = useAuth();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    gender: '',
    experience: '',
    about: '',
    nationalityStatus: '',
    dob: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressMeta, setAddressMeta] = useState({ lat: null, lng: null });
  const selectingAddressRef = useRef(false);
  const addressDebounceRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const [profile, details] = await Promise.all([
          fetchUserProfile(user.uid).catch(() => null),
          fetchProviderDetails(user.uid).catch(() => null),
        ]);
        if (mounted) {
          const rawExperience =
            profile?.experience ??
            profile?.profile?.experience ??
            details?.profile?.experience ??
            details?.experience ??
            '';
          const resolvedExp = rawExperience != null ? String(rawExperience).trim() : '';
          const numericMatch = resolvedExp.match(/^(\d+)/);
          const matchedOption = numericMatch && EXPERIENCE_TUPLES.find((opt) => opt[0] === numericMatch[1]);
          const finalExpValue = matchedOption ? matchedOption[0] : resolvedExp;

          setForm({
            name: profile?.name || profile?.fullName || '',
            phone: profile?.phone || profile?.phoneNumber || '',
            address: profile?.address || profile?.profile?.address || details?.profile?.address || '',
            gender: profile?.gender || details?.profile?.preferredGender || '',
            experience: finalExpValue,
            about: profile?.about || profile?.bio || details?.profile?.about || '',
            nationalityStatus:
              profile?.nationalityStatus || profile?.profile?.nationalityStatus || details?.profile?.nationalityStatus || '',
            dob: normalizeDateInput(profile?.dob || profile?.profile?.dob),
          });
          setAddressMeta({
            lat:
              profile?.latitude ??
              profile?.lat ??
              profile?.coords?.lat ??
              profile?.location?.latitude ??
              null,
            lng:
              profile?.longitude ??
              profile?.lng ??
              profile?.coords?.lng ??
              profile?.location?.longitude ??
              null,
          });
        }
      } catch (error) {
        notify.error('Failed to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (user?.uid) loadProfile();

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const experienceSelectOptions = useMemo(() => {
    const customOption =
      form.experience && !EXPERIENCE_TUPLES.some((opt) => opt[0] === form.experience)
        ? [[form.experience, form.experience]]
        : [];
    return [['', 'Select experience'], ...customOption, ...EXPERIENCE_TUPLES];
  }, [form.experience]);

  useEffect(() => {
    if (selectingAddressRef.current) return undefined;

    const address = form.address.trim();
    if (address.length < 3) {
      setAddressSuggestions([]);
      return undefined;
    }

    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);

    addressDebounceRef.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const results = await fetchAutocompleteSuggestions(address);
        setAddressSuggestions(results);
      } catch (error) {
        setAddressSuggestions([]);
      } finally {
        setAddressLoading(false);
      }
    }, 350);

    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    };
  }, [form.address]);

  const handleAddressChange = (value) => {
    updateField('address', value);
    setAddressMeta({ lat: null, lng: null });
  };

  const handleSelectAddress = async (suggestion) => {
    selectingAddressRef.current = true;
    setAddressSuggestions([]);
    updateField('address', suggestion.description);

    try {
      setAddressLoading(true);
      const geocoded = await geocodeAddress(suggestion.description);
      if (geocoded) {
        updateField('address', geocoded.formattedAddress || suggestion.description);
        setAddressMeta({ lat: geocoded.lat ?? null, lng: geocoded.lng ?? null });
      } else {
        setAddressMeta({ lat: null, lng: null });
      }
    } finally {
      setAddressLoading(false);
      selectingAddressRef.current = false;
    }
  };

  const resolveAddressMeta = async () => {
    if (addressMeta.lat !== null && addressMeta.lng !== null) {
      return { ...addressMeta, formattedAddress: form.address };
    }
    if (!form.address.trim()) return { lat: null, lng: null, formattedAddress: '' };

    const geocoded = await geocodeAddress(form.address.trim());
    if (!geocoded) return { lat: null, lng: null, formattedAddress: form.address.trim() };

    updateField('address', geocoded.formattedAddress || form.address.trim());
    const nextMeta = { lat: geocoded.lat ?? null, lng: geocoded.lng ?? null };
    setAddressMeta(nextMeta);
    return { ...nextMeta, formattedAddress: geocoded.formattedAddress || form.address.trim() };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const resolvedAddressMeta = await resolveAddressMeta();
      const resolvedAddress = resolvedAddressMeta.formattedAddress || form.address;
      await setDoc(
        doc(firestore, 'users', user.uid),
        {
          name: form.name,
          phone: form.phone,
          address: resolvedAddress,
          gender: form.gender,
          experience: form.experience || null,
          about: form.about,
          nationalityStatus: form.nationalityStatus,
          dob: form.dob || null,
          formattedAddress: resolvedAddress,
          latitude: resolvedAddressMeta.lat,
          longitude: resolvedAddressMeta.lng,
          lat: resolvedAddressMeta.lat,
          lng: resolvedAddressMeta.lng,
          coords: {
            lat: resolvedAddressMeta.lat,
            lng: resolvedAddressMeta.lng,
          },
          profile: {
            address: resolvedAddress,
            formattedAddress: resolvedAddress,
            nationalityStatus: form.nationalityStatus,
            dob: form.dob || null,
            experience: form.experience || null,
            about: form.about,
          },
        },
        { merge: true }
      );
      await updateProviderDetails(user.uid, {
        experience: form.experience || null,
        profile: {
          about: form.about,
          address: resolvedAddress,
          formattedAddress: resolvedAddress,
          latitude: resolvedAddressMeta.lat,
          longitude: resolvedAddressMeta.lng,
          nationalityStatus: form.nationalityStatus,
          dob: form.dob || null,
          experience: form.experience || null,
        },
      });
      await refreshUserData?.();
      notify.success('Profile updated successfully');
    } catch (error) {
      notify.error(error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <ProviderAppLayout>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Edit Profile</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Update your business profile information.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" value={form.name} onChange={(value) => updateField('name', value)} />
          <Field
            label="Phone"
            value={form.phone}
            onChange={(value) => updateField('phone', value)}
          />
          <SelectField
            label="Experience"
            value={form.experience}
            onChange={(value) => updateField('experience', value)}
            options={experienceSelectOptions}
          />
          <Field
            label="Date of Birth"
            type="date"
            value={form.dob}
            onChange={(value) => updateField('dob', value)}
          />
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(value) => updateField('gender', value)}
            options={[
              ['', 'Select gender'],
              ['male', 'Male'],
              ['female', 'Female'],
              ['other', 'Other'],
            ]}
          />
          <SelectField
            label="Nationality Status"
            value={form.nationalityStatus}
            onChange={(value) => updateField('nationalityStatus', value)}
            options={[
              ['', 'Select status'],
              ['australian_citizen', 'Australian Citizen'],
              ['permanent_resident', 'Permanent Resident'],
              ['visa_holder', 'VISA Holder'],
            ]}
          />
          <AddressAutocompleteField
            value={form.address}
            loading={addressLoading}
            suggestions={addressSuggestions}
            onChange={handleAddressChange}
            onSelect={handleSelectAddress}
          />
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">About</span>
            <textarea
              value={form.about}
              onChange={(event) => updateField('about', event.target.value)}
              rows={5}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#5A52E3]"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#5A52E3] px-5 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      <Footer />
    </ProviderAppLayout>
  );
};

const normalizeDateInput = (value) => {
  if (!value) return '';
  return formatLocalDateYMD(value);
};

const Field = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <label className="grid gap-1.5">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
    />
  </label>
);

const AddressAutocompleteField = ({ value, loading, suggestions, onChange, onSelect }) => (
  <label className="relative grid gap-1.5 sm:col-span-2">
    <span className="text-sm font-medium text-slate-700">Address</span>
    <div className="relative">
      <FiMapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Start typing your address..."
        className="h-11 w-full rounded-lg border border-slate-200 px-10 text-sm font-semibold outline-none focus:border-[#5A52E3]"
        autoComplete="off"
      />
      {loading ? (
        <FiLoader className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#5A52E3]" />
      ) : null}
    </div>

    {suggestions.length > 0 ? (
      <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.place_id}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="flex w-full items-start gap-2 border-b border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-700 last:border-b-0 hover:bg-slate-50"
          >
            <FiMapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>{suggestion.description}</span>
          </button>
        ))}
      </div>
    ) : null}
  </label>
);

const SelectField = ({ label, value, onChange, options }) => (
  <label className="grid gap-1.5">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
    >
      {options.map(([optionValue, labelText]) => (
        <option key={optionValue} value={optionValue}>
          {labelText}
        </option>
      ))}
    </select>
  </label>
);

export default ProviderEditProfileScreen;
