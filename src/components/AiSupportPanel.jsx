import React, { useMemo, useState } from 'react';
import { FiList, FiMessageCircle, FiSend } from 'react-icons/fi';
import { sendAiSupportMessage } from '../services/firebase/aiSupportService';
import { notify } from '../utils/toast';

const roleLabel = (role) => (role === 'provider' ? 'Provider Support' : 'Customer Support');

const quickPrompts = {
  customer: [
    'Book a service',
    'Find a provider',
    'Check booking status',
    'Change booking time',
    'Cancel booking',
    'Payment issue',
    'Refund question',
    'Update my profile',
    'Contact admin support',
    'Something else',
  ],
  provider: [
    'Update availability',
    'Manage my services',
    'Booking issue',
    'Provider profile help',
    'Document review',
    'Onboarding status',
    'Payout question',
    'Earnings question',
    'Contact admin support',
    'Something else',
  ],
};

const AiSupportPanel = ({ role = 'customer', compact = false }) => {
  const normalizedRole = role === 'provider' ? 'provider' : 'customer';
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        normalizedRole === 'provider'
          ? 'Hi, I can help with provider profile, bookings, services, onboarding, and payouts.'
          : 'Hi, I can help with bookings, services, payments, and account questions.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  const prompts = useMemo(() => quickPrompts[normalizedRole], [normalizedRole]);

  const sendMessage = async (value = input, fromPrompt = false) => {
    const text =
      String(value || '').trim() === 'Something else'
        ? 'I need help with something else. Please ask me what details you need.'
        : String(value || '').trim();
    if (!text || sending) return;
    if (fromPrompt) {
      setShowQuickPrompts(false);
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);

    try {
      const result = await sendAiSupportMessage({
        message: text,
        role: normalizedRole,
        sessionId,
        source: 'web-support',
      });
      setSessionId(result.sessionId);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: result.reply,
        },
      ]);
    } catch (error) {
      notify.error(error?.message || 'AI support is not available right now');
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: 'AI support is not ready right now. Please create a support request below and the admin team will help.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage();
  };

  return (
    <section className={compact ? 'flex min-h-0 flex-1 flex-col bg-white' : 'mt-6 rounded-lg border border-slate-200 bg-white shadow-sm'}>
      {!compact ? (
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-center gap-2">
          <FiMessageCircle className="h-5 w-5 text-[#5A52E3]" />
          <h2 className="text-lg font-semibold text-slate-950">AI Quick Help</h2>
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-500">{roleLabel(normalizedRole)}</p>
      </div>
      ) : null}

      <div className={`${compact ? 'min-h-0 flex-1 bg-slate-50/70 p-4' : 'max-h-80 p-5'} space-y-3 overflow-y-auto`}>
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${
                  isUser ? 'rounded-br-md bg-[#5A52E3] text-white' : 'rounded-bl-md bg-white text-slate-800'
                }`}
              >
                {message.text}
              </div>
            </div>
          );
        })}
        {sending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm font-semibold text-slate-500 shadow-sm">
              Thinking...
            </div>
          </div>
        ) : null}
      </div>

      {showQuickPrompts ? (
      <div className={`border-t border-slate-100 bg-white ${compact ? 'px-4 py-3' : 'px-5 pb-3 pt-3'}`}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick questions</p>
        <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt, true)}
            disabled={sending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
        </div>
      </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-100 bg-white p-4">
        <button
          type="button"
          onClick={() => setShowQuickPrompts((current) => !current)}
          className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Show quick questions"
        >
          <FiList className="h-4 w-4" />
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask MyLocalForce AI"
          className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#5A52E3] px-4 text-white disabled:opacity-60"
        >
          <FiSend className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
};

export default AiSupportPanel;
