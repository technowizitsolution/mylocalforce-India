import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  FiArrowRight,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiRefreshCw,
  FiShield,
  FiUser,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { switchActiveRole } from '../services/firebase/userService';
import { notify, getUserFacingError } from '../utils/toast';
import { Loading } from '../components/StateComponents';

const roleMeta = {
  customer: {
    title: 'Customer',
    subtitle: 'Book local services, manage bookings, and update your profile.',
    path: '/customer',
    icon: FiUser,
    image: '/images/customer.webp',
    tone: 'text-blue-700 bg-blue-50 border-blue-100',
    button: 'bg-blue-600 hover:bg-blue-700',
    badge: 'Customer mode',
  },
  client: {
    title: 'Service Provider',
    subtitle: 'Manage provider onboarding, review status, and provider tools.',
    path: '/provider',
    icon: FiBriefcase,
    image: '/images/provider.webp',
    tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    badge: 'Provider mode',
  },
};

const RoleSelectionScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, userRoles, isLoading, refreshUserData } = useAuth();
  const [selectingRole, setSelectingRole] = useState(null);

  const roles = useMemo(
    () => userRoles?.roles || user?.roles || {},
    [user?.roles, userRoles?.roles]
  );

  const availableRoles = useMemo(
    () => ['customer', 'client'].filter((role) => roles?.[role]),
    [roles]
  );

  if (isLoading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (availableRoles.length === 1) {
    return <Navigate to={roleMeta[availableRoles[0]].path} replace />;
  }

  const handleSelectRole = async (role) => {
    if (!user?.uid || selectingRole) return;

    setSelectingRole(role);

    try {
      await switchActiveRole(user.uid, role);
      await refreshUserData?.();
      notify.success(`Switched to ${roleMeta[role].title}.`, {
        id: 'role-selection',
      });
      navigate(roleMeta[role].path, { replace: true });
    } catch (error) {
      notify.error(getUserFacingError(error, 'Could not switch role.'), {
        id: 'role-selection',
      });
      setSelectingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 sm:p-5">
      <div className="grid min-h-[calc(100vh-2rem)] grid-cols-1 gap-8 lg:min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(22rem,42vw)_1fr] lg:gap-12">
        <aside className="relative min-h-[20rem] overflow-hidden rounded-2xl bg-gray-950 lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)]">
          <img
            src="/images/SSaloon.jpg"
            alt="My Local Force services"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/45 via-blue-950/18 to-gray-950/60" />

          <div className="relative flex h-full min-h-[20rem] flex-col justify-between p-6 text-white sm:p-8 lg:min-h-full lg:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/12 backdrop-blur">
                <img
                  src="/images/MLF.jpg"
                  alt="My Local Force"
                  className="h-7 w-7 rounded object-cover"
                />
              </div>
              <p className="text-sm font-bold">My Local Force</p>
            </div>

            <div className="max-w-md py-10 lg:py-0">
              <p className="text-sm font-bold uppercase tracking-wide text-blue-100">Choose role</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                Continue with the right workspace.
              </h1>
              <p className="mt-4 text-base leading-7 text-white/78">
                Select Customer or Service Provider. We will remember your active role until you
                switch again.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiCalendar className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Book services</p>
                <p className="mt-1 text-xs text-white/65">Customer home</p>
              </div>
              <div className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <FiShield className="mb-3 h-5 w-5 text-blue-100" />
                <p className="text-sm font-bold">Provider tools</p>
                <p className="mt-1 text-xs text-white/65">Provider home</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-h-screen bg-white">
          <div className="mx-auto flex min-h-screen w-full max-w-[46rem] flex-col px-1 py-2 sm:px-4 lg:px-8">
            <div className="flex flex-1 items-center py-10 sm:py-12 lg:py-16">
              <div className="w-full">
                <div className="mb-9">
                  <h2 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
                    Select your role
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">
                    Your account has access to more than one role. Pick where you want to go next.
                  </p>
                </div>

                <div className="space-y-5">
                  {availableRoles.map((role) => {
                    const meta = roleMeta[role];
                    const Icon = meta.icon;
                    const isSelecting = selectingRole === role;

                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleSelectRole(role)}
                        disabled={Boolean(selectingRole)}
                        className="group w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-[0_14px_35px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <div className="flex items-center gap-5">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                            <img
                              src={meta.image}
                              alt={meta.title}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div
                              className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${meta.tone}`}
                            >
                              <Icon className="h-4 w-4" />
                              {meta.badge}
                            </div>
                            <h3 className="text-xl font-bold text-gray-950">{meta.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-gray-600">{meta.subtitle}</p>
                          </div>

                          <span
                            className={`inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-white transition ${meta.button}`}
                          >
                            {isSelecting ? (
                              <FiRefreshCw className="h-5 w-5 animate-spin" />
                            ) : (
                              <FiArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm leading-6 text-emerald-800">
                      You can switch roles later from your profile.
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

export default RoleSelectionScreen;
