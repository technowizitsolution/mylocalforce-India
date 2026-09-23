import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteField } from 'firebase/firestore';
import { FiAlertCircle, FiExternalLink, FiFileText, FiSave, FiUpload } from 'react-icons/fi';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { fetchProviderDetails } from '../services/firebase';
import {
  deleteProviderDocument,
  getProviderDocumentViewUrl,
  updateProviderDetails,
  uploadProviderDocument,
} from '../services/firebase/providerOnboardingService';
import MobileUploadCard from '../components/providerUpload/desktop/MobileUploadCard';
import useCategories from '../hooks/useCategories';
import { EXPERIENCE_TUPLES } from '../utils/helpers';
import { notify } from '../utils/toast';

const documentTypes = [
  { key: 'passportUrl', uploadType: 'passport', label: 'Passport / ID Proof' },
  { key: 'drivingLicenceUrl', uploadType: 'drivingLicence', label: 'Driving Licence' },
  { key: 'resumeUrl', uploadType: 'resume', label: 'Resume / CV' },
  { key: 'certificatesUrl', uploadType: 'certificates', label: 'Certificates' },
  { key: 'verificationVideoUrl', uploadType: 'verificationVideo', label: 'Verification Video' },
];

const visaCategoryOptions = [
  ['', 'Select VISA category'],
  ['student', 'Student VISA'],
  ['work', 'Work VISA'],
  ['other', 'Other'],
];

const notificationOptions = [
  ['both', 'Email & SMS Both'],
  ['email', 'Email Only'],
  ['sms', 'SMS Only'],
  ['none', 'No Notifications'],
];

const bankOptions = [
  ['', 'Select Bank'],
  ['CBA', 'Commonwealth Bank of Australia (CBA)'],
  ['Westpac', 'Westpac Banking Corporation'],
  ['ANZ', 'Australia and New Zealand Banking Group (ANZ)'],
  ['NAB', 'National Australia Bank (NAB)'],
  ['Macquarie', 'Macquarie Bank'],
  ['BOQ', 'Bank of Queensland (BOQ)'],
  ['Bendigo', 'Bendigo & Adelaide Bank'],
  ['Suncorp', 'Suncorp Bank'],
  ['ING', 'ING Australia'],
  ['AMP', 'AMP Bank'],
];

const preferredGenderOptions = [
  ['any', 'All'],
  ['male', 'Male'],
  ['female', 'Female'],
  ['non_binary', 'Non-binary'],
];

const experienceOptions = [
  ['0', '0+ year'],
  ['1', '1+ year'],
  ['2', '2+ years'],
  ['3', '3+ years'],
  ['4', '4+ years'],
  ['5', '5+ years'],
  ['6', '6+ years'],
  ['7', '7+ years'],
  ['8', '8+ years'],
  ['9', '9+ years'],
  ['10', '10+ years'],
  ['15', '15+ years'],
  ['20', '20+ years'],
];

