import React, { useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCheckSquare,
  FiEdit,
  FiExternalLink,
  FiFileText,
  FiUser,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { fetchProviderDetails } from '../services/firebase';
import { notify } from '../utils/toast';

const documentTypes = [
  { key: 'passportUrl', uploadType: 'passport', label: 'Passport / ID Proof' },
  { key: 'drivingLicenceUrl', uploadType: 'drivingLicence', label: 'Driving Licence' },
  { key: 'resumeUrl', uploadType: 'resume', label: 'Resume / CV' },
  { key: 'certificatesUrl', uploadType: 'certificates', label: 'Certificates' },
  { key: 'verificationVideoUrl', uploadType: 'verificationVideo', label: 'Verification Video' },
];

const secureDocumentFieldByKey = {
  passportUrl: 'passport',
  drivingLicenceUrl: 'drivingLicence',
  resumeUrl: 'resume',
  certificatesUrl: 'certificates',
  verificationVideoUrl: 'verificationVideo',
};

const getDocumentState = (documents, docConfig) => {
  const url = documents?.[docConfig.key] || '';
  const secureField = secureDocumentFieldByKey[docConfig.key];
  const secureDocument = secureField ? documents?.[secureField] : null;
  const hasSecureDocument = Boolean(
    secureDocument?.uploadMode === 'secure_v2' ||
      secureDocument?.documentIds?.length ||
      secureDocument?.files?.length ||
      secureDocument?.storagePaths?.length
  );

  return {
    url: hasSecureDocument ? '' : url,
    uploaded: Boolean(url || hasSecureDocument),
  };
};

const statusConfig = {
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-rose-50 text-rose-700' },
  pending: { label: 'Under Review', className: 'bg-amber-50 text-amber-700' },
  under_review: { label: 'Under Review', className: 'bg-amber-50 text-amber-700' },
};

const formatNationalityStatus = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'australian_citizen') return 'Australian Citizen';
  if (normalized === 'permanent_resident') return 'Permanent Resident';
  if (normalized === 'visa_holder') return 'VISA Holder';
  return value || 'Not set';
};

const ProviderDocumentsScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDetails = async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      setDetails(await fetchProviderDetails(user.uid));
    } catch (error) {
      notify.error('Failed to load provider details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [user?.uid]);

  const documents = details?.documents || {};
  const approvalStatus = user?.approvalStatus || details?.status || 'pending';
  const status = statusConfig[approvalStatus] || statusConfig.pending;

  const servicesOffered = useMemo(() => {
    const raw = details?.servicesOffered || details?.profile?.servicesOffered || [];
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }, [details]);

  if (loading) return <Loading fullScreen />;

  if (!details) {
    return (
      <ProviderAppLayout>
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
          <FiFileText className="mx-auto h-16 w-16 text-slate-300" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">No Details Submitted</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-500">
            Complete onboarding to submit your profile details and documents.
          </p>
          <button
            type="button"
            onClick={() => navigate('/provider/edit-details')}
            className="mt-6 rounded-lg bg-[#5A52E3] px-5 py-2.5 font-black text-white"
          >
            Edit Details
          </button>
        </div>
        <Footer />
      </ProviderAppLayout>
    );
  }

  return (
    <ProviderAppLayout>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">My Details & Documents</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Review your submitted provider details and documents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/provider/edit-details')}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-[#5A52E3] shadow-sm hover:bg-indigo-50"
        >
          <FiEdit className="h-4 w-4" />
          Edit Details
        </button>
      </header>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FiCheckSquare className="h-5 w-5 text-[#5A52E3]" />
            <h2 className="text-lg font-black text-slate-950">Account Status</h2>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>
            {status.label}
          </span>
        </div>
        {details.rejectionReason ? (
          <div className="mt-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {details.rejectionReason}
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FiUser className="h-5 w-5 text-[#5A52E3]" />
          <h2 className="text-lg font-black text-slate-950">Profile Summary</h2>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <DetailRow
            label="Nationality"
            value={formatNationalityStatus(
              details.nationalityStatus || details.profile?.nationalityStatus
            )}
          />
          <DetailRow
            label="VISA Category"
            value={details.visaCategory || details.profile?.visaCategory || 'Not set'}
          />
          <DetailRow
            label="VISA Number"
            value={details.visaNumber || details.profile?.visaNumber || 'Not set'}
          />
          <DetailRow
            label="Services Offered"
            value={servicesOffered.length ? servicesOffered.join(', ') : 'Not set'}
            last
          />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Documents</h2>
        <div className="mt-4 grid gap-3">
          {documentTypes.map((docConfig) => {
            const { url, uploaded } = getDocumentState(documents, docConfig);
            return (
              <div
                key={docConfig.key}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-black text-slate-950">{docConfig.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {uploaded ? (url ? 'Uploaded' : 'Secure document uploaded') : 'Not uploaded'}
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
                  ) : (
                    <span className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-400">
                      No file
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Footer />
    </ProviderAppLayout>
  );
};

const DetailRow = ({ label, value, last = false }) => (
  <div
    className={`grid gap-2 px-4 py-3 sm:grid-cols-[220px_1fr] ${last ? '' : 'border-b border-slate-100'}`}
  >
    <p className="text-sm font-bold text-slate-500">{label}</p>
    <p className="text-sm font-black text-slate-900">{value}</p>
  </div>
);

export default ProviderDocumentsScreen;
