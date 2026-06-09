import React, { useEffect, useState } from 'react';
import { FiMessageCircle, FiX } from 'react-icons/fi';
import AiSupportPanel from './AiSupportPanel';
import { getCartDraft } from '../utils/cartDraft';

const FloatingAiSupport = ({ role = 'customer' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCartDraft, setHasCartDraft] = useState(false);
  const normalizedRole = role === 'provider' ? 'provider' : 'customer';
  const launcherBottom =
    normalizedRole === 'customer' && hasCartDraft
      ? 'bottom-36 sm:bottom-20'
      : 'bottom-20 sm:bottom-6';

  useEffect(() => {
    if (normalizedRole !== 'customer' || typeof window === 'undefined') {
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
                <FiMessageCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">MyLocalForce AI</p>
                <p className="text-xs font-semibold text-slate-500">
                  {normalizedRole === 'provider' ? 'Provider support' : 'Customer support'}
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
        className={`fixed ${launcherBottom} right-4 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#5A52E3] text-white shadow-xl transition hover:bg-[#4B45C9] sm:right-6`}
        aria-label="Open chatbot"
      >
        <FiMessageCircle className="h-6 w-6" />
        </button>
      ) : null}
    </>
  );
};

export default FloatingAiSupport;
