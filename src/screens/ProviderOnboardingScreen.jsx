import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBell,
  FiBriefcase,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiCreditCard,
  FiExternalLink,
  FiFileText,
  FiImage,
  FiInfo,
  FiRefreshCw,
  FiShield,
  FiUpload,
  FiVideo,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { ErrorMessage, Loading } from '../components/StateComponents';
import {
  fetchCategories,
  fetchProviderDetails,
  fetchUserProfile,
  saveProviderDetails,
  saveProviderDetailsWithSecureDocuments,
  saveProviderOnboardingDraft,
  uploadProviderDocument,
} from '../services/firebase';
import { switchActiveRole } from '../services/firebase/userService';
import MobileUploadCard from '../components/providerUpload/desktop/MobileUploadCard';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const NATIONALITY_OPTIONS = [
  { value: 'australian_citizen', label: 'Australian Citizen' },
  { value: 'permanent_resident', label: 'Permanent Resident' },
  { value: 'visa_holder', label: 'VISA Holder' },
];

const PREFERRED_GENDER_OPTIONS = [
  { value: 'any', label: 'All' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
];

const EXPERIENCE_OPTIONS = [
  { label: '0+ year', value: '0' },
  { label: '1+ year', value: '1' },
  { label: '2+ years', value: '2' },
  { label: '3+ years', value: '3' },
  { label: '4+ years', value: '4' },
  { label: '5+ years', value: '5' },
  { label: '6+ years', value: '6' },
  { label: '7+ years', value: '7' },
  { label: '8+ years', value: '8' },
  { label: '9+ years', value: '9' },
  { label: '10+ years', value: '10' },
  { label: '15+ years', value: '15' },
  { label: '20+ years', value: '20' },
];

const VISA_CATEGORY_OPTIONS = [
  { label: 'Student VISA', value: 'student' },
  { label: 'Work VISA', value: 'work' },
  { label: 'Other', value: 'other' },
];

const BANK_LIST = [
  { label: 'Commonwealth Bank of Australia (CBA)', value: 'CBA' },
  { label: 'Westpac Banking Corporation', value: 'Westpac' },
  { label: 'Australia and New Zealand Banking Group (ANZ)', value: 'ANZ' },
  { label: 'National Australia Bank (NAB)', value: 'NAB' },
  { label: 'Macquarie Bank', value: 'Macquarie' },
  { label: 'Bank of Queensland (BOQ)', value: 'BOQ' },
  { label: 'Bendigo & Adelaide Bank', value: 'Bendigo' },
  { label: 'Suncorp Bank', value: 'Suncorp' },
  { label: 'ING Australia', value: 'ING' },
  { label: 'AMP Bank', value: 'AMP' },
];

const NOTIFICATION_OPTIONS = [
  { value: 'email', label: 'Email Only' },
  { value: 'sms', label: 'SMS Only' },
  { value: 'both', label: 'Email & SMS Both (Recommended)' },
  { value: 'none', label: 'No Notifications' },
];

const emptyDate = () => ({ day: '', month: '', year: '' });

const MONTHS = [
  { label: 'Jan', value: '1' },
  { label: 'Feb', value: '2' },
  { label: 'Mar', value: '3' },
  { label: 'Apr', value: '4' },
  { label: 'May', value: '5' },
  { label: 'Jun', value: '6' },
  { label: 'Jul', value: '7' },
  { label: 'Aug', value: '8' },
  { label: 'Sep', value: '9' },
  { label: 'Oct', value: '10' },
  { label: 'Nov', value: '11' },
  { label: 'Dec', value: '12' },
];

const DAYS = Array.from({ length: 31 }, (_, index) => ({
  label: String(index + 1),
  value: String(index + 1),
}));

const currentYear = new Date().getFullYear();
const FUTURE_YEARS = Array.from({ length: 50 }, (_, index) => ({
  label: String(currentYear + index),
  value: String(currentYear + index),
}));

const steps = [
  { number: 1, title: 'Profile', icon: FiBriefcase },
  { number: 2, title: 'Banking Details', icon: FiCreditCard },
  { number: 3, title: 'Business Information', icon: FiFileText },
  { number: 4, title: 'Notifications', icon: FiBell },
  { number: 5, title: 'Documents', icon: FiShield },
];

const normalizeItemLabel = (item) =>
  item?.name || item?.title || item?.label || item?.id || '';

const getSubcategories = (category) =>
  category?.subcategories ||
  category?.subCategories ||
  category?.subs ||
  category?.children ||
  [];

const parseStoredDate = (value) => {
  if (!value) {
    return emptyDate();
  }

  const stringValue =
    typeof value === 'string'
      ? value
      : typeof value?.toDate === 'function'
      ? value.toDate().toISOString().slice(0, 10)
      : '';

  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(stringValue);

  if (!match) {
    return emptyDate();
  }

  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
};

const formatStoredDate = (value) => {
  if (!value?.day || !value?.month || !value?.year) {
    return null;
  }

  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(
    value.day,
  ).padStart(2, '0')}`;
};

const getFileNameFromUrl = (url, fallback) => {
  if (!url) {
    return fallback || 'Uploaded file';
  }

  try {
    const [cleanUrl] = url.split('?');
    const segments = cleanUrl.split('/');
    return decodeURIComponent(segments[segments.length - 1] || fallback);
  } catch (error) {
    return fallback || 'Uploaded file';
  }
};

const controlClass =
  'h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-gray-900 placeholder-gray-500 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500';
const compactControlClass =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500';

const ChoiceCard = ({ selected, title, caption, onClick, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border p-4 text-left transition ${
      selected
        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-gray-50'
    } ${className}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold">{title}</p>
        {caption && <p className="mt-1 text-xs opacity-75">{caption}</p>}
      </div>
      <span
        className={`mt-0.5 h-4 w-4 rounded-full border ${
          selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
        }`}
      />
    </div>
    {children}
  </button>
);

const UploadField = ({
  label,
  required = false,
  icon: Icon = FiUpload,
  selectedFile,
  existingUrl,
  onChange,
  accept,
  helperText,
  progress,
  actionLabel = 'Upload File',
  capture,
}) => (
  <div>
    <label className="block text-sm font-semibold text-gray-900 mb-2">
      {label}
      {required ? ' *' : ''}
    </label>

    <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-white p-4 transition hover:border-blue-400 hover:bg-blue-50/40">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon className="w-5 h-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900">
          {actionLabel}
        </span>
        <span className="block text-xs text-gray-500 mt-1">
          {helperText || 'Select a file from your device'}
        </span>
      </span>
      <span className="hidden sm:inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">
        Browse
      </span>
      <input
        type="file"
        className="hidden"
        accept={accept}
        onChange={onChange}
        capture={capture}
      />
    </label>

    {(selectedFile || existingUrl) && (
      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700 break-all">
            {selectedFile?.name ||
              getFileNameFromUrl(existingUrl, actionLabel.replace('Upload ', ''))}
          </p>
          {existingUrl && (
            <a
              href={existingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              <FiExternalLink className="w-4 h-4" />
              View current file
            </a>
          )}
        </div>

        {typeof progress === 'number' && progress > 0 && progress < 100 && (
          <div className="mt-3 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    )}
  </div>
);

const StepIndicator = ({ currentStep }) => {
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep === step.number;
          const isCompleted = currentStep > step.number;

          return (
            <div
              key={step.number}
              className="flex min-w-0 flex-1 flex-col items-center text-center"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                    : isCompleted
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <FiCheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <div className="mt-2 min-w-0">
                <p
                  className={`text-[11px] font-bold ${
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {String(step.number).padStart(2, '0')}
                </p>
                <p
                  className={`hidden truncate text-xs font-semibold sm:block ${
                    isActive ? 'text-gray-950' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

const ProviderOnboardingScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeRole, refreshUserData, isLoading: authLoading } = useAuth();

  const [reloadCount, setReloadCount] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dataCategories, setDataCategories] = useState([]);
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState(null);
  const [selectedMainCategoryIds, setSelectedMainCategoryIds] = useState([]);
  const [availableSubcategories, setAvailableSubcategories] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);

  const [nationalityStatus, setNationalityStatus] = useState('');
  const [preferredGender, setPreferredGender] = useState('any');
  const [experience, setExperience] = useState('');
  const [visaCategory, setVisaCategory] = useState('');
  const [visaNumber, setVisaNumber] = useState('');
  const [visaExpiry, setVisaExpiry] = useState(emptyDate());

  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bsb, setBsb] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const [tfnNumber, setTfnNumber] = useState('');
  const [abnNumber, setAbnNumber] = useState('');

  const [notificationPref, setNotificationPref] = useState('both');

  const [passportSelected, setPassportSelected] = useState(false);
  const [drivingLicenceSelected, setDrivingLicenceSelected] = useState(false);
  const [passportData, setPassportData] = useState({
    number: '',
    expiry: emptyDate(),
  });
  const [drivingLicenceData, setDrivingLicenceData] = useState({
    number: '',
    cardNumber: '',
    expiry: emptyDate(),
  });

  const [selectedFiles, setSelectedFiles] = useState({
    passport: null,
    drivingLicence: null,
    resume: null,
    certificates: null,
    verificationVideo: null,
  });
  const [existingDocuments, setExistingDocuments] = useState({
    passportUrl: '',
    drivingLicenceUrl: '',
    resumeUrl: '',
    certificatesUrl: '',
    verificationVideoUrl: '',
  });
  const [uploadProgress, setUploadProgress] = useState({});
  const [secureUploadSummary, setSecureUploadSummary] = useState(null);

  const newSignup = location.state?.newSignup === true;

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const applyExistingDetails = (providerDetails, categories, profile) => {
    if (profile?.name && !accountName) {
      setAccountName(profile.name);
    }

    if (!providerDetails) {
      return;
    }

    const profileDetails = providerDetails.profile || {};
    const bankingDetails = providerDetails.bankingDetails || {};
    const businessInformation = providerDetails.businessInformation || {};
    const notificationPreferences =
      providerDetails.notificationPreferences || {};
    const documents = providerDetails.documents || {};
    const passport = providerDetails.passport || {};
    const drivingLicence = providerDetails.drivingLicence || {};
    const existingServices = Array.isArray(profileDetails.servicesOffered)
      ? profileDetails.servicesOffered
      : [];

    setNationalityStatus(profileDetails.nationalityStatus || '');
    setPreferredGender(profileDetails.preferredGender || 'any');
    setExperience(
      profileDetails.experience != null
        ? String(profileDetails.experience)
        : '',
    );
    setVisaCategory(profileDetails.visaCategory || '');
    setVisaNumber(profileDetails.visaNumber || '');
    setVisaExpiry(parseStoredDate(profileDetails.visaExpiry));
    setSelectedServices(existingServices);

    setBankName(bankingDetails.bankName || '');
    setAccountName((current) => bankingDetails.accountName || current || '');
    setBsb(bankingDetails.bsb || '');
    setAccountNumber(bankingDetails.accountNumber || '');

    setTfnNumber(businessInformation.tfnNumber || '');
    setAbnNumber(businessInformation.abnNumber || '');

    setNotificationPref(notificationPreferences.preference || 'both');

    setPassportSelected(Boolean(documents.passportUrl || passport.number));
    setDrivingLicenceSelected(
      Boolean(documents.drivingLicenceUrl || drivingLicence.number),
    );
    setPassportData({
      number: passport.number || '',
      expiry: parseStoredDate(passport.expiry),
    });
    setDrivingLicenceData({
      number: drivingLicence.number || '',
      cardNumber: drivingLicence.cardNumber || '',
      expiry: parseStoredDate(drivingLicence.expiry),
    });

    setExistingDocuments({
      passportUrl: documents.passportUrl || '',
      drivingLicenceUrl: documents.drivingLicenceUrl || '',
      resumeUrl: documents.resumeUrl || '',
      certificatesUrl: documents.certificatesUrl || '',
      verificationVideoUrl: documents.verificationVideoUrl || '',
    });

    if (categories.length > 0 && existingServices.length > 0) {
      const inferredCategoryIds = categories
        .filter((category) =>
          getSubcategories(category).some((subcategory) =>
            existingServices.includes(normalizeItemLabel(subcategory)),
          ),
        )
        .map((category) => category.id);

      if (inferredCategoryIds.length > 0) {
        setSelectedMainCategoryIds(inferredCategoryIds);
        setSelectedMainCategoryId(inferredCategoryIds[0]);
      }
    }
  };

  useEffect(() => {
    if (currentStep > 1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialData = async () => {
      if (!user?.uid) {
        return;
      }

      setLoadingInitial(true);
      setLoadError('');

      try {
        if (activeRole !== 'client') {
          await switchActiveRole(user.uid, 'client').catch(() => undefined);
        }

        const [categories, providerDetails, latestProfile] = await Promise.all([
          fetchCategories(),
          fetchProviderDetails(user.uid).catch(() => null),
          fetchUserProfile(user.uid).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        const resolvedCategories = categories || [];
        setDataCategories(resolvedCategories);

        if (resolvedCategories.length > 0) {
          setSelectedMainCategoryId((current) => current || resolvedCategories[0].id);
        }

        applyExistingDetails(providerDetails, resolvedCategories, latestProfile);
      } catch (loadFailure) {
        if (!cancelled) {
          setLoadError(
            loadFailure.message ||
              'Failed to load onboarding details. Please try again.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      }
    };

    if (!authLoading) {
      loadInitialData();
    }

    return () => {
      cancelled = true;
    };
  }, [user?.uid, activeRole, authLoading, reloadCount]);

  useEffect(() => {
    if (!dataCategories.length) {
      setAvailableSubcategories([]);
      return;
    }

    const activeCategoryIds =
      selectedMainCategoryIds.length > 0
        ? selectedMainCategoryIds
        : selectedMainCategoryId
        ? [selectedMainCategoryId]
        : [dataCategories[0].id];

    const combined = [];

    activeCategoryIds.forEach((categoryId) => {
      const category = dataCategories.find((item) => item.id === categoryId);

      getSubcategories(category).forEach((subcategory) => {
        const key = normalizeItemLabel(subcategory);

        if (key && !combined.some((item) => normalizeItemLabel(item) === key)) {
          combined.push(subcategory);
        }
      });
    });

    setAvailableSubcategories(combined);
    setSelectedServices((current) =>
      current.filter((service) =>
        combined.some((item) => normalizeItemLabel(item) === service),
      ),
    );
  }, [dataCategories, selectedMainCategoryId, selectedMainCategoryIds]);

  const categorySummary = useMemo(() => {
    if (selectedMainCategoryIds.length > 0) {
      return `${selectedMainCategoryIds.length} category(ies) selected`;
    }

    return selectedMainCategoryId ? '1 category selected' : 'No categories selected';
  }, [selectedMainCategoryId, selectedMainCategoryIds]);

  const validateFile = (file, type) => {
    if (!file) {
      return null;
    }

    const maxSize = type === 'verificationVideo' ? MAX_VIDEO_SIZE : MAX_DOCUMENT_SIZE;

    if (file.size > maxSize) {
      return `Please select a file smaller than ${
        type === 'verificationVideo' ? '50MB' : '10MB'
      }.`;
    }

    if (type === 'passport' || type === 'drivingLicence') {
      const isJpeg =
        file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name || '');

      if (!isJpeg) {
        return `${
          type === 'passport' ? 'Passport' : 'Driving licence'
        } image must be a JPEG file.`;
      }
    }

    return null;
  };

  const handleFileSelect = (key, type) => (event) => {
    clearMessages();

    const file = event.target.files?.[0] || null;
    const validationMessage = validateFile(file, type);

    if (validationMessage) {
      setError(validationMessage);
      event.target.value = '';
      return;
    }

    setSelectedFiles((current) => ({
      ...current,
      [key]: file,
    }));
  };

  const toggleCategory = (categoryId) => {
    clearMessages();

    const isSelected = selectedMainCategoryIds.includes(categoryId);
    const nextSelected = isSelected
      ? selectedMainCategoryIds.filter((id) => id !== categoryId)
      : [...selectedMainCategoryIds, categoryId];

    setSelectedMainCategoryIds(nextSelected);
    setSelectedMainCategoryId(
      nextSelected[0] || dataCategories[0]?.id || categoryId || null,
    );
  };

  const toggleService = (serviceLabel) => {
    clearMessages();
    setSelectedServices((current) =>
      current.includes(serviceLabel)
        ? current.filter((item) => item !== serviceLabel)
        : [...current, serviceLabel],
    );
  };

  const hasSecureDocument = (documentTypes) => {
    const acceptedTypes = Array.isArray(documentTypes)
      ? documentTypes
      : [documentTypes];

    return (secureUploadSummary?.documents || []).some((document) => {
      const status = document.status || '';
      return (
        acceptedTypes.includes(document.documentType) &&
        ['uploaded', 'submitted', 'approved'].includes(status)
      );
    });
  };

  const validateStep = (step) => {
    if (step === 1) {
      if (!nationalityStatus) {
        return 'Please select your nationality status.';
      }
      if (!selectedServices.length) {
        return 'Please select at least one service you offer.';
      }
      if (!experience.trim()) {
        return 'Please enter your experience.';
      }
    }

    if (step === 2) {
      if (!bankName.trim()) {
        return 'Please enter your bank name.';
      }
      if (!accountName.trim()) {
        return 'Please enter your account name.';
      }
      if (!bsb.trim() || bsb.length !== 6 || !/^\d+$/.test(bsb)) {
        return 'BSB must be exactly 6 digits.';
      }
      if (!accountNumber.trim()) {
        return 'Please enter your account number.';
      }
    }

    if (step === 3) {
      if (!abnNumber.trim()) {
        return 'Please enter your ABN number.';
      }
    }

    if (step === 4) {
      if (!notificationPref) {
        return 'Please select your notification preference.';
      }
    }

    if (step === 5) {
      const hasPassport =
        passportSelected &&
        (selectedFiles.passport ||
          existingDocuments.passportUrl ||
          hasSecureDocument('passport'));
      const hasDrivingLicence =
        drivingLicenceSelected &&
        (selectedFiles.drivingLicence ||
          existingDocuments.drivingLicenceUrl ||
          hasSecureDocument([
            'driving_licence',
            'driving_license',
            'drivingLicence',
          ]));

      if (!hasPassport && !hasDrivingLicence) {
        return 'Please provide at least one ID proof: Passport or Driving Licence.';
      }

      if (passportSelected) {
        if (
          !passportData.number.trim() ||
          !passportData.expiry.day ||
          !passportData.expiry.month ||
          !passportData.expiry.year
        ) {
          return 'Please complete your passport number and expiry date.';
        }

        if (
          !selectedFiles.passport &&
          !existingDocuments.passportUrl &&
          !hasSecureDocument('passport')
        ) {
          return 'Please upload your passport image.';
        }
      }

      if (drivingLicenceSelected) {
        if (
          !drivingLicenceData.number.trim() ||
          !drivingLicenceData.cardNumber.trim() ||
          !drivingLicenceData.expiry.day ||
          !drivingLicenceData.expiry.month ||
          !drivingLicenceData.expiry.year
        ) {
          return 'Please complete your driving licence details.';
        }

        if (
          !selectedFiles.drivingLicence &&
          !existingDocuments.drivingLicenceUrl &&
          !hasSecureDocument([
            'driving_licence',
            'driving_license',
            'drivingLicence',
          ])
        ) {
          return 'Please upload your driving licence image.';
        }
      }

      if (
        !selectedFiles.resume &&
        !existingDocuments.resumeUrl &&
        !hasSecureDocument(['resume_cv', 'resume'])
      ) {
        return 'Please upload your resume or CV.';
      }

      if (
        !selectedFiles.certificates &&
        !existingDocuments.certificatesUrl &&
        !hasSecureDocument('certificates')
      ) {
        return 'Please upload your certificates.';
      }
    }

    return null;
  };

  const buildProviderDetails = (documents = {}, status = 'under_review') => ({
    profile: {
      nationalityStatus: nationalityStatus || null,
      servicesOffered: selectedServices,
      preferredGender: preferredGender || 'any',
      experience: experience || null,
      ...(visaCategory ? { visaCategory } : {}),
      ...(visaNumber ? { visaNumber: visaNumber.trim() } : {}),
      ...(formatStoredDate(visaExpiry)
        ? { visaExpiry: formatStoredDate(visaExpiry) }
        : {}),
    },
    bankingDetails: {
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      bsb: bsb.trim(),
      accountNumber: accountNumber.trim(),
    },
    businessInformation: {
      tfnNumber: tfnNumber.trim() || null,
      abnNumber: abnNumber.trim(),
    },
    notificationPreferences: {
      preference: notificationPref,
    },
    documents,
    ...(passportSelected && passportData.number.trim()
      ? {
          passport: {
            number: passportData.number.trim(),
            expiry: formatStoredDate(passportData.expiry),
          },
        }
      : {}),
    ...(drivingLicenceSelected && drivingLicenceData.number.trim()
      ? {
          drivingLicence: {
            number: drivingLicenceData.number.trim(),
            cardNumber: drivingLicenceData.cardNumber.trim(),
            expiry: formatStoredDate(drivingLicenceData.expiry),
          },
        }
      : {}),
    submittedAt: status === 'under_review' ? new Date().toISOString() : null,
    status,
  });

  const saveDraftForSecureUpload = async () => {
    if (!user?.uid) {
      throw new Error('User not authenticated.');
    }

    for (const stepNumber of [1, 2, 3, 4]) {
      const validationMessage = validateStep(stepNumber);
      if (validationMessage) {
        throw new Error(validationMessage);
      }
    }

    const legacyDocuments = Object.fromEntries(
      Object.entries(existingDocuments).filter(([, value]) => Boolean(value)),
    );
    await saveProviderOnboardingDraft(
      user.uid,
      buildProviderDetails(legacyDocuments, 'draft'),
    );
  };

  const handleNext = async () => {
    clearMessages();
    const validationMessage = validateStep(currentStep);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    if (currentStep < steps.length) {
      setCurrentStep((current) => current + 1);
      return;
    }

    setIsSubmitting(true);

    try {
      if (!user?.uid) {
        throw new Error('User not authenticated.');
      }

      const usingSecureDocuments = Boolean(
        secureUploadSummary?.sessionId ||
          secureUploadSummary?.hasUploadedDocuments ||
          secureUploadSummary?.isSubmitted,
      );

      const uploadSingleDocument = async ({
        file,
        existingUrl,
        targetKey,
        docType,
        progressKey,
        shouldInclude = true,
      }) => {
        if (usingSecureDocuments) {
          return existingUrl || '';
        }

        if (!shouldInclude) {
          return '';
        }

        if (!file) {
          return existingUrl || '';
        }

        setUploadProgress((current) => ({
          ...current,
          [progressKey]: 0,
        }));

        const uploadedUrl = await uploadProviderDocument(
          user.uid,
          file,
          docType,
          (progress) =>
            setUploadProgress((current) => ({
              ...current,
              [progressKey]: progress,
            })),
        );

        setExistingDocuments((current) => ({
          ...current,
          [targetKey]: uploadedUrl,
        }));

        return uploadedUrl;
      };

      const passportUrl = await uploadSingleDocument({
        file: selectedFiles.passport,
        existingUrl: existingDocuments.passportUrl,
        targetKey: 'passportUrl',
        docType: 'passport',
        progressKey: 'passport',
        shouldInclude: passportSelected,
      });

      const drivingLicenceUrl = await uploadSingleDocument({
        file: selectedFiles.drivingLicence,
        existingUrl: existingDocuments.drivingLicenceUrl,
        targetKey: 'drivingLicenceUrl',
        docType: 'driving_license',
        progressKey: 'drivingLicence',
        shouldInclude: drivingLicenceSelected,
      });

      const resumeUrl = await uploadSingleDocument({
        file: selectedFiles.resume,
        existingUrl: existingDocuments.resumeUrl,
        targetKey: 'resumeUrl',
        docType: 'resume',
        progressKey: 'resume',
      });

      const certificatesUrl = await uploadSingleDocument({
        file: selectedFiles.certificates,
        existingUrl: existingDocuments.certificatesUrl,
        targetKey: 'certificatesUrl',
        docType: 'certificates',
        progressKey: 'certificates',
      });

      const verificationVideoUrl = await uploadSingleDocument({
        file: selectedFiles.verificationVideo,
        existingUrl: existingDocuments.verificationVideoUrl,
        targetKey: 'verificationVideoUrl',
        docType: 'verification_video',
        progressKey: 'verificationVideo',
        shouldInclude:
          Boolean(selectedFiles.verificationVideo) ||
          Boolean(existingDocuments.verificationVideoUrl),
      });

      const documents = usingSecureDocuments
        ? {}
        : {
            ...(passportUrl ? { passportUrl } : {}),
            ...(drivingLicenceUrl ? { drivingLicenceUrl } : {}),
            ...(resumeUrl ? { resumeUrl } : {}),
            ...(certificatesUrl ? { certificatesUrl } : {}),
            ...(verificationVideoUrl ? { verificationVideoUrl } : {}),
          };

      const providerDetails = buildProviderDetails(documents, 'under_review');

      if (usingSecureDocuments) {
        await saveProviderDetailsWithSecureDocuments(user.uid, providerDetails, {
          sessionId: secureUploadSummary.sessionId,
          documentsMetadata: secureUploadSummary.documentsMetadata || {},
        });
      } else {
        await saveProviderDetails(user.uid, providerDetails);
      }
      await refreshUserData?.();
      await switchActiveRole(user.uid, 'client').catch(() => undefined);

      setSuccess('Your provider onboarding details have been submitted.');
      navigate('/provider/under-review', {
        replace: true,
        state: {
          justSubmitted: true,
          newSignup,
        },
      });
    } catch (submitError) {
      setError(
        submitError.message ||
          'Failed to submit your onboarding details. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderProfileStep = () => (
    <div className="space-y-7">
      <section>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          Nationality Status *
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {NATIONALITY_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              selected={nationalityStatus === option.value}
              title={option.label}
              caption={
                option.value === 'australian_citizen'
                  ? 'No expiry details needed'
                  : option.value === 'permanent_resident'
                  ? 'Add residency expiry'
                  : 'Add visa details'
              }
              className="min-h-[5.25rem]"
              onClick={() => {
                clearMessages();
                setNationalityStatus(option.value);
              }}
            />
          ))}
        </div>

        {nationalityStatus === 'visa_holder' && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Visa Category
                </label>
                <select
                  value={visaCategory}
                  onChange={(event) => {
                    clearMessages();
                    setVisaCategory(event.target.value);
                  }}
                  className={controlClass}
                >
                  <option value="">Select Visa Category</option>
                  {VISA_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {visaCategory === 'other' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-semibold text-gray-900">
                      Visa Number
                    </label>
                    <span className="text-xs text-blue-600 inline-flex items-center gap-1">
                      <FiInfo className="w-3.5 h-3.5" />
                      Grant or subclass identifier
                    </span>
                  </div>
                  <input
                    type="text"
                    value={visaNumber}
                    onChange={(event) => {
                      clearMessages();
                      setVisaNumber(event.target.value);
                    }}
                    className={controlClass}
                    placeholder="Enter Visa Number"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {(nationalityStatus === 'visa_holder' ||
          nationalityStatus === 'permanent_resident') && (
          <div className="mt-5">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              {nationalityStatus === 'permanent_resident'
                ? 'Permanent Resident Expiry Date'
                : 'Visa Expiry Date'}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={visaExpiry.day}
                onChange={(event) => {
                  clearMessages();
                  setVisaExpiry((current) => ({
                    ...current,
                    day: event.target.value,
                  }));
                }}
                className={compactControlClass}
              >
                <option value="">Day</option>
                {DAYS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={visaExpiry.month}
                onChange={(event) => {
                  clearMessages();
                  setVisaExpiry((current) => ({
                    ...current,
                    month: event.target.value,
                  }));
                }}
                className={compactControlClass}
              >
                <option value="">Month</option>
                {MONTHS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={visaExpiry.year}
                onChange={(event) => {
                  clearMessages();
                  setVisaExpiry((current) => ({
                    ...current,
                    year: event.target.value,
                  }));
                }}
                className={compactControlClass}
              >
                <option value="">Year</option>
                {FUTURE_YEARS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h3 className="text-base font-bold text-gray-950">Services Offered</h3>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
            {categorySummary}
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap gap-2">
            {dataCategories.map((category) => {
              const label = normalizeItemLabel(category);
              const selected = selectedMainCategoryIds.includes(category.id);

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableSubcategories.length === 0 ? (
              <p className="text-sm text-gray-500 sm:col-span-2 lg:col-span-3">
                No subcategories available for the selected category yet.
              </p>
            ) : (
              availableSubcategories.map((subcategory) => {
                const label = normalizeItemLabel(subcategory);
                const selected = selectedServices.includes(label);

                return (
                  <button
                    key={`${subcategory.id || label}`}
                    type="button"
                    onClick={() => toggleService(label)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${
                      selected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-300'
                    }`}
                  >
                    {label}
                  </button>
                );
              })
            )}
          </div>
          <p className="mt-4 text-xs font-semibold text-gray-500">
            {selectedServices.length} service(s) selected
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Preferred Gender
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PREFERRED_GENDER_OPTIONS.map((option) => (
              <ChoiceCard
                key={option.value}
                selected={preferredGender === option.value}
                title={option.label}
                className="min-h-[4.25rem]"
                onClick={() => {
                  clearMessages();
                  setPreferredGender(option.value);
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Experience *
          </label>
          <select
            value={experience}
            onChange={(event) => {
              clearMessages();
              setExperience(event.target.value);
            }}
            className={controlClass}
          >
            <option value="">Select Experience</option>
            {EXPERIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );

  const renderBankingStep = () => (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Bank Name *
            </label>
            <select
              value={bankName}
              onChange={(event) => {
                clearMessages();
                setBankName(event.target.value);
              }}
              className={controlClass}
            >
              <option value="">Select Bank</option>
              {BANK_LIST.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Account Name *
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(event) => {
                clearMessages();
                setAccountName(event.target.value);
              }}
              className={controlClass}
              placeholder="Enter account holder name"
            />
            <p className="mt-2 text-xs text-gray-500">
              Your name must match the name registered with your bank.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              BSB (6 digits) *
            </label>
            <input
              type="text"
              value={bsb}
              onChange={(event) => {
                clearMessages();
                setBsb(event.target.value.replace(/[^0-9]/g, '').slice(0, 6));
              }}
              className={controlClass}
              placeholder="123456"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Account Number *
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(event) => {
                clearMessages();
                setAccountNumber(event.target.value);
              }}
              className={controlClass}
              placeholder="Enter account number"
              inputMode="numeric"
            />
          </div>
        </div>
      </section>
    </div>
  );

  const renderBusinessStep = () => (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              TFN Number
            </label>
            <input
              type="text"
              value={tfnNumber}
              onChange={(event) => {
                clearMessages();
                setTfnNumber(event.target.value);
              }}
              className={controlClass}
              placeholder="Enter TFN number"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              ABN Number *
            </label>
            <input
              type="text"
              value={abnNumber}
              onChange={(event) => {
                clearMessages();
                setAbnNumber(event.target.value);
              }}
              className={controlClass}
              placeholder="Enter ABN number"
              inputMode="numeric"
            />
          </div>
        </div>
      </section>
    </div>
  );

  const renderNotificationsStep = () => (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Notification Preferences
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Choose how you&apos;d like to receive booking notifications.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NOTIFICATION_OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              selected={notificationPref === option.value}
              title={option.label}
              caption={
                option.value === 'both'
                  ? 'Best for urgent booking updates'
                  : option.value === 'none'
                  ? 'You can still check updates in-app'
                  : 'Use one notification channel'
              }
              className="min-h-[5.25rem]"
              onClick={() => {
                clearMessages();
                setNotificationPref(option.value);
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );

  const renderDocumentsStep = () => (
    <div className="space-y-6">
      <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950">Documents</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Upload identity, resume, certificates, and any optional
              verification video.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">
            JPEG, PDF, DOC supported
          </span>
        </div>
      </section>

      <MobileUploadCard
        providerId={user.uid}
        registrationStep="provider_onboarding_documents"
        verifiedMobileNumber={user.phone || user.phoneNumber}
        onSummaryChange={setSecureUploadSummary}
        onBeforeCreateSession={saveDraftForSecureUpload}
      />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className={`rounded-xl border bg-white p-4 transition ${
            passportSelected
              ? 'border-blue-300 shadow-sm'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  passportSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <FiFileText className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-950">
                  Passport
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  Use if passport is your primary identity document.
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={passportSelected}
              onChange={(event) => {
                clearMessages();
                const enabled = event.target.checked;
                setPassportSelected(enabled);

                if (!enabled) {
                  setPassportData({ number: '', expiry: emptyDate() });
                  setSelectedFiles((current) => ({ ...current, passport: null }));
                  setExistingDocuments((current) => ({
                    ...current,
                    passportUrl: '',
                  }));
                }
              }}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          {passportSelected && (
            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Passport Number *
                </label>
                <input
                  type="text"
                  value={passportData.number}
                  onChange={(event) => {
                    clearMessages();
                    setPassportData((current) => ({
                      ...current,
                      number: event.target.value,
                    }));
                  }}
                  className={controlClass}
                  placeholder="Enter passport number"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Passport Expiry Date *
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <select
                    value={passportData.expiry.day}
                    onChange={(event) => {
                      clearMessages();
                      setPassportData((current) => ({
                        ...current,
                        expiry: {
                          ...current.expiry,
                          day: event.target.value,
                        },
                      }));
                    }}
                    className={compactControlClass}
                  >
                    <option value="">Day</option>
                    {DAYS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={passportData.expiry.month}
                    onChange={(event) => {
                      clearMessages();
                      setPassportData((current) => ({
                        ...current,
                        expiry: {
                          ...current.expiry,
                          month: event.target.value,
                        },
                      }));
                    }}
                    className={compactControlClass}
                  >
                    <option value="">Month</option>
                    {MONTHS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={passportData.expiry.year}
                    onChange={(event) => {
                      clearMessages();
                      setPassportData((current) => ({
                        ...current,
                        expiry: {
                          ...current.expiry,
                          year: event.target.value,
                        },
                      }));
                    }}
                    className={compactControlClass}
                  >
                    <option value="">Year</option>
                    {FUTURE_YEARS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {hasSecureDocument('passport') ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  Passport image uploaded through secure document upload.
                </div>
              ) : (
                <UploadField
                  label="Passport Image"
                  required
                  icon={FiImage}
                  selectedFile={selectedFiles.passport}
                  existingUrl={existingDocuments.passportUrl}
                  onChange={handleFileSelect('passport', 'passport')}
                  accept="image/jpeg,image/jpg"
                  helperText="JPEG only"
                  progress={uploadProgress.passport}
                  actionLabel="Upload Passport Image"
                />
              )}
            </div>
          )}
        </div>

        <div
          className={`rounded-xl border bg-white p-4 transition ${
            drivingLicenceSelected
              ? 'border-blue-300 shadow-sm'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  drivingLicenceSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <FiCreditCard className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-950">
                  Driving Licence
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  Use if licence is your primary identity document.
                </span>
              </span>
            </span>
            <input
              type="checkbox"
              checked={drivingLicenceSelected}
              onChange={(event) => {
                clearMessages();
                const enabled = event.target.checked;
                setDrivingLicenceSelected(enabled);

                if (!enabled) {
                  setDrivingLicenceData({
                    number: '',
                    cardNumber: '',
                    expiry: emptyDate(),
                  });
                  setSelectedFiles((current) => ({
                    ...current,
                    drivingLicence: null,
                  }));
                  setExistingDocuments((current) => ({
                    ...current,
                    drivingLicenceUrl: '',
                  }));
                }
              }}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          {drivingLicenceSelected && (
            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Licence Number *
                  </label>
                  <input
                    type="text"
                    value={drivingLicenceData.number}
                    onChange={(event) => {
                      clearMessages();
                      setDrivingLicenceData((current) => ({
                        ...current,
                        number: event.target.value,
                      }));
                    }}
                    className={controlClass}
                    placeholder="Enter licence number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Card Number *
                  </label>
                  <input
                    type="text"
                    value={drivingLicenceData.cardNumber}
                    onChange={(event) => {
                      clearMessages();
                      setDrivingLicenceData((current) => ({
                        ...current,
                        cardNumber: event.target.value,
                      }));
                    }}
                    className={controlClass}
                    placeholder="Enter card number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Licence Expiry Date *
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <select
                    value={drivingLicenceData.expiry.day}
                    onChange={(event) => {
                      clearMessages();
                      setDrivingLicenceData((current) => ({
                        ...current,
                        expiry: {
                          ...current.expiry,
                          day: event.target.value,
                        },
                      }));
                    }}
                    className={compactControlClass}
                  >
                    <option value="">Day</option>
                    {DAYS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={drivingLicenceData.expiry.month}
                    onChange={(event) => {
                      clearMessages();
                      setDrivingLicenceData((current) => ({
                        ...current,
                        expiry: {
                          ...current.expiry,
                          month: event.target.value,
                        },
                      }));
                    }}
                    className={compactControlClass}
                  >
                    <option value="">Month</option>
                    {MONTHS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={drivingLicenceData.expiry.year}
                    onChange={(event) => {
                      clearMessages();
                      setDrivingLicenceData((current) => ({
                        ...current,
                        expiry: {
                          ...current.expiry,
                          year: event.target.value,
                        },
                      }));
                    }}
                    className={compactControlClass}
                  >
                    <option value="">Year</option>
                    {FUTURE_YEARS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {hasSecureDocument([
                'driving_licence',
                'driving_license',
                'drivingLicence',
              ]) ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  Driving licence image uploaded through secure document upload.
                </div>
              ) : (
                <UploadField
                  label="Driving Licence Image"
                  required
                  icon={FiImage}
                  selectedFile={selectedFiles.drivingLicence}
                  existingUrl={existingDocuments.drivingLicenceUrl}
                  onChange={handleFileSelect(
                    'drivingLicence',
                    'drivingLicence',
                  )}
                  accept="image/jpeg,image/jpg"
                  helperText="JPEG only"
                  progress={uploadProgress.drivingLicence}
                  actionLabel="Upload Driving Licence"
                />
              )}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-950">
            Professional Files
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Add documents that help admins verify your qualifications.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {hasSecureDocument(['resume_cv', 'resume']) ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Resume / CV uploaded through secure document upload.
            </div>
          ) : (
            <UploadField
              label="Resume / CV"
              required
              icon={FiFileText}
              selectedFile={selectedFiles.resume}
              existingUrl={existingDocuments.resumeUrl}
              onChange={handleFileSelect('resume', 'resume')}
              accept=".pdf,.doc,.docx,image/*"
              helperText="Accepted up to 10MB"
              progress={uploadProgress.resume}
              actionLabel="Upload Resume / CV"
            />
          )}

          {hasSecureDocument('certificates') ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Certificates uploaded through secure document upload.
            </div>
          ) : (
            <UploadField
              label="Certificates"
              required
              icon={FiFileText}
              selectedFile={selectedFiles.certificates}
              existingUrl={existingDocuments.certificatesUrl}
              onChange={handleFileSelect('certificates', 'certificates')}
              accept=".pdf,.doc,.docx,image/*"
              helperText="Accepted up to 10MB"
              progress={uploadProgress.certificates}
              actionLabel="Upload Certificates"
            />
          )}

          <div className="lg:col-span-2">
            {hasSecureDocument('verification_video') ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                Verification video uploaded through secure document upload.
              </div>
            ) : (
              <UploadField
                label="Verification Video"
                icon={FiVideo}
                selectedFile={selectedFiles.verificationVideo}
                existingUrl={existingDocuments.verificationVideoUrl}
                onChange={handleFileSelect(
                  'verificationVideo',
                  'verificationVideo',
                )}
                accept="video/*"
                helperText="Optional, up to 50MB"
                progress={uploadProgress.verificationVideo}
                actionLabel="Upload Verification Video"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );

  const renderCurrentStep = () => {
    if (currentStep === 1) {
      return renderProfileStep();
    }
    if (currentStep === 2) {
      return renderBankingStep();
    }
    if (currentStep === 3) {
      return renderBusinessStep();
    }
    if (currentStep === 4) {
      return renderNotificationsStep();
    }
    return renderDocumentsStep();
  };

  if (authLoading || loadingInitial) {
    return <Loading fullScreen />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <ErrorMessage
            error={{ message: loadError }}
            onRetry={() => setReloadCount((current) => current + 1)}
          />
        </div>
      </div>
    );
  }

  const currentStepMeta = steps[currentStep - 1] || steps[0];
  const CurrentStepIcon = currentStepMeta.icon;

  return (
    <div className="min-h-screen bg-white p-4 sm:p-5">
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-8 lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(22rem,45vw)_1fr] lg:gap-12">
      <aside className="relative min-h-[20rem] overflow-hidden rounded-2xl bg-gray-950 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
        <img
          src="/images/SSaloon.jpg"
          alt="My Local Force services"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950/42 via-blue-950/16 to-gray-950/52" />

        <div className="relative flex h-full min-h-[20rem] flex-col justify-between p-6 text-white sm:p-8 lg:min-h-full lg:p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/12 backdrop-blur">
                <img
                  src="/images/MLF.jpg"
                  alt="My Local Force"
                  className="h-7 w-7 rounded object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-bold">My Local Force</p>
              </div>
            </div>
          </div>

          <div className="max-w-md py-10 lg:py-0">
            <p className="text-sm font-semibold text-blue-100">
              Provider Setup
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
              Complete your profile for review.
            </h1>
            <p className="mt-4 text-base leading-7 text-white/78">
              Add your services, payment details, business information, and
              documents so the admin team can approve your account.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
              <FiShield className="mb-3 h-5 w-5 text-blue-100" />
              <p className="text-sm font-bold">Secure review</p>
              <p className="mt-1 text-xs text-white/65">Submitted to admin</p>
            </div>
            <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
              <CurrentStepIcon className="mb-3 h-5 w-5 text-blue-100" />
              <p className="text-sm font-bold">
                Step {currentStep} of {steps.length}
              </p>
              <p className="mt-1 truncate text-xs text-white/65">
                {currentStepMeta.title}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-screen w-full max-w-[58rem] flex-col px-5 py-6 sm:px-8 lg:px-14">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/provider')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              <FiArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>

          <div className="flex-1 py-9 sm:py-12 lg:py-16">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-blue-600">
                Provider onboarding
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
                {currentStepMeta.title}
              </h2>
              <p className="mt-3 text-base leading-7 text-gray-600">
                Step {currentStep} of {steps.length}. Complete this section to
                move your profile closer to admin approval.
              </p>
            </div>

            <div className="mt-8 max-w-4xl">
              <StepIndicator currentStep={currentStep} />
            </div>

            <div className="mt-9 max-w-4xl">
              {newSignup && (
                <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm text-emerald-700">
                      Your provider account has been created. Finish onboarding
                      to submit it for admin approval.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm text-emerald-700">{success}</p>
                  </div>
                </div>
              )}

              {renderCurrentStep()}

              <div className="mt-10 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearMessages();
                        setCurrentStep((current) => Math.max(current - 1, 1));
                      }}
                      disabled={isSubmitting}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-70 sm:w-auto"
                    >
                      <FiChevronLeft className="h-4 w-4" />
                      Back
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition hover:bg-blue-700 disabled:opacity-70 sm:w-auto sm:min-w-48"
                >
                  {isSubmitting ? (
                    <>
                      <FiRefreshCw className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      {currentStep === steps.length
                        ? 'Submit for review'
                        : 'Continue'}
                      {currentStep < steps.length && (
                        <FiChevronRight className="h-4 w-4" />
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
};

export default ProviderOnboardingScreen;
