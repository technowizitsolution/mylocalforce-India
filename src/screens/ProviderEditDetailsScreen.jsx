import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiExternalLink, FiFileText, FiSave, FiUpload } from 'react-icons/fi';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { fetchProviderDetails } from '../services/firebase';
import {
  updateProviderDetails,
  uploadProviderDocument,
} from '../services/firebase/providerOnboardingService';
import { notify } from '../utils/toast';

const documentTypes = [
  { key: 'passportUrl', uploadType: 'passport', label: 'Passport / ID Proof' },
  { key: 'drivingLicenceUrl', uploadType: 'drivingLicence', label: 'Driving Licence' },
  { key: 'resumeUrl', uploadType: 'resume', label: 'Resume / CV' },
  { key: 'certificatesUrl', uploadType: 'certificates', label: 'Certificates' },
  { key: 'verificationVideoUrl', uploadType: 'verificationVideo', label: 'Verification Video' },
];

const ProviderEditDetailsScreen = () => {
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuth();
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({
    nationalityStatus: '',
    visaCategory: '',
    visaNumber: '',
    visaExpiry: '',
    servicesOffered: '',
    notificationPreference: '',
    abnNumber: '',
    businessName: '',
    bankName: '',
    accountName: '',
    bsb: '',
    accountNumber: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [progress, setProgress] = useState({});

  const loadDetails = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const providerDetails = await fetchProviderDetails(user.uid).catch(() => null);
      setDetails(providerDetails);
      setForm(toForm(providerDetails));
    } catch (error) {
      notify.error('Failed to load provider details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [user?.uid]);

  const documents = useMemo(() => details?.documents || {}, [details]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;

    const servicesOffered = form.servicesOffered
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      setSaving(true);
      await updateProviderDetails(user.uid, {
        nationalityStatus: form.nationalityStatus,
        visaCategory: form.visaCategory,
        visaNumber: form.visaNumber,
        visaExpiry: form.visaExpiry || null,
        servicesOffered,
        notificationPreference: form.notificationPreference,
        profile: {
          ...(details?.profile || {}),
          nationalityStatus: form.nationalityStatus,
          visaCategory: form.visaCategory,
          visaNumber: form.visaNumber,
          visaExpiry: form.visaExpiry || null,
          servicesOffered,
        },
        businessInformation: {
          ...(details?.businessInformation || {}),
          abnNumber: form.abnNumber,
          businessName: form.businessName,
        },
        bankingDetails: {
          ...(details?.bankingDetails || {}),
          bankName: form.bankName,
          accountName: form.accountName,
          bsb: form.bsb,
          accountNumber: form.accountNumber,
        },
      });
      await refreshUserData?.();
      notify.success('Provider details updated');
      await loadDetails();
    } catch (error) {
      notify.error(error?.message || 'Failed to update provider details');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (docConfig, file) => {
    if (!file || !user?.uid) return;

    try {
      setUploadingKey(docConfig.key);
      setProgress((current) => ({ ...current, [docConfig.key]: 0 }));
      const url = await uploadProviderDocument(user.uid, file, docConfig.uploadType, (percent) => {
        setProgress((current) => ({ ...current, [docConfig.key]: percent }));
      });
      await updateProviderDetails(user.uid, {
        documents: {
          ...documents,
          [docConfig.key]: url,
        },
      });
      notify.success(`${docConfig.label} uploaded`);
      await loadDetails();
    } catch (error) {
      notify.error(error?.message || 'Document upload failed');
    } finally {
      setUploadingKey('');
    }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <ProviderAppLayout>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
          Edit My Details & Documents
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Update your provider details and replace uploaded documents.
        </p>
      </header>

      <form onSubmit={handleSave} className="mt-6 grid gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Provider Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            <Field
              label="VISA Category"
              value={form.visaCategory}
              onChange={(value) => updateField('visaCategory', value)}
            />
            <Field
              label="VISA Number"
              value={form.visaNumber}
              onChange={(value) => updateField('visaNumber', value)}
            />
            <Field
              label="VISA Expiry"
              type="date"
              value={form.visaExpiry}
              onChange={(value) => updateField('visaExpiry', value)}
            />
            <Field
              label="Notification Preference"
              value={form.notificationPreference}
              onChange={(value) => updateField('notificationPreference', value)}
              placeholder="email, sms, both, none"
            />
            <Field
              label="Services Offered"
              value={form.servicesOffered}
              onChange={(value) => updateField('servicesOffered', value)}
              placeholder="Comma separated"
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Business & Banking</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Business Name"
              value={form.businessName}
              onChange={(value) => updateField('businessName', value)}
            />
            <Field
              label="ABN Number"
              value={form.abnNumber}
              onChange={(value) => updateField('abnNumber', value)}
            />
            <Field
              label="Bank Name"
              value={form.bankName}
              onChange={(value) => updateField('bankName', value)}
            />
            <Field
              label="Account Name"
              value={form.accountName}
              onChange={(value) => updateField('accountName', value)}
            />
            <Field label="BSB" value={form.bsb} onChange={(value) => updateField('bsb', value)} />
            <Field
              label="Account Number"
              value={form.accountNumber}
              onChange={(value) => updateField('accountNumber', value)}
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-2">
            <FiFileText className="mt-1 h-5 w-5 text-[#5A52E3]" />
            <div>
              <h2 className="text-lg font-black text-slate-950">Documents</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Upload or replace documents here. The documents page is view-only.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {documentTypes.map((docConfig) => {
              const url = documents[docConfig.key];
              const isUploading = uploadingKey === docConfig.key;
              return (
                <div
                  key={docConfig.key}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-black text-slate-950">{docConfig.label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {url ? 'Uploaded' : 'Not uploaded'}
                      {isUploading ? ` - ${progress[docConfig.key] || 0}%` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <FiExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    ) : null}
                    <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#5A52E3] px-3 text-sm font-bold text-white hover:bg-[#4b44c8]">
                      <FiUpload className="h-4 w-4" />
                      {isUploading ? 'Uploading...' : url ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        className="hidden"
                        disabled={Boolean(uploadingKey)}
                        accept={
                          docConfig.key === 'verificationVideoUrl' ? 'video/*' : '.pdf,image/*'
                        }
                        onChange={(event) => handleFileChange(docConfig, event.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {!details ? (
          <div className="flex gap-2 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-700">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            No existing details were found. Saving here will create your provider details record.
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate('/provider/documents')}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#5A52E3] px-5 text-sm font-black text-white disabled:opacity-60"
          >
            <FiSave className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </div>
      </form>

      <Footer />
    </ProviderAppLayout>
  );
};

const toForm = (details) => {
  const services = details?.servicesOffered || details?.profile?.servicesOffered || [];
  return {
    nationalityStatus: details?.nationalityStatus || details?.profile?.nationalityStatus || '',
    visaCategory: details?.visaCategory || details?.profile?.visaCategory || '',
    visaNumber: details?.visaNumber || details?.profile?.visaNumber || '',
    visaExpiry: normalizeDateInput(details?.visaExpiry || details?.profile?.visaExpiry),
    servicesOffered: Array.isArray(services) ? services.join(', ') : '',
    notificationPreference: details?.notificationPreference || '',
    abnNumber: details?.businessInformation?.abnNumber || '',
    businessName: details?.businessInformation?.businessName || '',
    bankName: details?.bankingDetails?.bankName || '',
    accountName: details?.bankingDetails?.accountName || '',
    bsb: details?.bankingDetails?.bsb || '',
    accountNumber: details?.bankingDetails?.accountNumber || '',
  };
};

const normalizeDateInput = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && (value.day || value.month || value.year)) {
    const year = String(value.year || '').padStart(4, '0');
    const month = String(value.month || '').padStart(2, '0');
    const day = String(value.day || '').padStart(2, '0');
    return year && month && day ? `${year}-${month}-${day}` : '';
  }
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

export default ProviderEditDetailsScreen;
