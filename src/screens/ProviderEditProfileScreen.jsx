import React, { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { fetchUserProfile } from '../services/firebase';
import { firestore } from '../services/firebase/firebaseConfig';
import { updateProviderDetails } from '../services/firebase/providerOnboardingService';
import { notify } from '../utils/toast';

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

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const profile = await fetchUserProfile(user.uid);
        if (mounted) {
          setForm({
            name: profile?.name || profile?.fullName || '',
            phone: profile?.phone || profile?.phoneNumber || '',
            address: profile?.address || profile?.profile?.address || '',
            gender: profile?.gender || '',
            experience: profile?.experience || '',
            about: profile?.about || profile?.bio || '',
            nationalityStatus:
              profile?.nationalityStatus || profile?.profile?.nationalityStatus || '',
            dob: normalizeDateInput(profile?.dob || profile?.profile?.dob),
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await setDoc(
        doc(firestore, 'users', user.uid),
        {
          name: form.name,
          phone: form.phone,
          address: form.address,
          gender: form.gender,
          experience: form.experience,
          about: form.about,
          nationalityStatus: form.nationalityStatus,
          dob: form.dob || null,
          profile: {
            address: form.address,
            nationalityStatus: form.nationalityStatus,
            dob: form.dob || null,
          },
        },
        { merge: true }
      );
      await updateProviderDetails(user.uid, {
        profile: {
          about: form.about,
          address: form.address,
          nationalityStatus: form.nationalityStatus,
          dob: form.dob || null,
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
        <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Edit Profile</h1>
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
          <Field
            label="Experience"
            value={form.experience}
            onChange={(value) => updateField('experience', value)}
            placeholder="Years"
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
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-sm font-bold text-slate-700">Address</span>
            <input
              value={form.address}
              onChange={(event) => updateField('address', event.target.value)}
              className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-sm font-bold text-slate-700">About</span>
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
            className="rounded-lg bg-[#5A52E3] px-5 py-2.5 font-black text-white disabled:opacity-60"
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
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const Field = ({ label, value, onChange, type = 'text', placeholder = '' }) => (
  <label className="grid gap-1.5">
    <span className="text-sm font-bold text-slate-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
    />
  </label>
);

const SelectField = ({ label, value, onChange, options }) => (
  <label className="grid gap-1.5">
    <span className="text-sm font-bold text-slate-700">{label}</span>
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
