import React, { useState, useEffect, useCallback } from 'react';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  FiFileText, FiX, FiClock, FiCheckCircle, FiCheckSquare, FiXCircle,
  FiInfo, FiShield, FiActivity, FiMapPin, FiBriefcase, FiTag, FiUser,
  FiPhone, FiMail, FiStar, FiCalendar, FiCopy, FiMap, FiAlertCircle,
  FiAlertTriangle, FiMessageCircle, FiCheck, FiSend, FiDollarSign
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import {
  fetchProviderCommissionRate,
  getBookingById,
  updateBookingStatus,
} from '../../services/firebase/serviceService';
import { fetchUserProfile } from '../../services/firebase';
import { toPublicProviderProfile } from '../../utils/providerPrivacy';
import { createSupportCase } from '../../services/firebase/supportService';
import { firestore } from '../../services/firebase/firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { startCheckoutForBooking } from '../../utils/bookingPayments';
import { notify, getUserFacingError } from '../../utils/toast';
import { calculatePaymentBreakdownV2, formatCurrency } from '../../config/paymentConfig';

const PROVIDER_NOT_REACHED_ACTIVATION_MINUTES = 5;

const LATENESS_POLICY_STEPS = [
  {
    key: 'late',
    threshold: 5,
    title: 'Recorded as Late',
    description: 'After 5 minutes delay, this booking is officially marked as late.',
  },
  {
    key: 'notify',
    threshold: 10,
    title: 'Customer Auto-Notified',
    description:
      'After 10 minutes delay, customer gets wait, reschedule, cancel, and support options.',
  },
  {
    key: 'noshow',
    threshold: 20,
    title: 'No-show Risk',
    description:
      'After 20 minutes delay, it may be treated as no-show unless customer consent exists.',
  },
];

const formatLateness = (minutesInput) => {
  const minutes = Number.isFinite(minutesInput) ? Math.max(0, Math.floor(minutesInput)) : 0;
  if (minutes === 0) return '0 minute(s) late';
  if (minutes < 60) return minutes >= 45 ? '1 h late' : `${minutes} minute(s) late`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    if (hours >= 23) return '1 day late';
    return rem === 0 ? `${hours} h late` : `${hours} h ${rem}m late`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return `${days} day${days > 1 ? 's' : ''}${hours ? ` ${hours} h` : ''}${
    mins ? ` ${mins}m` : ''
  } late`;
};

const toDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const applyTimeToDate = (date, timeValue) => {
  if (!timeValue) return date;
  const text = String(timeValue).trim();
  if (!text) return date;

  const amPmMatch = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    let hours = Number(amPmMatch[1]);
    const minutes = Number(amPmMatch[2]);
    const isPm = amPmMatch[3].toUpperCase() === 'PM';
    if (isPm && hours !== 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  const twentyFourMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourMatch) {
    const hours = Number(twentyFourMatch[1]);
    const minutes = Number(twentyFourMatch[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      date.setHours(hours, minutes, 0, 0);
    }
  }

  return date;
};

const getScheduledDateTime = (booking) => {
  if (!booking || typeof booking !== 'object') return null;
  const dateCandidate =
    booking.selectedDate || booking.requestedDate || booking.scheduledDate || booking.date || null;
  const baseDate = toDateValue(dateCandidate);
  if (!baseDate) return null;

  const scheduled = new Date(baseDate);
  const timeCandidate =
    booking.selectedTime || booking.requestedTime || booking.scheduledTime || booking.time || null;
  return applyTimeToDate(scheduled, timeCandidate);
};

const getLatenessState = (booking) => {
  const scheduledDateTime = getScheduledDateTime(booking);
  if (!scheduledDateTime) {
    return { hasSchedule: false, isLate: false, minutesLate: 0, scheduledDateTime: null };
  }

  const diffMinutes = Math.floor((Date.now() - scheduledDateTime.getTime()) / (1000 * 60));
  const minutesLate = Math.max(0, diffMinutes);
  return { hasSchedule: true, isLate: minutesLate > 0, minutesLate, scheduledDateTime };
};

const getProviderNotReachedState = (booking, nowMs = Date.now()) => {
  const scheduledDateTime = getScheduledDateTime(booking);
  const minutesUntilService = scheduledDateTime
    ? Math.ceil((scheduledDateTime.getTime() - nowMs) / (1000 * 60))
    : null;

  const withinActivationWindow =
    Number.isFinite(minutesUntilService) &&
    minutesUntilService <= PROVIDER_NOT_REACHED_ACTIVATION_MINUTES;

  const reportedAtRaw =
    booking?.providerNotReachedAlert?.reportedAt || booking?.providerNotReachedAt;
  const normalizedAlertStatus = String(
    booking?.providerNotReachedAlert?.status || booking?.providerNotReachedAlertStatus || ''
  ).toLowerCase();

  const alreadyReported =
    Boolean(reportedAtRaw) ||
    Boolean(booking?.providerNotReachedAlert) ||
    ['open', 'reported', 'in_progress', 'pending'].includes(normalizedAlertStatus);

  return {
    hasSchedule: Boolean(scheduledDateTime),
    scheduledDateTime,
    minutesUntilService,
    withinActivationWindow,
    alreadyReported,
    reportedAt: toDateValue(reportedAtRaw),
    canReport:
      booking?.status === 'accepted' &&
      Boolean(scheduledDateTime) &&
      withinActivationWindow &&
      !alreadyReported,
  };
};

const makeChatId = (leftUserId, rightUserId, bookingId) => {
  const pair = [leftUserId, rightUserId].sort();
  return `${pair[0]}_${pair[1]}_${bookingId}`;
};

const CHAT_KEY_PREFIX = 'chatKeys:';
const CHAT_DEVICE_PREFIX = 'chatDeviceId:';
const encodeBase64 = (u8) => naclUtil.encodeBase64(u8);
const decodeBase64 = (text) => naclUtil.decodeBase64(text);
const encodeUTF8 = (u8) => naclUtil.encodeUTF8(u8);
const decodeUTF8 = (text) => naclUtil.decodeUTF8(text);

const getChatDeviceId = (userId) => {
  const storageKey = `${CHAT_DEVICE_PREFIX}${userId}`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const generated =
    window.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
};

const ensureChatKeypair = async (userId) => {
  const storageKey = `${CHAT_KEY_PREFIX}${userId}`;
  const deviceId = getChatDeviceId(userId);
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    const keys = JSON.parse(existing);
    await setDoc(
      doc(firestore, 'users', userId),
      {
        publicKey: keys.publicKey,
        chatPublicKeys: arrayUnion({ deviceId, publicKey: keys.publicKey, platform: 'web' }),
      },
      { merge: true }
    );
    return { ...keys, deviceId };
  }

  const keypair = nacl.box.keyPair();
  const keys = {
    publicKey: encodeBase64(keypair.publicKey),
    secretKey: encodeBase64(keypair.secretKey),
  };

  window.localStorage.setItem(storageKey, JSON.stringify(keys));
  await setDoc(
    doc(firestore, 'users', userId),
    {
      publicKey: keys.publicKey,
      chatPublicKeys: arrayUnion({ deviceId, publicKey: keys.publicKey, platform: 'web' }),
    },
    { merge: true }
  );
  return { ...keys, deviceId };
};

const getPublicKeysForUser = async (userId) => {
  const userSnapshot = await getDoc(doc(firestore, 'users', userId));
  if (!userSnapshot.exists()) return [];
  const data = userSnapshot.data() || {};
  const keys = [];
  if (data.publicKey) keys.push(data.publicKey);
  if (Array.isArray(data.chatPublicKeys)) {
    data.chatPublicKeys.forEach((entry) => {
      if (entry?.publicKey) keys.push(entry.publicKey);
    });
  }
  return [...new Set(keys)];
};

const getPublicKeysForUserWithRetry = async (userId) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const publicKeys = await getPublicKeysForUser(userId);
    if (publicKeys.length) return publicKeys;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return [];
};

