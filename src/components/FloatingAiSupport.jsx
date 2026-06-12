import React, { useEffect, useState } from 'react';
import { FiX, FiZap } from 'react-icons/fi';
import { FaRobot } from 'react-icons/fa6';
import AiSupportPanel from './AiSupportPanel';
import { getCartDraft } from '../utils/cartDraft';

const FloatingAiSupport = ({ role = 'customer' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCartDraft, setHasCartDraft] = useState(false);
  const normalizedRole = role === 'provider' ? 'provider' : role === 'all' ? 'all' : 'customer';
  const launcherBottom =
    normalizedRole !== 'provider' && hasCartDraft
      ? 'bottom-36 sm:bottom-20'
      : 'bottom-20 sm:bottom-6';

  useEffect(() => {
    if (normalizedRole === 'provider' || typeof window === 'undefined') {
      return undefined;
    }

    const refreshCartState = () => {
      setHasCartDraft(Boolean(getCartDraft()?.serviceData));
    };

    refreshCartState();
    window.addEventListener('focus', refreshCartState);
    window.addEventListener('storage', refreshCartState);
    const intervalId = window.setInterval(refreshCartState, 1500);

    return () => {
      window.removeEventListener('focus', refreshCartState);
      window.removeEventListener('storage', refreshCartState);
      window.clearInterval(intervalId);
    };
  }, [normalizedRole]);

  return (
    <>
      {isOpen ? (
        <div
          className="fixed bottom-24 right-4 z-50 flex h-[min(620px,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-6 sm:right-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#5A52E3] text-white">
                <FaRobot className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">Forcie</p>
                <p className="text-xs font-semibold text-slate-500">
                  {normalizedRole === 'provider'
                    ? 'Provider support'
                    : normalizedRole === 'all'
                      ? 'Customer & provider support'
                      : 'Customer support'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Close chatbot"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
          <AiSupportPanel role={normalizedRole} compact />
        </div>
      ) : null}

      {!isOpen ? (
        <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`group fixed ${launcherBottom} right-4 z-50 inline-flex h-16 w-16 items-center justify-center rounded-full text-white transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-[#5A52E3]/25 sm:right-6`}
        aria-label="Open chatbot"
      >
        <span className="absolute inset-1 rounded-full bg-[#5A52E3]/35 opacity-75 animate-ping" />
        <span className="absolute inset-0 rounded-full bg-[#5A52E3]/20" />
        <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#5A52E3] shadow-2xl transition group-hover:bg-[#4B45C9]">
          <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-white text-[10px] font-black text-[#5A52E3] shadow-sm">
            <FiZap className="h-3 w-3" />
          </span>
          <FaRobot className="h-6 w-6" />
        </span>
        </button>
      ) : null}
    </>
  );
};

export default FloatingAiSupport;