const ProviderEditDetailsScreen = () => {
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuth();
  const { categories } = useCategories();
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({
    nationalityStatus: '',
    visaCategory: '',
    visaNumber: '',
    visaExpiryDay: '',
    visaExpiryMonth: '',
    visaExpiryYear: '',
    notificationPreference: 'both',
    preferredGender: 'any',
    experience: '',
    providerIntroduction: '',
    tfnNumber: '',
    abnNumber: '',
    bankName: '',
    accountName: '',
    bsb: '',
    accountNumber: '',
    passportNumber: '',
    passportExpiryDay: '',
    passportExpiryMonth: '',
    passportExpiryYear: '',
    drivingLicenceNumber: '',
    drivingLicenceCardNumber: '',
    drivingLicenceExpiryDay: '',
    drivingLicenceExpiryMonth: '',
    drivingLicenceExpiryYear: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [progress, setProgress] = useState({});
  const [secureUploadSummary, setSecureUploadSummary] = useState(null);
  const [secureUploadAvailability, setSecureUploadAvailability] = useState({
    loading: true,
    enabled: false,
  });
  const [externalUploadTarget, setExternalUploadTarget] = useState({ docKey: '', mode: '' });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);

  const experienceSelectOptions = useMemo(() => {
    const customOption =
      form.experience && !EXPERIENCE_TUPLES.some((opt) => opt[0] === form.experience)
        ? [[form.experience, form.experience]]
        : [];
    return [['', 'Select experience'], ...customOption, ...EXPERIENCE_TUPLES];
  }, [form.experience]);

  const loadDetails = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const providerDetails = await fetchProviderDetails(user.uid).catch(() => null);
      setDetails(providerDetails);
      setForm(toForm(providerDetails));
      setSelectedServices(
        normalizeServicesArray(
          providerDetails?.profile?.servicesOffered || providerDetails?.servicesOffered || []
        )
      );
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

  const categorySubcategories = useMemo(() => {
    const activeCategoryIds =
      selectedCategoryIds.length > 0
        ? selectedCategoryIds
        : inferCategoryIdsFromServices(categories, selectedServices);

    return categories
      .filter((category) => activeCategoryIds.includes(category.id))
      .flatMap((category) =>
        getCategorySubcategories(category).map((subcategory) => ({
          ...subcategory,
          parentCategoryId: category.id,
          parentCategoryName: category.name || category.title || category.label || category.id,
        }))
      )
      .filter(
        (subcategory, index, all) =>
          all.findIndex((item) => normalizeItemLabel(item) === normalizeItemLabel(subcategory)) ===
          index
      );
  }, [categories, selectedCategoryIds, selectedServices]);

  useEffect(() => {
    if (!categories.length || !selectedServices.length || selectedCategoryIds.length) return;
    setSelectedCategoryIds(inferCategoryIdsFromServices(categories, selectedServices));
  }, [categories, selectedServices, selectedCategoryIds.length]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const buildProviderDetailsUpdates = () => {
    const visaExpiry =
      form.visaExpiryDay || form.visaExpiryMonth || form.visaExpiryYear
        ? {
            day: form.visaExpiryDay,
            month: form.visaExpiryMonth,
            year: form.visaExpiryYear,
          }
        : null;
    const isAustralianCitizen = form.nationalityStatus === 'australian_citizen';
    const passportExpiry = buildDateString(
      form.passportExpiryYear,
      form.passportExpiryMonth,
      form.passportExpiryDay
    );
    const drivingLicenceExpiry = buildDateString(
      form.drivingLicenceExpiryYear,
      form.drivingLicenceExpiryMonth,
      form.drivingLicenceExpiryDay
    );
    const introductionText = form.providerIntroduction.trim();

    return {
      nationalityStatus: form.nationalityStatus,
      visaCategory: isAustralianCitizen ? null : form.visaCategory || null,
      visaNumber: isAustralianCitizen ? null : form.visaNumber || null,
      visaExpiry: isAustralianCitizen ? null : visaExpiry,
      experience: form.experience || null,
      servicesOffered: selectedServices,
      notificationPreferences: {
        ...(details?.notificationPreferences || {}),
        preference: form.notificationPreference,
      },
      profile: {
        ...(details?.profile || {}),
        nationalityStatus: form.nationalityStatus,
        visaCategory: isAustralianCitizen ? null : form.visaCategory || null,
        visaNumber: isAustralianCitizen ? null : form.visaNumber || null,
        visaExpiry: isAustralianCitizen ? null : visaExpiry,
        serviceCategoryIds: selectedCategoryIds,
        servicesOffered: selectedServices,
        preferredGender: form.preferredGender || 'any',
        experience: form.experience || null,
        providerIntroduction: introductionText || null,
        bio: introductionText || null,
        about: introductionText || null,
        description: introductionText || null,
      },
      businessInformation: {
        ...(details?.businessInformation || {}),
        tfnNumber: form.tfnNumber,
        abnNumber: form.abnNumber,
      },
      bankingDetails: {
        ...(details?.bankingDetails || {}),
        bankName: form.bankName,
        accountName: form.accountName,
        bsb: form.bsb,
        accountNumber: form.accountNumber,
      },
      passport: {
        ...(details?.passport || {}),
        number: form.passportNumber,
        expiry: passportExpiry || null,
      },
      drivingLicence: {
        ...(details?.drivingLicence || details?.drivingLicense || {}),
        number: form.drivingLicenceNumber,
        cardNumber: form.drivingLicenceCardNumber,
        expiry: drivingLicenceExpiry || null,
      },
    };
  };

  const saveDraftForSecureUpload = async () => {
    if (!user?.uid) return;
    await updateProviderDetails(user.uid, {
      ...buildProviderDetailsUpdates(),
      secureUploadStatus: 'draft',
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!user?.uid) return;

    try {
      setSaving(true);
      await updateProviderDetails(user.uid, {
        ...buildProviderDetailsUpdates(),
        status: 'under_review',
        ...(secureUploadSummary?.sessionId
          ? {
              secureUploadSessionId: secureUploadSummary.sessionId,
              latestDocumentUploadSessionId: secureUploadSummary.sessionId,
              documentUploadMode: 'secure_v2',
              documentsMetadata: secureUploadSummary.documentsMetadata || {},
            }
          : {}),
      }, { submitForReview: true });
      await refreshUserData?.();
      notify.success('Provider details submitted for review');
      navigate('/provider/under-review', { replace: true });
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
      await deleteProviderDocument(documents[docConfig.key]);
      const url = await uploadProviderDocument(user.uid, file, docConfig.uploadType, (percent) => {
        setProgress((current) => ({ ...current, [docConfig.key]: percent }));
      });
      await updateProviderDetails(user.uid, {
        documents: {
          ...documents,
          [docConfig.key]: url,
          ...(secureDocumentFieldByKey[docConfig.key]
            ? { [secureDocumentFieldByKey[docConfig.key]]: deleteField() }
            : {}),
        },
        status: 'under_review',
      }, { submitForReview: true });
      await refreshUserData?.();
      notify.success(`${docConfig.label} uploaded and submitted for review`);
      await loadDetails();
    } catch (error) {
      notify.error(error?.message || 'Document upload failed');
    } finally {
      setUploadingKey('');
    }
  };

  const handleOpenSecureDocument = async (storagePath) => {
    try {
      const viewUrl = await getProviderDocumentViewUrl(storagePath);
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      notify.error(
        error?.code === 'storage/unauthorized'
          ? 'You do not have permission to view this file yet. Deploy the updated storage rules and try again.'
          : error?.message || 'Could not open secure document.'
      );
    }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <ProviderAppLayout>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">
          Edit My Details & Documents
        </h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Update your provider details and replace uploaded documents.
        </p>
      </header>

      <form onSubmit={handleSave} className="mt-6 grid gap-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Provider Details</h2>
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
            {form.nationalityStatus === 'visa_holder' ? (
              <SelectField
                label="VISA Category"
                value={form.visaCategory}
                onChange={(value) => updateField('visaCategory', value)}
                options={visaCategoryOptions}
              />
            ) : null}
            {form.nationalityStatus === 'visa_holder' && form.visaCategory === 'other' ? (
              <Field
                label="VISA Number"
                value={form.visaNumber}
                onChange={(value) => updateField('visaNumber', value)}
              />
            ) : null}
            {form.nationalityStatus === 'visa_holder' ||
            form.nationalityStatus === 'permanent_resident' ? (
              <DatePartsField
                label={
                  form.nationalityStatus === 'permanent_resident'
                    ? 'Permanent Resident Expiry Date'
                    : 'VISA Expiry Date'
                }
                day={form.visaExpiryDay}
                month={form.visaExpiryMonth}
                year={form.visaExpiryYear}
                fieldPrefix="visaExpiry"
                onChange={updateField}
              />
            ) : null}
            <SelectField
              label="Notification Preference"
              value={form.notificationPreference}
              onChange={(value) => updateField('notificationPreference', value)}
              options={notificationOptions}
            />
            <SelectField
              label="Preferred Gender"
              value={form.preferredGender}
              onChange={(value) => updateField('preferredGender', value)}
              options={preferredGenderOptions}
            />
            <SelectField
              label="Experience"
              value={form.experience}
              onChange={(value) => updateField('experience', value)}
              options={experienceSelectOptions}
            />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-800">Services Offered</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Select one or more categories, then choose the subcategories you provide.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => {
                const label = category.name || category.title || category.label || category.id;
                const selected = selectedCategoryIds.includes(category.id);
                return (
                  <ChipButton
                    key={category.id || label}
                    selected={selected}
                    onClick={() => {
                      setSelectedCategoryIds((current) =>
                        selected
                          ? current.filter((id) => id !== category.id)
                          : [...current, category.id]
                      );
                    }}
                  >
                    {label}
                  </ChipButton>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              {categorySubcategories.length ? (
                <div className="flex flex-wrap gap-2">
                  {categorySubcategories.map((subcategory) => {
                    const label = normalizeItemLabel(subcategory);
                    const selected = selectedServices.includes(label);
                    return (
                      <ChipButton
                        key={`${subcategory.parentCategoryId}-${subcategory.id || label}`}
                        selected={selected}
                        onClick={() => {
                          setSelectedServices((current) =>
                            selected
                              ? current.filter((item) => item !== label)
                              : [...current, label]
                          );
                        }}
                      >
                        {label}
                      </ChipButton>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm font-semibold text-slate-500">
                  No subcategories available for the selected category.
                </p>
              )}
              <p className="mt-3 text-xs font-medium text-slate-400">
                {selectedServices.length} service(s) selected
              </p>
            </div>
          </div>

          <label className="mt-6 grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">About Us</span>
            <textarea
              value={form.providerIntroduction}
              onChange={(event) => updateField('providerIntroduction', event.target.value)}
              maxLength={600}
              rows={5}
              placeholder="Tell customers about your experience and service approach."
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#5A52E3]"
            />
            <span className="text-right text-xs font-medium text-slate-400">
              {form.providerIntroduction.length}/600 characters
            </span>
          </label>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Business & Banking</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="TFN Number"
              value={form.tfnNumber}
              onChange={(value) => updateField('tfnNumber', value)}
            />
            <Field
              label="ABN Number"
              value={form.abnNumber}
              onChange={(value) => updateField('abnNumber', value)}
            />
            <SelectField
              label="Bank Name"
              value={form.bankName}
              onChange={(value) => updateField('bankName', value)}
              options={bankOptions}
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
              <h2 className="text-lg font-semibold text-slate-950">Documents</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Upload or replace documents here. The documents page is view-only.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            <DocumentCard
              title="Passport"
              docConfig={documentTypes[0]}
              {...getDocumentState(documents, documentTypes[0])}
              isUploading={uploadingKey === 'passportUrl'}
              progress={progress.passportUrl || 0}
              onFileChange={handleFileChange}
              onOpenSecureDocument={handleOpenSecureDocument}
              externalActive={externalUploadTarget.docKey === 'passportUrl'}
              onExternalUpload={(mode) => setExternalUploadTarget({ docKey: 'passportUrl', mode })}
              externalUploadContent={
                <SecureUploadPanel
                  user={user}
                  docKey="passportUrl"
                  mode={externalUploadTarget.mode}
                  onSummaryChange={setSecureUploadSummary}
                  onAvailabilityChange={setSecureUploadAvailability}
                  onBeforeCreateSession={saveDraftForSecureUpload}
                  secureUploadAvailability={secureUploadAvailability}
                />
              }
            >
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Passport Number"
                  value={form.passportNumber}
                  onChange={(value) => updateField('passportNumber', value)}
                />
                <DatePartsField
                  label="Passport Expiry Date"
                  day={form.passportExpiryDay}
                  month={form.passportExpiryMonth}
                  year={form.passportExpiryYear}
                  fieldPrefix="passportExpiry"
                  onChange={updateField}
                />
              </div>
            </DocumentCard>

            <DocumentCard
              title="Driving Licence"
              docConfig={documentTypes[1]}
              {...getDocumentState(documents, documentTypes[1])}
              isUploading={uploadingKey === 'drivingLicenceUrl'}
              progress={progress.drivingLicenceUrl || 0}
              onFileChange={handleFileChange}
              onOpenSecureDocument={handleOpenSecureDocument}
              externalActive={externalUploadTarget.docKey === 'drivingLicenceUrl'}
              onExternalUpload={(mode) =>
                setExternalUploadTarget({ docKey: 'drivingLicenceUrl', mode })
              }
              externalUploadContent={
                <SecureUploadPanel
                  user={user}
                  docKey="drivingLicenceUrl"
                  mode={externalUploadTarget.mode}
                  onSummaryChange={setSecureUploadSummary}
                  onAvailabilityChange={setSecureUploadAvailability}
                  onBeforeCreateSession={saveDraftForSecureUpload}
                  secureUploadAvailability={secureUploadAvailability}
                />
              }
            >
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Driving Licence Number"
                  value={form.drivingLicenceNumber}
                  onChange={(value) => updateField('drivingLicenceNumber', value)}
                />
                <Field
                  label="Card Number"
                  value={form.drivingLicenceCardNumber}
                  onChange={(value) => updateField('drivingLicenceCardNumber', value)}
                />
                <DatePartsField
                  label="Driving Licence Expiry Date"
                  day={form.drivingLicenceExpiryDay}
                  month={form.drivingLicenceExpiryMonth}
                  year={form.drivingLicenceExpiryYear}
                  fieldPrefix="drivingLicenceExpiry"
                  onChange={updateField}
                />
              </div>
            </DocumentCard>

            {documentTypes.slice(2).map((docConfig) => {
              const documentState = getDocumentState(documents, docConfig);
              const isUploading = uploadingKey === docConfig.key;
              return (
                <DocumentCard
                  key={docConfig.key}
                  title={docConfig.label}
                  docConfig={docConfig}
                  {...documentState}
                  isUploading={isUploading}
                  progress={progress[docConfig.key] || 0}
                  onFileChange={handleFileChange}
                  onOpenSecureDocument={handleOpenSecureDocument}
                  externalActive={externalUploadTarget.docKey === docConfig.key}
                  onExternalUpload={(mode) =>
                    setExternalUploadTarget({ docKey: docConfig.key, mode })
                  }
                  externalUploadContent={
                    <SecureUploadPanel
                      user={user}
                      docKey={docConfig.key}
                      mode={externalUploadTarget.mode}
                      onSummaryChange={setSecureUploadSummary}
                      onAvailabilityChange={setSecureUploadAvailability}
                      onBeforeCreateSession={saveDraftForSecureUpload}
                      secureUploadAvailability={secureUploadAvailability}
                    />
                  }
                >
                  {null}
                </DocumentCard>
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
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#5A52E3] px-5 text-sm font-semibold text-white disabled:opacity-60"
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
  const visaExpiry = toDateParts(details?.visaExpiry || details?.profile?.visaExpiry);
  const passportExpiry = toDateParts(
    details?.passport?.expiry ||
      details?.profile?.passport?.expiry ||
      details?.passportExpiry ||
      details?.passportExpiryTimestamp
  );
  const drivingLicence =
    details?.drivingLicence || details?.drivingLicense || details?.profile?.drivingLicence || {};
  const drivingLicenceExpiry = toDateParts(
    drivingLicence?.expiry ||
      details?.drivingLicenceExpiry ||
      details?.drivingLicenseExpiry ||
      details?.drivingLicenceExpiryTimestamp ||
      details?.drivingLicenseExpiryTimestamp
  );
  return {
    nationalityStatus: details?.nationalityStatus || details?.profile?.nationalityStatus || '',
    visaCategory: details?.visaCategory || details?.profile?.visaCategory || '',
    visaNumber: details?.visaNumber || details?.profile?.visaNumber || '',
    visaExpiryDay: visaExpiry.day,
    visaExpiryMonth: visaExpiry.month,
    visaExpiryYear: visaExpiry.year,
    notificationPreference:
      details?.notificationPreferences?.preference || details?.notificationPreference || 'both',
    preferredGender: details?.profile?.preferredGender || 'any',
    experience: (() => {
      const rawExperience =
        details?.profile?.experience ??
        details?.experience ??
        details?.userProfile?.experience ??
        details?.userProfile?.profile?.experience ??
        '';
      const resolvedExp = rawExperience != null ? String(rawExperience).trim() : '';
      const numericMatch = resolvedExp.match(/^(\d+)/);
      const matchedOption = numericMatch && EXPERIENCE_TUPLES.find((opt) => opt[0] === numericMatch[1]);
      return matchedOption ? matchedOption[0] : resolvedExp;
    })(),
    providerIntroduction:
      details?.profile?.providerIntroduction ||
      details?.profile?.bio ||
      details?.profile?.about ||
      details?.profile?.description ||
      '',
    tfnNumber: details?.businessInformation?.tfnNumber || '',
    abnNumber: details?.businessInformation?.abnNumber || '',
    bankName: details?.bankingDetails?.bankName || '',
    accountName: details?.bankingDetails?.accountName || '',
    bsb: details?.bankingDetails?.bsb || '',
    accountNumber: details?.bankingDetails?.accountNumber || '',
    passportNumber: details?.passport?.number || details?.profile?.passport?.number || '',
    passportExpiryDay: passportExpiry.day,
    passportExpiryMonth: passportExpiry.month,
    passportExpiryYear: passportExpiry.year,
    drivingLicenceNumber: drivingLicence?.number || '',
    drivingLicenceCardNumber: drivingLicence?.cardNumber || '',
    drivingLicenceExpiryDay: drivingLicenceExpiry.day,
    drivingLicenceExpiryMonth: drivingLicenceExpiry.month,
    drivingLicenceExpiryYear: drivingLicenceExpiry.year,
  };
};

const normalizeServicesArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const getCategorySubcategories = (category) =>
  category?.subcategories || category?.subCategories || category?.subs || category?.children || [];

const normalizeItemLabel = (item) =>
  String(item?.name || item?.title || item?.label || item?.id || item || '').trim();

const inferCategoryIdsFromServices = (categories, services) => {
  const selected = new Set(services.map((item) => String(item).trim().toLowerCase()));
  return categories
    .filter((category) =>
      getCategorySubcategories(category).some((subcategory) =>
        selected.has(normalizeItemLabel(subcategory).toLowerCase())
      )
    )
    .map((category) => category.id)
    .filter(Boolean);
};

const toDateParts = (value) => {
  if (!value) return { day: '', month: '', year: '' };
  if (typeof value === 'object' && (value.day || value.month || value.year)) {
    return {
      day: String(value.day || ''),
      month: String(value.month || ''),
      year: String(value.year || ''),
    };
  }
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return { day: '', month: '', year: '' };
  return {
    day: String(date.getDate()),
    month: String(date.getMonth() + 1),
    year: String(date.getFullYear()),
  };
};

const buildDateString = (year, month, day) => {
  if (!year || !month || !day) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

const DocumentCard = ({
  title,
  docConfig,
  url,
  uploaded,
  secureUploaded,
  secureStoragePath,
  isUploading,
  progress,
  onFileChange,
  onOpenSecureDocument,
  externalActive,
  onExternalUpload,
  externalUploadContent,
  children,
}) => {
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const accept = docConfig.key === 'verificationVideoUrl' ? 'video/*' : '.pdf,image/*';

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {uploaded
              ? url
                ? 'Document uploaded'
                : 'Secure document uploaded'
              : 'Document not uploaded'}
            {isUploading ? ` - ${progress || 0}%` : ''}
          </p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FiExternalLink className="h-4 w-4" />
              Open
            </a>
          ) : null}
          {secureUploaded && secureStoragePath ? (
            <button
              type="button"
              onClick={() => onOpenSecureDocument(secureStoragePath)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <FiFileText className="h-4 w-4" />
              View file
            </button>
          ) : secureUploaded ? (
            <span className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
              <FiFileText className="h-4 w-4" />
              Secure file
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowUploadOptions((current) => !current)}
            disabled={isUploading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#5A52E3] px-3 text-sm font-medium text-white hover:bg-[#4b44c8] disabled:opacity-60"
          >
            <FiUpload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : uploaded ? 'Replace' : 'Upload'}
          </button>

          {showUploadOptions ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <label className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                This device
                <input
                  type="file"
                  className="hidden"
                  disabled={isUploading}
                  accept={accept}
                  onChange={(event) => {
                    setShowUploadOptions(false);
                    onFileChange(docConfig, event.target.files?.[0]);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowUploadOptions(false);
                  onExternalUpload('qr');
                }}
                className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Using QR
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUploadOptions(false);
                  onExternalUpload('sms');
                }}
                className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Using SMS URL
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {children}
      {externalActive ? <div className="mt-4">{externalUploadContent}</div> : null}
    </div>
  );
};

const SecureUploadPanel = ({
  user,
  docKey,
  mode,
  onSummaryChange,
  onAvailabilityChange,
  onBeforeCreateSession,
  secureUploadAvailability,
}) => {
  const requestedType = secureDocumentTypeByKey[docKey] || '';

  return (
    <>
      <MobileUploadCard
        providerId={user.uid}
        registrationStep="provider_onboarding_documents"
        verifiedMobileNumber={user.phone || user.phoneNumber}
        requestedReuploadTypes={requestedType ? [requestedType] : []}
        forcedMode={mode}
        onSummaryChange={onSummaryChange}
        onAvailabilityChange={onAvailabilityChange}
        onBeforeCreateSession={onBeforeCreateSession}
      />
      {!secureUploadAvailability.loading && !secureUploadAvailability.enabled ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
          Secure mobile upload is unavailable. Use This device from the upload menu.
        </p>
      ) : null}
    </>
  );
};

const secureDocumentTypeByKey = {
  passportUrl: 'passport',
  drivingLicenceUrl: 'driving_licence',
  resumeUrl: 'resume_cv',
  certificatesUrl: 'certificates',
  verificationVideoUrl: 'verification_video',
};

const secureDocumentFieldByKey = {
  passportUrl: 'passport',
  drivingLicenceUrl: 'drivingLicence',
  resumeUrl: 'resume',
  certificatesUrl: 'certificates',
  verificationVideoUrl: 'verificationVideo',
};

const secureDocumentFieldsByKey = {
  passportUrl: ['passport', 'idProof', 'id_proof'],
  drivingLicenceUrl: ['drivingLicence', 'drivingLicense', 'driving_licence', 'driving_license'],
  resumeUrl: ['resume', 'resume_cv', 'cv'],
  certificatesUrl: ['certificates', 'certificate'],
  verificationVideoUrl: ['verificationVideo', 'verification_video'],
};

const getSecureDocument = (documents, docKey) => {
  const candidates = secureDocumentFieldsByKey[docKey] || [];

  for (const field of candidates) {
    const directDocument = documents?.[field];
    if (directDocument) return directDocument;

    const nestedDocument = documents?.secureDocuments?.[field];
    if (nestedDocument) return nestedDocument;
  }

  return null;
};

const getSecureDocumentStoragePath = (secureDocument) => {
  if (!secureDocument) return '';

  if (secureDocument.storagePath) return secureDocument.storagePath;
  if (Array.isArray(secureDocument.storagePaths) && secureDocument.storagePaths[0]) {
    return secureDocument.storagePaths[0];
  }
  if (Array.isArray(secureDocument.files)) {
    return secureDocument.files.find((file) => file?.storagePath)?.storagePath || '';
  }

  return '';
};

const getDocumentState = (documents, docConfig) => {
  const url = documents?.[docConfig.key] || '';
  const secureDocument = getSecureDocument(documents, docConfig.key);
  const secureStoragePath = getSecureDocumentStoragePath(secureDocument);
  const hasSecureDocument = Boolean(
    secureDocument?.uploadMode === 'secure_v2' ||
    secureDocument?.documentIds?.length ||
    secureDocument?.files?.length ||
    secureDocument?.storagePaths?.length ||
    secureStoragePath
  );

  return {
    url: hasSecureDocument ? '' : url,
    uploaded: Boolean(url || hasSecureDocument),
    secureUploaded: hasSecureDocument,
    secureStoragePath,
  };
};

const DatePartsField = ({ label, day, month, year, fieldPrefix = 'visaExpiry', onChange }) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, index) => String(currentYear + index));
  const months = [
    ['1', 'Jan'],
    ['2', 'Feb'],
    ['3', 'Mar'],
    ['4', 'Apr'],
    ['5', 'May'],
    ['6', 'Jun'],
    ['7', 'Jul'],
    ['8', 'Aug'],
    ['9', 'Sep'],
    ['10', 'Oct'],
    ['11', 'Nov'],
    ['12', 'Dec'],
  ];

  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          value={day}
          onChange={(event) => onChange(`${fieldPrefix}Day`, event.target.value)}
          className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
        >
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, index) => String(index + 1)).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(event) => onChange(`${fieldPrefix}Month`, event.target.value)}
          className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
        >
          <option value="">Month</option>
          {months.map(([value, labelText]) => (
            <option key={value} value={value}>
              {labelText}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(event) => onChange(`${fieldPrefix}Year`, event.target.value)}
          className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
        >
          <option value="">Year</option>
          {years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const ChipButton = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
      selected
        ? 'border-[#5A52E3] bg-indigo-50 text-[#5A52E3]'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
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

export default ProviderEditDetailsScreen;