const decryptChatMessage = (messageData, myUserId) => {
  if (typeof messageData.plaintext === 'string') return messageData.plaintext;

  const keyJson = window.localStorage.getItem(`${CHAT_KEY_PREFIX}${myUserId}`);
  const myKeys = keyJson ? JSON.parse(keyJson) : null;
  if (!myKeys?.secretKey) {
    return '[Encrypted]';
  }

  const tryOpen = (boxPublicKey, cipherText, nonceText) => {
    if (!boxPublicKey || !cipherText || !nonceText) return null;
    const sharedKey = nacl.box.before(decodeBase64(boxPublicKey), decodeBase64(myKeys.secretKey));
    const opened = nacl.box.open.after(decodeBase64(cipherText), decodeBase64(nonceText), sharedKey);
    return opened ? encodeUTF8(opened) : null;
  };

  try {
    if (Array.isArray(messageData.boxes)) {
      for (const box of messageData.boxes) {
        const text = tryOpen(box.senderPublicKey, box.cipher, box.nonce);
        if (text) return text;
      }
    }

    if (
      typeof messageData.cipher === 'string' &&
      typeof messageData.nonce === 'string' &&
      typeof messageData.senderPublicKey === 'string' &&
      typeof messageData.recipientPublicKey === 'string'
    ) {
      const otherPublicEncoded =
        messageData.fromId === myUserId
          ? messageData.recipientPublicKey
          : messageData.senderPublicKey;
      const text = tryOpen(otherPublicEncoded, messageData.cipher, messageData.nonce);
      if (text) return text;
    }

    return '[Encrypted]';
  } catch (error) {
    console.warn('Failed to decrypt booking chat message:', error);
    return '[Encrypted]';
  }
};

const buildEncryptedChatPayload = async ({ fromId, toId, text }) => {
  const keys = await ensureChatKeypair(fromId);
  const recipientPublicKeys = await getPublicKeysForUserWithRetry(toId);
  const senderPublicKeys = await getPublicKeysForUserWithRetry(fromId);
  const allPublicKeys = [...new Set([...recipientPublicKeys, ...senderPublicKeys])];

  if (!recipientPublicKeys.length) {
    return {
      plaintext: String(text || ''),
      fromId,
      toId,
      via: 'plain',
      createdAt: serverTimestamp(),
    };
  }

  const encryptForPublicKey = (publicKey) => {
    const sharedKey = nacl.box.before(decodeBase64(publicKey), decodeBase64(keys.secretKey));
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const cipher = nacl.box.after(decodeUTF8(text), nonce, sharedKey);
    return {
      publicKey,
      cipher: encodeBase64(cipher),
      nonce: encodeBase64(nonce),
      senderPublicKey: keys.publicKey,
    };
  };

  const legacyRecipientKey = recipientPublicKeys[0];
  const legacyBox = encryptForPublicKey(legacyRecipientKey);

  return {
    plaintext: String(text || ''),
    cipher: legacyBox.cipher,
    nonce: legacyBox.nonce,
    senderPublicKey: keys.publicKey,
    recipientPublicKey: legacyRecipientKey,
    boxes: allPublicKeys.map(encryptForPublicKey),
    fromId,
    toId,
    createdAt: serverTimestamp(),
  };
};

