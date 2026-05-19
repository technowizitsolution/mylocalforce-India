import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, ShieldCheck } from 'lucide-react';
import Footer from './Footer';
import PublicNavbar from './PublicNavbar';
import { getDefaultPolicy, getPolicy } from '../services/firebase/policyService';

const TERMS_TABS = [
  {
    id: 'termsCustomer',
    label: 'Customer',
    path: '/terms-and-conditions/customer',
    fallbackTitle: 'Customer Terms and Conditions',
  },
  {
    id: 'termsProvider',
    label: 'Provider',
    path: '/terms-and-conditions/provider',
    fallbackTitle: 'Provider Terms and Conditions',
  },
];

const formatDate = (value) => {
  if (!value) return 'Not published yet';

  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'Not published yet';
  }
};

const paragraphsFromText = (text) => {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
};

const SectionContent = ({ section }) => {
  const blocks = Array.isArray(section.blocks) ? section.blocks : null;

  if (blocks) {
    return (
      <div className="space-y-4">
        {blocks.map((block, index) => {
          const key = block.id || `${block.type || 'block'}-${index}`;
          if (block.type === 'subheading') {
            return (
              <h3 key={key} className="text-xs font-semibold text-slate-900">
                {block.content}
              </h3>
            );
          }

          return paragraphsFromText(block.content).map((paragraph, paragraphIndex) => (
            <p
              key={`${key}-${paragraphIndex}`}
              className="text-[11px] leading-5 text-slate-700 sm:text-xs"
            >
              {paragraph}
            </p>
          ));
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {paragraphsFromText(section.content).map((paragraph, index) => (
        <p key={index} className="text-[11px] leading-5 text-slate-700 sm:text-xs">
          {paragraph}
        </p>
      ))}
    </div>
  );
};

const PolicyDocument = ({ policy, loading }) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 p-5">
            <div className="mb-4 h-5 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="space-y-2">
              <div className="h-3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const sections = Array.isArray(policy?.sections) ? policy.sections : [];

  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <section
          key={section.id || index}
          className="rounded-lg border border-slate-200 bg-white px-4 py-4 sm:px-5"
        >
          <div className="mb-3 flex min-w-0 items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
              {index + 1}
            </span>
            <h2 className="text-xs font-semibold text-slate-950 sm:text-sm">
              {section.heading || `Section ${index + 1}`}
            </h2>
          </div>
          <div>
            <SectionContent section={section} />
          </div>
        </section>
      ))}
    </div>
  );
};

const LegalPolicyPage = ({ type = 'privacy' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);

  const activeTermsTab = useMemo(() => {
    if (location.pathname.includes('/provider')) return TERMS_TABS[1];
    return TERMS_TABS[0];
  }, [location.pathname]);

  const policyId = type === 'terms' ? activeTermsTab.id : 'privacyPolicy';
  const pageTitle = type === 'terms' ? 'Terms and Conditions' : 'Privacy Policy';
  const pageDescription =
    type === 'terms'
      ? 'Review the current My Local Force terms for customers and providers.'
      : 'Review the current My Local Force privacy policy.';

  useEffect(() => {
    let isCurrent = true;

    const loadPolicy = (showLoading = false) => {
      if (showLoading) setLoading(true);

      getPolicy(policyId)
        .then((nextPolicy) => {
          if (!isCurrent) return;
          setPolicy(nextPolicy);
          setLoading(false);
        })
        .catch((error) => {
          console.warn(`Unable to load ${policyId}`, error);
          if (!isCurrent) return;
          setPolicy(getDefaultPolicy(policyId));
          setLoading(false);
        });
    };

    loadPolicy(true);
    const refreshTimer = window.setInterval(() => loadPolicy(false), 30000);

    return () => {
      isCurrent = false;
      window.clearInterval(refreshTimer);
    };
  }, [policyId]);

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicNavbar />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                {type === 'terms' ? (
                  <FileText className="h-5 w-5" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-950 sm:text-xl">{pageTitle}</h1>
                <p className="mt-2 max-w-2xl text-[11px] leading-5 text-slate-600 sm:text-xs">
                  {policy?.description || pageDescription}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Last updated: {formatDate(policy?.lastUpdated)}
                </p>
              </div>
            </div>
          </div>

          {type === 'terms' ? (
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
              {TERMS_TABS.map((tab) => {
                const isActive = tab.id === activeTermsTab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => navigate(tab.path)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <PolicyDocument policy={policy} loading={loading} />
      </main>

      <Footer />
    </div>
  );
};

export default LegalPolicyPage;
