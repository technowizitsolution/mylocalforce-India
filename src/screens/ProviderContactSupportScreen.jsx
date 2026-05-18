import React, { useEffect, useMemo, useState } from 'react';
import { FiMessageSquare, FiPlus, FiSend, FiX } from 'react-icons/fi';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import {
  createSupportCase,
  sendSupportCaseMessage,
  subscribeSupportCaseMessages,
  subscribeSupportCasesForUser,
} from '../services/firebase/supportService';
import { notify } from '../utils/toast';

const statusLabel = (status) => {
  switch (String(status || 'open').toLowerCase()) {
    case 'in_progress':
      return 'In Progress';
    case 'closed':
      return 'Closed';
    default:
      return 'Open';
  }
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value) => {
  const milliseconds = toMillis(value);
  return milliseconds ? new Date(milliseconds).toLocaleString() : '-';
};

const ProviderContactSupportScreen = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  const requesterName = useMemo(
    () => user?.name || user?.displayName || user?.businessName || user?.fullName || '',
    [user]
  );

  useEffect(() => {
    if (!user?.uid) {
      setLoadingCases(false);
      return undefined;
    }

    return subscribeSupportCasesForUser(
      user.uid,
      'provider',
      (supportCases) => {
        setCases(supportCases);
        setLoadingCases(false);
      },
      () => {
        setLoadingCases(false);
        notify.error('Failed to load support requests');
      }
    );
  }, [user?.uid]);

  const handleCreateCase = async (event) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      const created = await createSupportCase({
        requesterUid: user.uid,
        requesterRole: 'provider',
        requesterName,
        requesterEmail: user.email,
        requesterPhone: user.phone || user.phoneNumber,
        subject,
        message,
      });
      setSubject('');
      setMessage('');
      notify.success(`Support request ${created.caseId} created`);
    } catch (error) {
      notify.error(error?.message || 'Could not create support request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProviderAppLayout>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">Contact Support</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Create a support request and continue the conversation here.
        </p>
      </header>

      <form
        onSubmit={handleCreateCase}
        className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2">
          <FiPlus className="h-5 w-5 text-[#5A52E3]" />
          <h2 className="text-lg font-semibold text-slate-950">New Request</h2>
        </div>
        <div className="grid gap-4">
          <Field label="Subject" value={subject} onChange={setSubject} />
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#5A52E3]"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#5A52E3] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <FiSend className="h-4 w-4" />
          {submitting ? 'Sending...' : 'Send Request'}
        </button>
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Your Requests</h2>
        <div className="mt-3 space-y-3">
          {loadingCases ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 font-semibold text-slate-500 shadow-sm">
              Loading support requests...
            </div>
          ) : cases.length ? (
            cases.map((supportCase) => (
              <button
                key={supportCase.id}
                type="button"
                onClick={() => setSelectedCase(supportCase)}
                className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{supportCase.subject}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {supportCase.caseId} - {formatDate(supportCase.lastMessageAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {statusLabel(supportCase.status)}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-500">
                  {supportCase.lastMessagePreview}
                </p>
              </button>
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <FiMessageSquare className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-800">No support requests yet</p>
            </div>
          )}
        </div>
      </section>

      {selectedCase ? (
        <SupportChatModal
          supportCase={selectedCase}
          user={user}
          requesterName={requesterName}
          onClose={() => setSelectedCase(null)}
        />
      ) : null}

      <Footer />
    </ProviderAppLayout>
  );
};

const SupportChatModal = ({ supportCase, user, requesterName, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    return subscribeSupportCaseMessages(supportCase.id, setMessages, () =>
      notify.error('Failed to load support messages')
    );
  }, [supportCase.id]);

  const handleReply = async (event) => {
    event.preventDefault();
    try {
      setSending(true);
      await sendSupportCaseMessage({
        supportCaseId: supportCase.id,
        senderUid: user.uid,
        senderRole: 'provider',
        senderName: requesterName,
        message: reply,
      });
      setReply('');
    } catch (error) {
      notify.error(error?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:px-4">
      <div className="flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">{supportCase.subject}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{supportCase.caseId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.map((item) => {
            const isMine = item.senderUid === user.uid;
            return (
              <div key={item.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${isMine ? 'bg-[#5A52E3] text-white' : 'bg-slate-100 text-slate-800'}`}
                >
                  <p className="text-sm font-semibold">{item.message}</p>
                  <p className={`mt-1 text-xs ${isMine ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {formatDate(item.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <form onSubmit={handleReply} className="flex gap-2 border-t border-slate-100 p-4">
          <input
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Type a reply"
            className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
          />
          <button
            type="submit"
            disabled={sending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#5A52E3] px-4 text-white disabled:opacity-60"
          >
            <FiSend className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange }) => (
  <label className="grid gap-1.5">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#5A52E3]"
    />
  </label>
);

export default ProviderContactSupportScreen;
