import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiBriefcase,
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiLogIn,
  FiShield,
  FiUser,
} from 'react-icons/fi';

const roles = [
  {
    id: 'customer',
    title: 'Customer',
    subtitle: 'Book local services, track bookings, and manage your profile.',
    image: '/images/customer.webp',
    path: '/signup/customer',
    accent: 'border-blue-200 hover:border-blue-500 hover:shadow-blue-100',
    tone: 'text-blue-600 bg-blue-50',
    icon: FiCalendar,
    stats: 'Fast booking',
  },
  {
    id: 'provider',
    title: 'Service Provider',
    subtitle: 'Create your provider profile and complete onboarding for review.',
    image: '/images/provider.webp',
    path: '/signup/provider',
    accent: 'border-emerald-200 hover:border-emerald-500 hover:shadow-emerald-100',
    tone: 'text-emerald-600 bg-emerald-50',
    icon: FiBriefcase,
    stats: 'Earn locally',
  },
];

const SignupSelectionScreen = () => {
  const navigate = useNavigate();

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

            <div className="max-w-md py-10 lg:py-0">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-100">
                Start here
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                Choose how you want to join.
              </h1>
              <p className="mt-4 text-base leading-7 text-white/78">
                Book trusted local services as a customer, or create a provider
                profile and continue into onboarding for review.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiUser className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Customers</p>
                <p className="mt-1 text-xs text-white/65">Book in minutes</p>
              </div>
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiShield className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Providers</p>
                <p className="mt-1 text-xs text-white/65">Verified review</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-h-screen bg-white">
          <div className="mx-auto flex min-h-screen w-full max-w-[52rem] flex-col px-1 py-2 sm:px-4 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition hover:text-gray-950"
              >
                <FiArrowLeft className="h-4 w-4" />
                Back
              </button>

              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 text-base font-medium text-blue-600 transition hover:text-blue-700"
              >
                <FiLogIn className="h-4 w-4" />
                Login
              </button>
            </div>

            <div className="flex flex-1 items-center py-10 sm:py-12 lg:py-16">
              <div className="w-full">
                <div className="mb-9">
                  <h2 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
                    Let&apos;s get started
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">
                    Select the account type that matches what you want to do
                    today.
                  </p>
                </div>

                <div className="space-y-5">
                  {roles.map((role) => {
                    const Icon = role.icon;

                    return (
                      <button
                        key={role.id}
                        onClick={() => navigate(role.path)}
                        className={`group w-full rounded-xl border bg-white p-5 text-left shadow-[0_14px_35px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-xl ${role.accent}`}
                      >
                        <div className="flex items-center gap-5">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                            <img
                              src={role.image}
                              alt={role.title}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${role.tone}`}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                {role.stats}
                              </span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-950">
                              {role.title}
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-gray-600">
                              {role.subtitle}
                            </p>
                          </div>

                          <FiChevronRight className="h-5 w-5 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-9 grid grid-cols-1 gap-3 border-t border-gray-100 pt-6 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <FiClock className="mb-3 h-5 w-5 text-blue-600" />
                    <p className="text-sm font-bold text-gray-950">
                      Quick setup
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Email and phone verification included.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <FiShield className="mb-3 h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-bold text-gray-950">
                      Secure review
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Provider profiles are reviewed before activation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SignupSelectionScreen;
