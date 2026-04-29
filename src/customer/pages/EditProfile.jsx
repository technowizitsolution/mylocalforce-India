import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  FiCamera,
  FiCheckCircle,
  FiMail,
  FiPhone,
  FiSave,
  FiUser,
} from 'react-icons/fi';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../../context/AuthContext';
import { auth, firestore } from '../../services/firebase/firebaseConfig';
import { uploadProfileImage } from '../../services/firebase/profileImageUpload';
import { notify, getUserFacingError } from '../../utils/toast';

const EditProfile = () => {
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuth();
  const [form, setForm] = useState({
    name: '',
    phone: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name || user?.displayName || '',
      phone: user?.phone || user?.phoneNumber || '',
    });
    setPhotoPreview(user?.photoURL || '');
    setPhotoFile(null);
  }, [user]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const displayName = form.name.trim() || 'Customer';
  const initials = useMemo(
    () =>
      displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(''),
    [displayName]
  );

  const profileItems = [
    {
      icon: FiUser,
      label: 'Name',
      value: displayName,
    },
    {
      icon: FiMail,
      label: 'Email',
      value: user?.email || 'Not available',
    },
    {
      icon: FiPhone,
      label: 'Phone',
      value: form.phone || 'Not added yet',
    },
  ];

  const handleChange = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      notify.warning('Please choose an image file.', { id: 'edit-profile-image' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify.warning('Profile image must be under 5 MB.', {
        id: 'edit-profile-image',
      });
      return;
    }

    if (photoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user?.uid || saving) return;

    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name) {
      notify.warning('Please enter your full name.', { id: 'edit-profile-save' });
      return;
    }

    try {
      setSaving(true);
      let nextPhotoURL = user?.photoURL || '';

      if (photoFile) {
        nextPhotoURL = await uploadProfileImage(user.uid, photoFile, {
          previousUrl: user?.photoURL,
        });
      }

      await setDoc(
        doc(firestore, 'users', user.uid),
        {
          name,
          displayName: name,
          phone,
          ...(nextPhotoURL ? { photoURL: nextPhotoURL } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: name,
          ...(nextPhotoURL ? { photoURL: nextPhotoURL } : {}),
        }).catch(() => {});
      }

      await refreshUserData?.();
      setPhotoFile(null);
      notify.success('Profile updated.', { id: 'edit-profile-save' });
    } catch (error) {
      notify.error(
        getUserFacingError(error, 'Could not update your profile. Please try again.'),
        { id: 'edit-profile-save' }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountLayout
      title="Edit Profile"
      subtitle="Keep your customer details accurate for bookings and updates."
    >
      <form
        onSubmit={handleSubmit}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Personal Details</h2>
              <p className="mt-1 text-sm text-slate-500">
                These details help providers recognize and contact you.
              </p>
            </div>
            <span className="hidden h-11 w-11 items-center justify-center rounded-xl bg-[#6C63FF]/10 text-[#5A52E3] sm:flex">
              <FiUser size={20} />
            </span>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <div className="relative h-24 w-24">
              <div className="h-24 w-24 overflow-hidden rounded-2xl bg-linear-to-br from-[#6C63FF] to-[#4ECDC4] shadow-sm flex items-center justify-center">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-semibold text-white">{initials}</span>
                )}
              </div>
              <label className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-[#5A52E3] shadow-sm transition-colors hover:bg-indigo-50">
                <FiCamera size={18} />
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">Profile Photo</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload a clear square photo. JPG or PNG under 5 MB works best.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Full Name</span>
              <input
                type="text"
                value={form.name}
                onChange={handleChange('name')}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6C63FF] focus:bg-white"
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Phone Number</span>
              <input
                type="tel"
                value={form.phone}
                onChange={handleChange('phone')}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#6C63FF] focus:bg-white"
                placeholder="Enter your phone number"
                autoComplete="tel"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Email Address</span>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none"
              />
              <span className="mt-2 block text-xs text-slate-500">
                Email changes require account verification and are handled separately.
              </span>
            </label>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/customer/profile')}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#6C63FF] to-[#4ECDC4] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md ${
                saving ? 'cursor-not-allowed opacity-70' : ''
              }`}
            >
              {saving ? (
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <FiSave size={17} />
              )}
              Save Changes
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-linear-to-br from-[#6C63FF] to-[#4ECDC4] flex items-center justify-center">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Current profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-semibold text-white">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-950 truncate">{displayName}</p>
              <p className="text-sm text-slate-500 truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {profileItems.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#5A52E3] shadow-sm">
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-slate-500">
                    {label}
                  </p>
                  <p className="truncate text-sm font-medium text-slate-800">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-[#4ECDC4]/30 bg-[#4ECDC4]/10 p-4">
            <div className="flex items-start gap-3">
              <FiCheckCircle className="mt-0.5 shrink-0 text-[#1E9E94]" size={18} />
              <p className="text-sm text-slate-700">
                A complete profile makes booking confirmations and provider follow-ups
                smoother.
              </p>
            </div>
          </div>
        </aside>
      </form>
    </AccountLayout>
  );
};

export default EditProfile;