const BookingDetailModal = ({ visible, bookingId, onClose, role = 'customer' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [providerProfile, setProviderProfile] = useState(null);
  const [providerCommissionRate, setProviderCommissionRate] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [unavailableNote, setUnavailableNote] = useState('');
  const [showUnavailableInput, setShowUnavailableInput] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showLatenessPolicyModal, setShowLatenessPolicyModal] = useState(false);
  const [latenessSnapshot, setLatenessSnapshot] = useState(null);
  const [providerNotReachedNow, setProviderNotReachedNow] = useState(Date.now());
  const [reportingNotReached, setReportingNotReached] = useState(false);
  const [chatContext, setChatContext] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────

  const confirmAction = (title, message, onConfirm) => {
    setConfirmDialog({ title, message, onConfirm });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_payment': return '#F59E0B';
      case 'pending': return '#FFB800';
      case 'accepted':
      case 'upcoming': return '#00A8FF';
      case 'completed': return '#00D68F';
      case 'cancelled':
      case 'rejected': return '#FF4757';
      default: return '#64748B';
    }
  };

  const getStatusTailwind = (status) => {
    switch (status) {
      case 'pending_payment': return 'bg-amber-100 text-amber-700';
      case 'pending': return 'bg-amber-100 text-amber-600';
      case 'accepted':
      case 'upcoming': return 'bg-sky-100 text-sky-600';
      case 'completed': return 'bg-emerald-100 text-emerald-600';
      case 'cancelled':
      case 'rejected': return 'bg-red-100 text-red-600';
      default: return 'bg-slate-100 text-slate-500';
    }
  };

  const StatusIcon = ({ status, size = 18 }) => {
    const props = { size, className: 'shrink-0' };
    switch (status) {
      case 'pending_payment': return <FiClock {...props} />;
      case 'pending': return <FiClock {...props} />;
      case 'accepted':
      case 'upcoming': return <FiCheckCircle {...props} />;
      case 'completed': return <FiCheckSquare {...props} />;
      case 'cancelled':
      case 'rejected': return <FiXCircle {...props} />;
      default: return <FiInfo {...props} />;
    }
  };

  const toDate = (v) => {
    if (!v) return null;
    if (v.toDate) return v.toDate();
    return new Date(v);
  };

  // ── Data Loading ────────────────────────────────────────────────────

  const loadBooking = useCallback(async () => {
    try {
      setLoading(true);
      const bookingData = await getBookingById(bookingId);
      setBooking(bookingData);
      setProviderCommissionRate(null);
      if (bookingData?.providerId) {
        try {
          const rate = await fetchProviderCommissionRate(bookingData.providerId);
          setProviderCommissionRate(rate);
        } catch (e) {
          console.log('Could not fetch provider commission rate:', e);
        }
      }
      if (role === 'customer' && bookingData?.providerId) {
        try {
          const profile = await fetchUserProfile(bookingData.providerId);
          setProviderProfile(toPublicProviderProfile(profile));
        } catch (e) {
          console.log('Could not fetch provider profile:', e);
        }
      }
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  }, [bookingId, role]);

  useEffect(() => {
    if (visible && bookingId) loadBooking();
  }, [visible, bookingId, loadBooking]);

  useEffect(() => {
    if (!(visible && role === 'customer' && booking?.status === 'accepted')) {
      return undefined;
    }

    setProviderNotReachedNow(Date.now());
    const intervalId = setInterval(() => setProviderNotReachedNow(Date.now()), 30000);
    return () => clearInterval(intervalId);
  }, [visible, role, booking?.status]);

  useEffect(() => {
    if (!chatContext?.chatId || !user?.uid) return undefined;

    setChatLoading(true);
    ensureChatKeypair(user.uid).catch((error) => {
      console.warn('Could not initialize booking chat keypair:', error);
    });
    const messagesQuery = query(
      collection(firestore, 'chats', chatContext.chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        setChatMessages(
          snapshot.docs.map((messageDoc) => {
            const data = messageDoc.data() || {};
            return {
              id: messageDoc.id,
              text: decryptChatMessage(data, user.uid),
              fromId: data.fromId,
              toId: data.toId,
              createdAt: toDateValue(data.createdAt),
            };
          })
        );
        setChatLoading(false);
      },
      (error) => {
        console.error('Booking chat load failed:', error);
        setChatMessages([]);
        setChatLoading(false);
        notify.error('Could not load booking chat.', { id: 'booking-chat-load' });
      }
    );
  }, [chatContext?.chatId, user?.uid]);

  // ── Action Handlers ─────────────────────────────────────────────────

  const handleAcceptBooking = () => {
    confirmAction('Accept Booking', 'Are you sure you want to accept this booking?', async () => {
      try {
        setActionLoading(true);
        const providerId = booking?.providerId || user?.uid;
        await updateBookingStatus(bookingId, 'accepted', providerId);
        await loadBooking();
        notify.success('Booking accepted.', { id: 'booking-detail-accept' });
      } catch (error) {
        console.error('Error accepting booking:', error);
        notify.error(getUserFacingError(error, 'Could not accept booking. Please try again.'), {
          id: 'booking-detail-accept',
        });
      } finally {
        setActionLoading(false);
      }
    });
  };

  const handleRejectBooking = () => {
    confirmAction('Reject Booking', 'Are you sure you want to reject this booking?', async () => {
      try {
        setActionLoading(true);
        const providerId = booking?.providerId || user?.uid;
        await updateBookingStatus(bookingId, 'rejected', providerId);
        await loadBooking();
        notify.success('Booking rejected.', { id: 'booking-detail-reject' });
      } catch (error) {
        console.error('Error rejecting booking:', error);
        notify.error(getUserFacingError(error, 'Could not reject booking. Please try again.'), {
          id: 'booking-detail-reject',
        });
      } finally {
        setActionLoading(false);
      }
    });
  };

  const handleCompleteBooking = () => {
    confirmAction('Complete Booking', 'Mark this booking as completed?', async () => {
      try {
        setActionLoading(true);
        const providerId = booking?.providerId || user?.uid;
        await updateBookingStatus(bookingId, 'completed', providerId);
        await loadBooking();
        notify.success('Booking marked as completed.', { id: 'booking-detail-complete' });
      } catch (error) {
        console.error('Error completing booking:', error);
        notify.error(getUserFacingError(error, 'Could not complete booking. Please try again.'), {
          id: 'booking-detail-complete',
        });
      } finally {
        setActionLoading(false);
      }
    });
  };

  const handleCancelBooking = () => {
    confirmAction('Cancel Booking', 'Are you sure you want to cancel this booking?', async () => {
      try {
        setActionLoading(true);
        const providerId = booking?.providerId || user?.uid;
        if (role === 'customer' && booking?.paymentStatus === 'paid') {
          const scheduled = getScheduledDateTime(booking);
          const hoursUntilBooking = scheduled
            ? (scheduled.getTime() - Date.now()) / (1000 * 60 * 60)
            : null;

          await updateDoc(doc(firestore, 'bookings', bookingId), {
            status: 'cancelled',
            cancelledAt: serverTimestamp(),
            cancelledBy: 'customer',
            refundRequested: true,
            refundReason:
              Number.isFinite(hoursUntilBooking) && hoursUntilBooking < 8
                ? 'Customer cancelled within 8 hours of booking time - reduced refund applies'
                : 'Customer cancelled booking - refund requested',
            refundRequestedAt: serverTimestamp(),
            refundStatus: 'pending_admin_review',
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateBookingStatus(bookingId, 'cancelled', providerId);
        }
        await loadBooking();
        notify.success(
          role === 'customer' && booking?.paymentStatus === 'paid'
            ? 'Booking cancelled and refund request submitted.'
            : 'Booking cancelled.',
          { id: 'booking-detail-cancel' }
        );
      } catch (error) {
        console.error('Error cancelling booking:', error);
        notify.error(getUserFacingError(error, 'Could not cancel booking. Please try again.'), {
          id: 'booking-detail-cancel',
        });
      } finally {
        setActionLoading(false);
      }
    });
  };

  const confirmAndSendArrivalOtp = () => {
    confirmAction(
      'Mark as Arrived',
      'This will send a verification code to the customer. Are you at the service location?',
      async () => {
        try {
          setOtpSending(true);
          const providerId = booking?.providerId || user?.uid;
          const response = await fetch(
            'https://us-central1-mylocalforce-295b8.cloudfunctions.net/sendServiceStartOtp',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId, providerId }),
            },
          );
          const result = await response.json();
          if (response.ok) {
            await loadBooking();
            notify.success('Verification code sent to the customer.', {
              id: 'booking-detail-arrived',
            });
          } else {
            notify.error(result.error || 'Could not send verification code.', {
              id: 'booking-detail-arrived',
            });
          }
        } catch (error) {
          console.error('Error sending OTP:', error);
          notify.error(
            getUserFacingError(error, 'Could not send verification code. Please try again.'),
            { id: 'booking-detail-arrived' }
          );
        } finally {
          setOtpSending(false);
        }
      },
    );
  };

  const closeLatenessPolicyModal = () => {
    setShowLatenessPolicyModal(false);
    setLatenessSnapshot(null);
  };

  const handleOpenSupport = () => {
    const scheduled = getScheduledDateTime(booking);
    closeLatenessPolicyModal();
    onClose?.();
    navigate(role === 'provider' ? '/provider/contact-support' : '/customer/contact-support', {
      state: {
        prefillSupport: {
          subject: `Booking support: ${booking?.serviceName || booking?.service || 'Service'}`,
          message: [
            `Booking ID: ${booking?.id || bookingId || ''}`,
            `Service: ${booking?.serviceName || booking?.service || 'Service'}`,
            `Scheduled: ${scheduled ? scheduled.toLocaleString() : 'Unavailable'}`,
            `Status: ${
              latenessSnapshot?.hasSchedule
                ? formatLateness(latenessSnapshot.minutesLate)
                : 'Scheduled time unavailable'
            }`,
            '',
            'Please help with this booking.',
          ].join('\n'),
        },
      },
    });
  };

  const handleOpenBookingChat = () => {
    if (!booking || !bookingId || !user?.uid) {
      notify.error('Chat is unavailable for this booking.', { id: 'booking-chat-open' });
      return;
    }

    const otherUserId =
      role === 'customer'
        ? booking.providerId || booking.providerUid || booking.provider || booking.selectedProviderId
        : booking.customerId || booking.customerUid || booking.customer?.id || booking.customer;
    const otherUserName =
      role === 'customer'
        ? providerProfile?.displayName ||
          providerProfile?.name ||
          providerProfile?.fullName ||
          booking.providerName ||
          'Provider'
        : booking.customerName || booking.customer?.displayName || 'Customer';

    if (!otherUserId) {
      notify.error('User ID for chat is not available.', { id: 'booking-chat-open' });
      return;
    }

    setChatContext({
      chatId: makeChatId(user.uid, otherUserId, bookingId),
      otherUserId,
      otherUserName,
    });
    setChatInput('');
  };

  const handleCloseBookingChat = () => {
    setChatContext(null);
    setChatMessages([]);
    setChatInput('');
  };

  const handleSendBookingChatMessage = async (event) => {
    event?.preventDefault?.();
    const text = chatInput.trim();
    if (!text || !chatContext || !user?.uid) return;

    try {
      setChatSending(true);
      setChatInput('');
      const payload = await buildEncryptedChatPayload({
        fromId: user.uid,
        toId: chatContext.otherUserId,
        text,
      });
      await addDoc(collection(firestore, 'chats', chatContext.chatId, 'messages'), payload);
    } catch (error) {
      console.error('Booking chat send failed:', error);
      setChatInput(text);
      notify.error('Could not send message. Please try again.', { id: 'booking-chat-send' });
    } finally {
      setChatSending(false);
    }
  };

  const providerNotReachedState = getProviderNotReachedState(booking, providerNotReachedNow);

  const getProviderNotReachedHint = () => {
    if (providerNotReachedState.alreadyReported) {
      if (providerNotReachedState.reportedAt) {
        return `Alert sent at ${providerNotReachedState.reportedAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}. Our backend team is handling this booking.`;
      }
      return 'This issue has already been reported. Open support for updates.';
    }

    if (!providerNotReachedState.hasSchedule) {
      return 'This option activates 5 minutes before the scheduled service time.';
    }

    if (providerNotReachedState.canReport) {
      return 'If the provider has not arrived, send an immediate alert to our backend team.';
    }

    if (
      Number.isFinite(providerNotReachedState.minutesUntilService) &&
      providerNotReachedState.minutesUntilService > PROVIDER_NOT_REACHED_ACTIVATION_MINUTES
    ) {
      const minutesUntilActivation =
        providerNotReachedState.minutesUntilService - PROVIDER_NOT_REACHED_ACTIVATION_MINUTES;
      return `Available in ${minutesUntilActivation} minute(s), starting 5 minutes before service time.`;
    }

    return 'This option is available after your booking is accepted.';
  };

  const isNotReachedButtonDisabled =
    reportingNotReached ||
    (!providerNotReachedState.alreadyReported && !providerNotReachedState.canReport);

  const handleProviderNotReachedAction = () => {
    if (providerNotReachedState.alreadyReported) {
      handleOpenSupport();
      return;
    }

    if (!providerNotReachedState.canReport) {
      notify.info('This option becomes active 5 minutes before your scheduled service time.', {
        id: 'booking-detail-not-reached',
      });
      return;
    }

    confirmAction(
      'Service Provider Not Reached',
      'Send an immediate alert to our backend team so they can intervene and ensure service delivery?',
      async () => {
        try {
          setReportingNotReached(true);

          const scheduledDateText = booking?.selectedDate || booking?.requestedDate || 'TBD';
          const scheduledTimeText =
            booking?.selectedTime || booking?.scheduledTime || booking?.requestedTime || 'TBD';
          const customerName =
            booking?.customerName ||
            user?.name ||
            user?.displayName ||
            user?.email ||
            'Customer';
          const minutesLateAtReport =
            Number.isFinite(providerNotReachedState.minutesUntilService) &&
            providerNotReachedState.minutesUntilService < 0
              ? Math.abs(providerNotReachedState.minutesUntilService)
              : 0;

          const bookingRef = doc(firestore, 'bookings', bookingId);
          await updateDoc(bookingRef, {
            providerNotReachedAlert: {
              status: 'open',
              reportedAt: serverTimestamp(),
              reportedByUid: user?.uid || booking?.customerId || null,
              reportedByRole: 'customer',
              reportedByName: customerName,
              reportedByEmail: user?.email || booking?.customerEmail || null,
              selectedDate: scheduledDateText,
              selectedTime: scheduledTimeText,
              serviceName: booking?.serviceName || booking?.serviceTitle || null,
              providerName: booking?.providerName || null,
              minutesUntilServiceAtReport: providerNotReachedState.minutesUntilService,
              minutesLateAtReport,
              supportCaseId: null,
              supportCaseCode: null,
              source: 'web_booking_detail_modal',
            },
            providerNotReachedAlertStatus: 'open',
            providerNotReachedAlertUpdatedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          let supportCase = null;
          try {
            supportCase = await createSupportCase({
              requesterUid: user?.uid || booking?.customerId,
              requesterRole: 'customer',
              requesterName: customerName,
              requesterEmail: user?.email || booking?.customerEmail || '',
              requesterPhone: booking?.customerPhone || booking?.phoneNumber || user?.phoneNumber || '',
              subject: `Provider not reached - Booking #${booking?.orderNumber || bookingId}`,
              message:
                `Customer reported that the provider has not reached the location.\n\n` +
                `Booking: #${booking?.orderNumber || bookingId}\n` +
                `Service: ${booking?.serviceName || booking?.serviceTitle || 'Service'}\n` +
                `Scheduled: ${scheduledDateText} ${scheduledTimeText}\n` +
                `Address: ${booking?.address || booking?.customerAddress || 'Not provided'}\n` +
                `Provider: ${booking?.providerName || 'Assigned provider'}\n` +
                `Minutes late at report: ${minutesLateAtReport}`,
            });

            if (supportCase) {
              await updateDoc(bookingRef, {
                'providerNotReachedAlert.supportCaseId': supportCase.id,
                'providerNotReachedAlert.supportCaseCode': supportCase.caseId,
                providerNotReachedAlertUpdatedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch (supportError) {
            console.warn(
              'Provider-not-reached support case creation failed:',
              supportError?.message || supportError
            );
          }

          await loadBooking();
          notify.success(
            supportCase?.caseId
              ? `Our backend team has been alerted. Reference: ${supportCase.caseId}`
              : 'Our backend team has been alerted and will take immediate action.',
            { id: 'booking-detail-not-reached' }
          );
        } catch (error) {
          console.error('Error reporting provider not reached:', error);
          notify.error(getUserFacingError(error, 'Could not send alert. Please try again.'), {
            id: 'booking-detail-not-reached',
          });
        } finally {
          setReportingNotReached(false);
        }
      }
    );
  };

  const handleMarkAsArrived = () => {
    const shouldCheckLateness = booking?.status === 'accepted';
    const latenessState = shouldCheckLateness ? getLatenessState(booking) : null;

    if (shouldCheckLateness && latenessState?.isLate) {
      setLatenessSnapshot(latenessState);
      setShowLatenessPolicyModal(true);
      return;
    }

    confirmAndSendArrivalOtp();
  };

  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.length !== 6) {
      notify.warning('Enter the 6-digit code from the customer.', {
        id: 'booking-detail-otp-validation',
      });
      return;
    }
    try {
      setActionLoading(true);
      const providerId = booking?.providerId || user?.uid;
      const response = await fetch(
        'https://us-central1-mylocalforce-295b8.cloudfunctions.net/verifyServiceStartOtp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, providerId, otp: otpInput }),
        },
      );
      const result = await response.json();
      if (response.ok) {
        await loadBooking();
        setOtpInput('');
        notify.success('Customer verified. Service tracking has started.', {
          id: 'booking-detail-otp-verify',
        });
      } else {
        notify.error(result.error || 'Invalid code. Please try again.', {
          id: 'booking-detail-otp-verify',
        });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      notify.error(getUserFacingError(error, 'Could not verify code. Please try again.'), {
        id: 'booking-detail-otp-verify',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCustomerUnavailable = () => {
    if (!unavailableNote.trim()) {
      notify.warning('Add a note explaining the situation.', {
        id: 'booking-detail-unavailable-note',
      });
      return;
    }
    confirmAction(
      'Mark Customer Unavailable',
      'This will record that the customer was not available.',
      async () => {
        try {
          setActionLoading(true);
          const providerId = booking?.providerId || user?.uid;
          const response = await fetch(
            'https://us-central1-mylocalforce-295b8.cloudfunctions.net/markCustomerUnavailable',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bookingId, providerId, note: unavailableNote.trim() }),
            },
          );
          const result = await response.json();
          if (response.ok) {
            await loadBooking();
            setUnavailableNote('');
            setShowUnavailableInput(false);
            notify.success('Customer unavailability has been noted.', {
              id: 'booking-detail-unavailable',
            });
          } else {
            notify.error(result.error || 'Could not record unavailability.', {
              id: 'booking-detail-unavailable',
            });
          }
        } catch (error) {
          console.error('Error marking customer unavailable:', error);
          notify.error(
            getUserFacingError(error, 'Could not record unavailability. Please try again.'),
            { id: 'booking-detail-unavailable' }
          );
        } finally {
          setActionLoading(false);
        }
      },
    );
  };

  const handleRequestRefund = () => {
    confirmAction(
      'Request Refund',
      'Submit this booking for admin refund review?',
      async () => {
        try {
          setActionLoading(true);
          await updateDoc(doc(firestore, 'bookings', bookingId), {
            refundRequested: true,
            refundReason: 'Customer requested refund from booking details',
            refundRequestedAt: serverTimestamp(),
            refundStatus: 'pending_admin_review',
            updatedAt: serverTimestamp(),
          });
          await loadBooking();
          notify.success('Refund request submitted for admin review.', {
            id: 'booking-detail-refund',
          });
        } catch (error) {
          console.error('Error requesting refund:', error);
          notify.error(getUserFacingError(error, 'Could not request refund. Please try again.'), {
            id: 'booking-detail-refund',
          });
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      notify.warning('Select a rating before submitting.', {
        id: 'booking-detail-rating-validation',
      });
      return;
    }
    if (rating < 5 && !ratingFeedback.trim()) {
      notify.warning('Share feedback for ratings below 5 stars.', {
        id: 'booking-detail-rating-validation',
      });
      return;
    }
    try {
      setSubmittingRating(true);
      const userId = user?.uid;
      const isProvider = role === 'provider';
      const response = await fetch(
        'https://us-central1-mylocalforce-295b8.cloudfunctions.net/submitBookingRating',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId,
            userId,
            rating,
            feedback: rating < 5 ? ratingFeedback.trim() : null,
            raterRole: isProvider ? 'provider' : 'customer',
          }),
        },
      );
      const result = await response.json();
      if (response.ok) {
        setShowRatingModal(false);
        setRating(0);
        setRatingFeedback('');
        await loadBooking();
        notify.success('Your rating has been submitted.', {
          id: 'booking-detail-rating',
        });
      } else {
        notify.error(result.error || 'Could not submit rating.', {
          id: 'booking-detail-rating',
        });
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      notify.error(getUserFacingError(error, 'Could not submit rating. Please try again.'), {
        id: 'booking-detail-rating',
      });
    } finally {
      setSubmittingRating(false);
    }
  };

  // ── Auto-show rating ────────────────────────────────────────────────

  useEffect(() => {
    if (!booking || !visible || booking.status !== 'completed') return;
    const isProvider = role === 'provider';
    const hasRated = isProvider ? booking.providerRating : booking.customerRating;
    if (hasRated) return;
    if (!isProvider && booking.completedAt) {
      const completedTime = toDate(booking.completedAt);
      if (completedTime && (new Date() - completedTime) / 60000 > 5) return;
    }
    setShowRatingModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking, visible]);

  // ── Address helpers ─────────────────────────────────────────────────

  const handleCopyAddress = () => {
    const addr = booking?.address || booking?.customerAddress || '';
    if (!addr) {
      notify.warning('No address available to copy.', { id: 'booking-detail-copy-address' });
      return;
    }
    navigator.clipboard
      .writeText(addr)
      .then(() => notify.info('Address copied to clipboard.', { id: 'booking-detail-copy-address' }))
      .catch(() => notify.error('Could not copy address.', { id: 'booking-detail-copy-address' }));
  };

  const formatBookingStatus = (status) => {
    if (status === 'pending_payment') return 'AWAITING PAYMENT';
    return status?.toUpperCase() || 'PENDING';
  };

  const handleRetryPayment = async () => {
    if (!booking || !bookingId || actionLoading) return;

    const retryToastId = 'booking-detail-payment-retry';
    notify.loading('Opening secure payment...', { id: retryToastId });

    try {
      setActionLoading(true);
      await startCheckoutForBooking(bookingId, booking);
      notify.success('Redirecting to Stripe...', { id: retryToastId });
    } catch (error) {
      console.error('Error retrying payment:', error);
      notify.error(getUserFacingError(error, 'Could not reopen payment. Please try again.'), {
        id: retryToastId,
      });
      setActionLoading(false);
    }
  };

  const handleNavigate = () => {
    const addr = booking?.address || booking?.customerAddress || '';
    const lat = booking?.location?.latitude ?? booking?.coords?.lat ?? booking?.latitude ?? null;
    const lng = booking?.location?.longitude ?? booking?.coords?.lng ?? booking?.longitude ?? null;
    let url = '';
    if (lat != null && lng != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (addr) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
    } else {
      notify.warning('No address or coordinates available for navigation.', {
        id: 'booking-detail-navigation',
      });
      return;
    }
    window.open(url, '_blank');
  };

  // ── Guards ──────────────────────────────────────────────────────────

  if (!bookingId || !visible) return null;
  if (!booking && !loading) return null;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <>
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-confirm-title"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="booking-confirm-title" className="text-lg font-bold text-slate-800">
              {confirmDialog.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{confirmDialog.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action?.();
                }}
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-white/60 backdrop-blur-sm" onClick={onClose}>
        {/* Modal Container */}
        <div
          className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ─── Header ─── */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#6C63FF20' }}>
                <FiFileText size={24} className="text-indigo-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Booking Details</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
              <FiX size={20} className="text-slate-600" />
            </button>
          </div>

          {/* ─── Body ─── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
              <p className="text-sm text-slate-500">Loading booking...</p>
            </div>
          ) : booking ? (
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Status Badge */}
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold tracking-wide ${getStatusTailwind(booking.status)}`}>
                <StatusIcon status={booking.status} size={18} />
                {formatBookingStatus(booking.status)}
              </span>

              {/* Customer OTP Display */}
              {role === 'customer' && booking.status === 'arrived' && booking.serviceOtpPlain && (
                <div className="rounded-2xl p-5 border-2 border-indigo-500" style={{ backgroundColor: 'rgba(108,99,255,0.1)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <FiShield size={24} className="text-indigo-500" />
                    <span className="text-lg font-bold text-indigo-500">Provider Has Arrived</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed mb-4">
                    Share this verification code with your service provider to confirm your presence and start the service:
                  </p>
                  <div className="bg-white rounded-xl py-5 flex items-center justify-center mb-3">
                    <span className="text-4xl font-bold tracking-[8px] text-indigo-500 font-mono">{booking.serviceOtpPlain}</span>
                  </div>
                  <p className="text-xs text-slate-500 text-center italic">Code expires in 10 minutes</p>
                </div>
              )}

              {/* Service Progress */}
              {(booking.status === 'in_progress' || booking.status === 'arrived') && (
                <div
                  className="rounded-xl p-4 border-l-4"
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderLeftColor: booking.status === 'in_progress' ? '#00D68F' : '#00A8FF',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    {booking.status === 'in_progress'
                      ? <FiActivity size={20} className="text-emerald-500" />
                      : <FiMapPin size={20} className="text-sky-500" />
                    }
                    <span className="text-base font-semibold" style={{ color: booking.status === 'in_progress' ? '#00D68F' : '#00A8FF' }}>
                      {booking.status === 'in_progress' ? 'Service In Progress' : 'Provider Arrived'}
                    </span>
                  </div>
                  {booking.serviceStartedAt && booking.status === 'in_progress' && (
                    <p className="text-xs text-slate-500 mt-2">
                      Started: {toDate(booking.serviceStartedAt)?.toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}

              {/* Booking ID */}
              <Section label="Booking ID">
                <p className="text-base font-semibold text-slate-700 font-mono bg-slate-50 p-3 rounded-lg">
                  #{bookingId.substring(0, 10).toUpperCase()}
                </p>
              </Section>

              {/* Service */}
              <Section label="Service">
                <InfoRow icon={<FiBriefcase size={18} className="text-indigo-500" />}>
                  {booking.subcategory || booking.category || booking.serviceName || 'Service'}
                </InfoRow>
                {booking.category && booking.subcategory && (
                  <InfoRow icon={<FiTag size={18} className="text-slate-400" />} muted className="mt-2">
                    {booking.category}
                  </InfoRow>
                )}
              </Section>

              {/* Customer / Provider Information */}
              <Section label={role === 'provider' ? 'Customer Details' : 'Provider Details'}>
                {role === 'provider' ? (
                  <div className="space-y-2">
                    <InfoRow icon={<FiUser size={18} className="text-indigo-500" />}>
                      {booking.customerName || 'Customer'}
                    </InfoRow>
                    {(booking.status === 'accepted' || booking.status === 'completed') && (
                      <>
                        <InfoRow icon={<FiPhone size={18} className="text-indigo-500" />}>
                          {booking.phoneNumber || booking.customerPhone || 'N/A'}
                        </InfoRow>
                        {(booking.customerEmail || booking.email) && (
                          <InfoRow icon={<FiMail size={18} className="text-indigo-500" />}>
                            {booking.customerEmail || booking.email}
                          </InfoRow>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl">
                    {providerProfile?.photoURL || providerProfile?.avatar ? (
                      <img
                        src={providerProfile.photoURL || providerProfile.avatar}
                        alt="Provider"
                        className="w-15 h-15 rounded-full object-cover bg-slate-200"
                      />
                    ) : (
                      <div className="w-15 h-15 rounded-full bg-slate-200 flex items-center justify-center">
                        <FiUser size={32} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-slate-800 mb-1">
                        {providerProfile?.name || providerProfile?.fullName || booking.providerName || 'Provider'}
                      </p>
                      {providerProfile?.gender && (
                        <div className="flex items-center gap-1.5">
                          <FiUser size={14} className="text-slate-400" />
                          <span className="text-xs text-slate-500">{providerProfile.gender.charAt(0).toUpperCase() + providerProfile.gender.slice(1)}</span>
                        </div>
                      )}
                      {(providerProfile?.rating || providerProfile?.avgRating) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <FiStar size={14} className="text-amber-500" />
                          <span className="text-xs text-slate-500">
                            {(providerProfile.rating || providerProfile.avgRating).toFixed(1)} rating
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Section>

              {/* Schedule */}
              <Section label="Schedule">
                <InfoRow icon={<FiCalendar size={18} className="text-indigo-500" />}>
                  {booking.selectedDate || 'Date TBD'}
                </InfoRow>
                <InfoRow icon={<FiClock size={18} className="text-indigo-500" />} className="mt-2">
                  {booking.selectedTime || booking.scheduledTime || 'Time TBD'}
                </InfoRow>
              </Section>

              {/* Address */}
              <Section label="Address">
                <InfoRow icon={<FiMapPin size={18} className="text-indigo-500" />}>
                  {booking.address || booking.customerAddress || 'Address not provided'}
                </InfoRow>
                <div className="flex gap-3 mt-2.5">
                  <button onClick={handleCopyAddress} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold text-indigo-500">
                    <FiCopy size={16} /> Copy
                  </button>
                  <button onClick={handleNavigate} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold text-indigo-500">
                    <FiMap size={16} /> Navigate
                  </button>
                </div>
              </Section>

              {/* Pricing */}
              {(booking.packageData?.price || booking.price) && (
                <Section label="Pricing Details">
                  <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                    {(() => {
                      const rawPrice = booking.packageData?.price || booking.price;
                      const basePrice = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
                      const breakdown = calculatePaymentBreakdownV2(basePrice, {
                        companyCommissionRatePercent: providerCommissionRate ?? undefined,
                      });

                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 font-medium">Service Fee</span>
                            <span className="text-sm text-slate-800 font-semibold">
                              {formatCurrency(basePrice)}
                            </span>
                          </div>
                          {booking.duration && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500 font-medium">Duration</span>
                              <span className="text-sm text-slate-500">{booking.duration}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500 font-medium">
                              Platform Fee ({breakdown.platformFee.rate})
                            </span>
                            <span className="text-sm text-slate-800 font-semibold">
                              {formatCurrency(breakdown.platformFee.amount)}
                            </span>
                          </div>
                          <hr className="border-slate-200" />
                          <div className="flex justify-between items-center">
                            <span className="text-base font-bold text-slate-800">Your Earning</span>
                            <span className="text-lg font-bold text-emerald-600">
                              {formatCurrency(breakdown.providerPayout.amount)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </Section>
              )}

              {/* Payment Status */}
              {booking.paymentStatus && (
                <Section label="Payment Status">
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-xl mb-3"
                    style={{ backgroundColor: booking.paymentStatus === 'paid' ? 'rgba(0,214,143,0.1)' : 'rgba(255,184,0,0.1)' }}
                  >
                    {booking.paymentStatus === 'paid'
                      ? <FiCheckCircle size={18} className="text-emerald-500" />
                      : <FiClock size={18} className="text-amber-500" />
                    }
                    <span className={`text-[15px] font-semibold ${booking.paymentStatus === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {booking.paymentStatus === 'paid' ? 'Payment Received' : 'Pending Payment'}
                    </span>
                  </div>

                  {booking.paymentStatus === 'paid' && (
                    <div className="bg-slate-50 p-3 rounded-xl space-y-2">
                      {booking.totalAmount && (
                        <PaymentRow label="Amount Paid" value={`${booking.currency || 'AUD'} $${booking.totalAmount.toFixed(2)}`} />
                      )}
                      {booking.stripePaymentIntentId && (
                        <PaymentRow label="Transaction ID" value={booking.stripePaymentIntentId.substring(0, 24) + '...'} />
                      )}
                      {booking.stripeSessionId && (
                        <PaymentRow label="Session ID" value={booking.stripeSessionId.substring(0, 24) + '...'} />
                      )}
                      {booking.paidAt && (
                        <PaymentRow
                          label="Payment Date"
                          value={toDate(booking.paidAt)?.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        />
                      )}
                    </div>
                  )}
                </Section>
              )}

              {(booking.refundRequested || booking.refund) && (
                <Section label="Refund Status">
                  <div
                    className={`mb-3 flex items-center gap-2 rounded-xl px-4 py-3 ${
                      booking.refund ? 'bg-emerald-50' : 'bg-sky-50'
                    }`}
                  >
                    {booking.refund ? (
                      <FiCheckCircle size={18} className="text-emerald-500" />
                    ) : (
                      <FiClock size={18} className="text-sky-500" />
                    )}
                    <span
                      className={`text-[15px] font-semibold ${
                        booking.refund ? 'text-emerald-600' : 'text-sky-600'
                      }`}
                    >
                      {booking.refund ? 'Refund Processed' : 'Refund Request Pending'}
                    </span>
                  </div>

                  <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                    {booking.refund?.amount && (
                      <PaymentRow
                        label="Refund Amount"
                        value={`${booking.currency || 'AUD'} $${booking.refund.amount.toFixed(2)}`}
                      />
                    )}
                    {booking.refund?.id && <PaymentRow label="Refund ID" value={booking.refund.id} />}
                    {booking.refundedAt && (
                      <PaymentRow
                        label="Refunded On"
                        value={toDate(booking.refundedAt)?.toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      />
                    )}
                    {booking.refundReason && (
                      <PaymentRow label="Reason" value={booking.refundReason} />
                    )}
                    {booking.refundRequestedAt && !booking.refund && (
                      <PaymentRow
                        label="Requested On"
                        value={toDate(booking.refundRequestedAt)?.toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      />
                    )}
                    {booking.refundRequested && !booking.refund && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-white p-3 text-sm font-semibold text-slate-600">
                        <FiInfo className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                        <p>
                          Your refund request is being reviewed by our admin team. You will receive
                          an email once processed.
                        </p>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Special Instructions */}
              {booking.specialInstructions && (
                <Section label="Special Instructions">
                  <div className="bg-slate-50 p-4 rounded-xl border-l-[3px] border-indigo-500">
                    <p className="text-sm text-slate-700 leading-relaxed">{booking.specialInstructions}</p>
                  </div>
                </Section>
              )}

              {/* Service Duration (completed) */}
              {booking.status === 'completed' && booking.actualServiceDuration && (
                <Section label="Service Duration">
                  <InfoRow icon={<FiClock size={18} className="text-emerald-500" />}>
                    {booking.actualServiceDuration} minutes ({booking.serviceDurationHours || (booking.actualServiceDuration / 60).toFixed(2)} hours)
                  </InfoRow>
                  {booking.serviceStartedAt && booking.completedAt && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      <p className="text-xs text-slate-500">Started: {toDate(booking.serviceStartedAt)?.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Completed: {toDate(booking.completedAt)?.toLocaleString()}</p>
                    </div>
                  )}
                </Section>
              )}

              {/* Rating Section (completed) */}
              {booking.status === 'completed' && (
                <Section label="Service Rating">
                  {role === 'provider' && (
                    <RatingDisplayCard
                      title="Your Rating of Customer"
                      icon={<FiUser size={18} className="text-indigo-500" />}
                      ratingData={booking.providerRating}
                      onRate={() => setShowRatingModal(true)}
                      rateLabel="Rate Customer"
                    />
                  )}
                  {role === 'customer' && (
                    <RatingDisplayCard
                      title="Your Rating of Provider"
                      icon={<FiBriefcase size={18} className="text-indigo-500" />}
                      ratingData={booking.customerRating}
                      onRate={() => setShowRatingModal(true)}
                      rateLabel="Rate Provider"
                      completedAt={booking.completedAt}
                    />
                  )}
                </Section>
              )}

              {/* Unavailability Attempts */}
              {booking.unavailabilityAttempts?.length > 0 && (
                <Section label={`Arrival Attempts (${booking.unavailabilityAttempts.length})`}>
                  {booking.unavailabilityAttempts.map((attempt, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl p-3 mb-3 border-l-[3px] border-amber-500">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1.5">
                          <FiAlertTriangle size={14} className="text-amber-500" />
                          <span className="text-[13px] font-semibold text-amber-500">Attempt #{attempt.attemptNumber}</span>
                        </div>
                        {attempt.timestamp && (
                          <span className="text-[11px] text-slate-400">{toDate(attempt.timestamp)?.toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                        <FiMessageCircle size={16} className="text-slate-400 mt-0.5 shrink-0" />
                        <p className="text-[13px] text-slate-700 leading-relaxed">{attempt.note}</p>
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {/* Package Details */}
              {booking.packageData?.description && (
                <Section label="Package Details">
                  <div className="bg-slate-50 p-4 rounded-xl border-l-[3px] border-indigo-500">
                    <p className="text-sm text-slate-700 leading-relaxed">{booking.packageData.description}</p>
                  </div>
                </Section>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <FiAlertCircle size={48} className="text-red-500" />
              <p className="text-base font-semibold text-red-500">Booking not found</p>
            </div>
          )}

          {/* ─── Actions ─── */}
          {booking && (
            <div className="px-5 py-4 border-t border-slate-100 shrink-0">
              {role === 'provider' ? (
                <ProviderActions
                  booking={booking}
                  actionLoading={actionLoading}
                  otpSending={otpSending}
                  otpInput={otpInput}
                  setOtpInput={setOtpInput}
                  showUnavailableInput={showUnavailableInput}
                  setShowUnavailableInput={setShowUnavailableInput}
                  unavailableNote={unavailableNote}
                  setUnavailableNote={setUnavailableNote}
                  onAccept={handleAcceptBooking}
                  onReject={handleRejectBooking}
                  onCancel={handleCancelBooking}
                  onComplete={handleCompleteBooking}
                  onArrived={handleMarkAsArrived}
                  onVerifyOtp={handleVerifyOtp}
                  onCustomerUnavailable={handleCustomerUnavailable}
                  onOpenChat={handleOpenBookingChat}
                  onClose={onClose}
                />
              ) : (
              <CustomerActions
                booking={booking}
                actionLoading={actionLoading}
                onCancel={handleCancelBooking}
                onRetryPayment={handleRetryPayment}
                onProviderNotReached={handleProviderNotReachedAction}
                providerNotReachedHint={getProviderNotReachedHint()}
                providerNotReachedState={providerNotReachedState}
                isNotReachedButtonDisabled={isNotReachedButtonDisabled}
                reportingNotReached={reportingNotReached}
                onOpenChat={handleOpenBookingChat}
                onOpenSupport={handleOpenSupport}
                onRequestRefund={handleRequestRefund}
                onClose={onClose}
              />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Rating Modal ─── */}
      {chatContext && (
        <div
          className="fixed inset-0 z-[75] flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-chat-title"
          onClick={handleCloseBookingChat}
        >
          <div
            className="flex h-[82vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 id="booking-chat-title" className="text-lg font-bold text-slate-900">
                  {chatContext.otherUserName}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Booking #{String(bookingId || '').slice(0, 10).toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseBookingChat}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="Close chat"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
              {chatLoading ? (
                <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
                  Loading chat...
                </div>
              ) : chatMessages.length ? (
                chatMessages.map((message) => {
                  const mine = message.fromId === user?.uid;
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm font-semibold leading-5 shadow-sm ${
                          mine
                            ? 'rounded-br-md bg-indigo-500 text-white'
                            : 'rounded-bl-md bg-white text-slate-800'
                        }`}
                      >
                        <p>{message.text}</p>
                        {message.createdAt && (
                          <p className={`mt-1 text-[10px] ${mine ? 'text-indigo-100' : 'text-slate-400'}`}>
                            {message.createdAt.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full items-center justify-center px-8 text-center text-sm font-semibold leading-6 text-slate-500">
                  No messages yet. Start the booking conversation here.
                </div>
              )}
            </div>

            <form
              onSubmit={handleSendBookingChatMessage}
              className="flex items-end gap-2 border-t border-slate-100 bg-white p-4"
            >
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Type a message..."
                rows={1}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400"
              />
              <button
                type="submit"
                disabled={chatSending || !chatInput.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:bg-slate-300"
                aria-label="Send message"
              >
                <FiSend className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {showLatenessPolicyModal && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lateness-policy-title"
          onClick={closeLatenessPolicyModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
                <FiAlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <h3 id="lateness-policy-title" className="text-lg font-bold text-slate-900">
                  Lateness Policy
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Review policy steps before marking arrival
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  Current Status
                </p>
                <p className="mt-1 text-lg font-bold text-amber-900">
                  {latenessSnapshot?.hasSchedule
                    ? formatLateness(latenessSnapshot?.minutesLate || 0)
                    : 'Scheduled time unavailable'}
                </p>
              </div>

              <section>
                <h4 className="text-sm font-bold text-slate-900">Policy Timeline</h4>
                <div className="mt-3 space-y-3">
                  {LATENESS_POLICY_STEPS.map((step) => {
                    const reached =
                      Number.isFinite(latenessSnapshot?.minutesLate) &&
                      latenessSnapshot.minutesLate >= step.threshold;
                    return (
                      <div key={step.key} className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            reached
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {reached ? (
                            <FiCheckCircle className="h-4 w-4" />
                          ) : (
                            <FiClock className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {step.title} ({step.threshold}+ min)
                          </p>
                          <p className="mt-1 text-sm leading-5 text-slate-500">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold text-slate-900">Provider Instructions</h4>
                <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
                  <p>1. Update ETA to customer using message or email.</p>
                  <p>2. Keep communication clear when delayed.</p>
                  <p>3. Continue with OTP only after arrival at location.</p>
                  <p>4. Repeated lateness can lead to account action.</p>
                </div>
              </section>
            </div>

            <div className="grid gap-2 border-t border-slate-100 p-4 sm:grid-cols-3">
              <button
                type="button"
                onClick={closeLatenessPolicyModal}
                className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleOpenSupport}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <FiMail className="h-4 w-4" />
                Support
              </button>
              <button
                type="button"
                onClick={() => {
                  closeLatenessPolicyModal();
                  confirmAndSendArrivalOtp();
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 text-sm font-bold text-white transition hover:bg-indigo-600"
              >
                <FiCheck className="h-4 w-4" />
                Proceed & Send Code
              </button>
            </div>
          </div>
        </div>
      )}

      {showRatingModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-5" onClick={() => setShowRatingModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-100 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(255,184,0,0.15)' }}>
                <FiStar size={32} className="text-amber-500" />
              </div>
              <h3 className="text-[22px] font-bold text-slate-800 mb-2">
                {role === 'provider' ? 'Rate Customer' : 'Rate Service Provider'}
              </h3>
              <p className="text-[15px] text-slate-500">How was your experience?</p>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-2 my-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} className="p-1 transition-transform hover:scale-110">
                  <FiStar
                    size={48}
                    className={star <= rating ? 'fill-amber-500 text-amber-500' : 'text-slate-200'}
                  />
                </button>
              ))}
            </div>

            {/* Description */}
            {rating > 0 && (
              <p className="text-center text-lg font-semibold text-indigo-500 mb-4">
                {rating === 5 ? '😊 Excellent!' : rating === 4 ? '👍 Good' : rating === 3 ? '😐 Average' : rating === 2 ? '👎 Below Average' : '😞 Poor'}
              </p>
            )}

            {/* Feedback */}
            {rating > 0 && rating < 5 && (
              <div className="mb-5">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 mb-2.5">
                  <FiMessageCircle size={14} /> Please share your feedback:
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-800 min-h-25 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={ratingFeedback}
                  onChange={(e) => setRatingFeedback(e.target.value)}
                  placeholder="What could be improved?"
                  maxLength={500}
                />
                <p className="text-[11px] text-slate-400 text-right mt-1.5">{ratingFeedback.length}/500 characters</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRatingModal(false); setRating(0); setRatingFeedback(''); }}
                className="flex-1 py-3.5 rounded-xl bg-slate-50 border-[1.5px] border-slate-200 text-[15px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Skip for Now
              </button>
              <button
                onClick={handleSubmitRating}
                disabled={submittingRating || rating === 0 || (rating < 5 && !ratingFeedback.trim())}
                className="flex-1 py-3.5 rounded-xl bg-indigo-500 text-[15px] font-semibold text-white flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors disabled:bg-slate-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/30"
              >
                {submittingRating ? 'Submitting...' : <><FiSend size={16} /> Submit Rating</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ═══ Sub-Components ═══════════════════════════════════════════════════ */

const Section = ({ label, children }) => (
  <div className="mb-1">
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label}</p>
    {children}
  </div>
);

const InfoRow = ({ icon, children, muted, className = '' }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    {icon}
    <span className={`text-[15px] flex-1 font-medium ${muted ? 'text-slate-500 text-sm' : 'text-slate-800'}`}>{children}</span>
  </div>
);

const PaymentRow = ({ label, value }) => (
  <div className="flex justify-between items-start py-1">
    <span className="text-[13px] text-slate-500 font-medium flex-1">{label}</span>
    <span className="text-[13px] text-slate-800 font-semibold flex-1 text-right truncate">{value}</span>
  </div>
);

const RatingDisplayCard = ({ title, icon, ratingData, onRate, rateLabel, completedAt }) => {
  const toDate = (v) => { if (!v) return null; if (v.toDate) return v.toDate(); return new Date(v); };

  if (ratingData) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 mt-3 border border-slate-100">
        <div className="flex items-center gap-2 mb-3">{icon}<span className="text-[15px] font-semibold text-slate-800">{title}</span></div>
        <div className="text-center py-2">
          <div className="flex justify-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <FiStar key={star} size={24} className={star <= ratingData.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-200'} />
            ))}
          </div>
          <p className="text-sm text-slate-800 font-medium mb-1">
            You rated {ratingData.rating} star{ratingData.rating !== 1 ? 's' : ''}
          </p>
          {ratingData.ratedAt && (
            <p className="text-xs text-slate-500">Rated on {toDate(ratingData.ratedAt)?.toLocaleDateString()}</p>
          )}
        </div>
      </div>
    );
  }

  // Not yet rated
  let expired = false;
  if (completedAt) {
    const completedTime = toDate(completedAt);
    if (completedTime && (new Date() - completedTime) / 60000 > 5) expired = true;
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 mt-3 border border-slate-100">
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-[15px] font-semibold text-slate-800">{title}</span></div>
      <div className="text-center py-2">
        {expired ? (
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 rounded-lg">
            <FiClock size={20} className="text-slate-400" />
            <span className="text-[13px] text-slate-500 italic">Rating window expired (5 min limit)</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-3">{completedAt ? 'Rate your experience (within 5 minutes)' : `Tap below to ${rateLabel?.toLowerCase()}`}</p>
            <button
              onClick={onRate}
              className="inline-flex items-center gap-2 py-3 px-6 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-500/30"
            >
              <FiStar size={16} /> {rateLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ═══ Provider Action Buttons ══════════════════════════════════════════ */

const ProviderActions = ({
  booking, actionLoading, otpSending, otpInput, setOtpInput,
  showUnavailableInput, setShowUnavailableInput, unavailableNote, setUnavailableNote,
  onAccept, onReject, onCancel, onComplete, onArrived, onVerifyOtp, onCustomerUnavailable,
  onOpenChat, onClose,
}) => {
  const btnBase = 'flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-60';

  return (
    <>
      {/* Pending / Upcoming */}
      {(booking.status === 'pending' || booking.status === 'upcoming') && (
        <div className="flex gap-3">
          <button onClick={onReject} disabled={actionLoading} className={`${btnBase} bg-white border-2 border-red-500 text-red-500 hover:bg-red-50`}>
            <FiX size={18} /> {actionLoading ? 'Processing...' : 'Reject'}
          </button>
          <button onClick={onAccept} disabled={actionLoading} className={`${btnBase} bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/30`}>
            <FiCheck size={18} /> {actionLoading ? 'Processing...' : 'Accept'}
          </button>
        </div>
      )}

      {/* Accepted */}
      {booking.status === 'accepted' && (
        <div className="space-y-3">
          <button onClick={onOpenChat} className={`${btnBase} w-full bg-sky-50 text-sky-700 hover:bg-sky-100`}>
            <FiMessageCircle size={18} /> Message
          </button>
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={actionLoading} className={`${btnBase} bg-white border-2 border-red-500 text-red-500 hover:bg-red-50`}>
              <FiXCircle size={18} /> {actionLoading ? 'Processing...' : 'Cancel'}
            </button>
            <button onClick={onArrived} disabled={otpSending} className={`${btnBase} bg-sky-500 text-white hover:bg-sky-600 shadow-md shadow-sky-500/30`}>
              <FiMapPin size={18} /> {otpSending ? 'Sending...' : 'Mark as Arrived'}
            </button>
          </div>
        </div>
      )}

      {/* Arrived — OTP entry */}
      {booking.status === 'arrived' && (
        <div className="bg-slate-50 p-4 rounded-xl space-y-3">
          <p className="text-sm font-semibold text-slate-800 mb-2">Enter Customer's Verification Code</p>
          <div className="flex gap-3 items-center">
            <input
              className="flex-1 bg-white border-2 border-indigo-500 rounded-xl px-4 py-3 text-lg font-bold tracking-[4px] text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              maxLength={6}
              autoFocus
            />
            <button
              onClick={onVerifyOtp}
              disabled={actionLoading || otpInput.length !== 6}
              className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-3 rounded-xl font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiCheckCircle size={18} /> {actionLoading ? 'Verifying...' : 'Verify & Start'}
            </button>
          </div>

          <div className="flex justify-between items-center mt-3">
            <button onClick={onArrived} disabled={otpSending} className="text-sm font-semibold text-indigo-500 hover:underline py-2 px-3">
              {otpSending ? 'Sending...' : 'Resend Code'}
            </button>
            <button
              onClick={() => setShowUnavailableInput(!showUnavailableInput)}
              className="flex items-center gap-1.5 py-2 px-3 rounded-lg text-[13px] font-semibold text-amber-600"
              style={{ backgroundColor: 'rgba(255,184,0,0.1)' }}
            >
              <FiAlertCircle size={16} /> Customer Not Available
            </button>
          </div>

          {showUnavailableInput && (
            <div className="mt-4 p-3 bg-white rounded-lg border border-amber-200">
              <p className="text-[13px] font-semibold text-slate-800 mb-2">Add Note (Required)</p>
              <textarea
                className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-800 min-h-20 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={unavailableNote}
                onChange={(e) => setUnavailableNote(e.target.value)}
                placeholder="e.g., Customer not home, door locked, no response..."
                maxLength={200}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { setShowUnavailableInput(false); setUnavailableNote(''); }}
                  className="flex-1 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={onCustomerUnavailable}
                  disabled={actionLoading || !unavailableNote.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-amber-500 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:bg-slate-400 disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Record & Return'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* In Progress */}
      {booking.status === 'in_progress' && (
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(0,214,143,0.15)' }}>
            <FiClock size={20} className="text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-500">Service in progress...</span>
          </div>
          <button onClick={onComplete} disabled={actionLoading} className={`${btnBase} bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/30`}>
            <FiCheckCircle size={18} /> {actionLoading ? 'Processing...' : 'Complete'}
          </button>
        </div>
      )}

      {/* Completed / Rejected / Cancelled */}
      {(booking.status === 'completed' || booking.status === 'rejected' || booking.status === 'cancelled') && (
        <button onClick={onClose} className={`w-full py-4 rounded-xl bg-indigo-500 text-white font-semibold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-500/30`}>
          <FiCheck size={18} /> Close
        </button>
      )}
    </>
  );
};

/* ═══ Customer Action Buttons ══════════════════════════════════════════ */

const CustomerActions = ({
  booking,
  actionLoading,
  onCancel,
  onRetryPayment,
  onProviderNotReached,
  providerNotReachedHint,
  providerNotReachedState,
  isNotReachedButtonDisabled,
  reportingNotReached,
  onOpenChat,
  onOpenSupport,
  onRequestRefund,
  onClose,
}) => {
  const btnBase = 'flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-60';
  const needsPayment = booking.paymentStatus === 'pending' && booking.status !== 'cancelled';

  if (needsPayment) {
    return (
      <div className="space-y-3">
        <button
          onClick={onRetryPayment}
          disabled={actionLoading}
          className={`${btnBase} w-full bg-indigo-500 text-white hover:bg-indigo-600 shadow-md shadow-indigo-500/30`}
        >
          <FiShield size={18} /> {actionLoading ? 'Opening Payment...' : 'Complete Payment'}
        </button>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={actionLoading} className={`${btnBase} bg-white border-2 border-red-500 text-red-500 hover:bg-red-50`}>
            <FiXCircle size={18} /> Cancel Booking
          </button>
          <button onClick={onClose} className="flex-[0.5] py-4 rounded-xl bg-slate-50 border-[1.5px] border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (booking.status === 'pending' || booking.status === 'upcoming' || booking.status === 'accepted') {
    return (
      <div className="space-y-3">
        {booking.status === 'accepted' && (
          <button
            type="button"
            onClick={onOpenChat}
            className={`${btnBase} w-full bg-sky-50 text-sky-700 hover:bg-sky-100`}
          >
            <FiMessageCircle size={18} /> Message
          </button>
        )}

        {booking.status === 'accepted' && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <FiAlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-bold text-amber-900">Service Provider Not Reached</p>
            </div>
            <p className="mt-2 text-sm font-semibold leading-5 text-amber-800">
              {providerNotReachedHint}
            </p>
            {booking.providerNotReachedAlert?.supportCaseCode && (
              <button
                type="button"
                onClick={onOpenSupport}
                className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-sky-700 hover:underline"
              >
                Reference: {booking.providerNotReachedAlert.supportCaseCode}
              </button>
            )}
            <button
              type="button"
              onClick={onProviderNotReached}
              disabled={isNotReachedButtonDisabled}
              className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed ${
                providerNotReachedState?.alreadyReported
                  ? 'bg-sky-500 text-white hover:bg-sky-600'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              } disabled:bg-slate-200 disabled:text-slate-400`}
            >
              {providerNotReachedState?.alreadyReported ? (
                <FiMessageCircle className="h-4 w-4" />
              ) : (
                <FiAlertCircle className="h-4 w-4" />
              )}
              {reportingNotReached
                ? 'Sending Alert...'
                : providerNotReachedState?.alreadyReported
                  ? 'Open Support Chat'
                  : 'Service Provider Not Reached'}
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={actionLoading} className={`${btnBase} bg-white border-2 border-red-500 text-red-500 hover:bg-red-50`}>
            <FiXCircle size={18} /> {actionLoading ? 'Processing...' : 'Cancel Booking'}
          </button>
          <button onClick={onClose} className="flex-[0.5] py-4 rounded-xl bg-slate-50 border-[1.5px] border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (
    (booking.status === 'cancelled' || booking.status === 'rejected') &&
    booking.paymentStatus === 'paid' &&
    !booking.refundRequested &&
    !booking.refund
  ) {
    return (
      <div className="flex gap-3">
        <button onClick={onRequestRefund} disabled={actionLoading} className={`${btnBase} bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/30`}>
          <FiDollarSign size={18} /> {actionLoading ? 'Submitting...' : 'Request Refund'}
        </button>
        <button onClick={onClose} className="flex-[0.5] py-4 rounded-xl bg-slate-50 border-[1.5px] border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
          Close
        </button>
      </div>
    );
  }

  return (
    <button onClick={onClose} className="w-full py-4 rounded-xl bg-indigo-500 text-white font-semibold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-500/30">
      <FiCheck size={18} /> Close
    </button>
  );
};

export default BookingDetailModal;
