import React, { useEffect, useMemo, useState } from 'react';
import {
  FiAward,
  FiBell,
  FiBellOff,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiTrash2,
  FiXCircle,
} from 'react-icons/fi';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { firestore } from '../services/firebase/firebaseConfig';
import { deleteNotification } from '../services/firebase/notificationService';
import { notify } from '../utils/toast';

const CUSTOMER_TYPES = new Set([
  'BOOKING_CREATED',
  'BOOKING_ACCEPTED',
  'BOOKING_COMPLETED',
  'BOOKING_STARTED',
  'LEAD_ACCEPTED',
  'LEAD_OFFER',
  'PROVIDER_CONFIRMED',
  'PROVIDER_REJECTED',
]);

const PROVIDER_TYPES = new Set([
  'NEW_BOOKING',
  'NEW_LEAD',
  'LEAD_REJECTED',
  'LEAD_FINALIZED',
  'LEAD_CLAIMED_BY_OTHER',
]);

const getTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const inferRole = (data = {}) => {
  const explicitRole = String(data.role || '')
    .trim()
    .toLowerCase();
  if (explicitRole === 'provider' || explicitRole === 'client') return 'provider';
  if (explicitRole === 'customer' || explicitRole === 'user') return 'customer';

  const type = String(data.type || data.templateKey || '')
    .trim()
    .toUpperCase();
  if (type && CUSTOMER_TYPES.has(type)) return 'customer';
  if (type && PROVIDER_TYPES.has(type)) return 'provider';

  const screen = String(data.screen || '')
    .trim()
    .toLowerCase();
  if (screen === 'bookings') return 'customer';
  if (screen === 'clientbookings') return 'provider';
  return 'any';
};

const dedupeNotifications = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    const data = item?.data || {};
    const type =
      String(data.type || data.templateKey || '')
        .trim()
        .toUpperCase() || 'GENERIC';
    const referenceId =
      data.bookingId ||
      data.leadId ||
      data.id ||
      `${item?.title || 'title'}:${item?.body || 'body'}`;
    const role = inferRole(data);
    const key = `${role}:${type}:${referenceId}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getNotificationTone = (type) => {
  switch (String(type || '').toUpperCase()) {
    case 'NEW_BOOKING':
      return { Icon: FiCalendar, bg: 'bg-emerald-50', text: 'text-emerald-600' };
    case 'BOOKING_ACCEPTED':
      return { Icon: FiCheckCircle, bg: 'bg-emerald-50', text: 'text-emerald-600' };
    case 'BOOKING_COMPLETED':
      return { Icon: FiAward, bg: 'bg-indigo-50', text: 'text-[#5A52E3]' };
    case 'BOOKING_CANCELLED':
      return { Icon: FiXCircle, bg: 'bg-rose-50', text: 'text-rose-500' };
    case 'NEW_LEAD':
      return { Icon: FiClock, bg: 'bg-amber-50', text: 'text-amber-600' };
    default:
      return { Icon: FiBell, bg: 'bg-slate-100', text: 'text-slate-500' };
  }
};

const formatTime = (timestamp) => {
  const time = getTimestamp(timestamp);
  if (!time) return 'Just now';

  const diffMins = Math.floor((Date.now() - time) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(time).toLocaleDateString('en-AU');
};

const ProviderNotificationsScreen = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    const notificationsRef = collection(firestore, 'notifications');
    const notificationsQuery = query(notificationsRef, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const providerNotifications = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter((notification) => inferRole(notification?.data || {}) === 'provider')
          .sort(
            (a, b) =>
              getTimestamp(b.createdAt || b.updatedAt) - getTimestamp(a.createdAt || a.updatedAt)
          );

        setNotifications(dedupeNotifications(providerNotifications));
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching provider notifications:', error);
        setNotifications([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(firestore, 'notifications', notificationId), { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter((notification) => !notification.read);
    try {
      await Promise.all(
        unreadNotifications.map((notification) =>
          updateDoc(doc(firestore, 'notifications', notification.id), { read: true })
        )
      );
      notify.success('All notifications marked as read');
    } catch (error) {
      notify.error('Failed to mark notifications as read');
    }
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.read) await markAsRead(notification.id);

    if (notification?.data?.bookingId) {
      notify.info('Booking detail view is coming to provider web soon.');
    } else if (notification?.data?.leadId) {
      notify.info('Lead detail view is coming to provider web soon.');
    }
  };

  const handleDelete = async (notification) => {
    if (!window.confirm('Delete this notification?')) return;

    try {
      setDeletingId(notification.id);
      const success = await deleteNotification(notification.id, user.uid);
      if (!success) throw new Error('Delete failed');
      notify.success('Notification deleted');
    } catch (error) {
      notify.error('Failed to delete notification');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <ProviderAppLayout>
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Provider booking and lead updates.
          </p>
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={markAllAsRead}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#5A52E3] shadow-sm hover:bg-indigo-50"
          >
            Mark all read
          </button>
        ) : null}
      </header>

      {notifications.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <FiBellOff className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="mt-4 text-lg font-black text-slate-900">No notifications yet</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            You will be notified when you receive new booking requests.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {notifications.map((notification) => {
            const { Icon, bg, text } = getNotificationTone(notification?.data?.type);

            return (
              <article
                key={notification.id}
                className={`rounded-lg border bg-white p-4 shadow-sm ${
                  notification.read
                    ? 'border-slate-200'
                    : 'border-indigo-200 ring-1 ring-indigo-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleNotificationPress(notification)}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}
                    >
                      <Icon className={`h-6 w-6 ${text}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block font-black ${notification.read ? 'text-slate-800' : 'text-slate-950'}`}
                      >
                        {notification.title || 'Notification'}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-slate-500">
                        {notification.body || 'Open for details.'}
                      </span>
                      <span className="mt-2 block text-xs font-bold text-slate-400">
                        {formatTime(notification.createdAt || notification.updatedAt)}
                      </span>
                    </span>
                    {!notification.read ? (
                      <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[#5A52E3]" />
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(notification)}
                    disabled={deletingId === notification.id}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 disabled:opacity-60"
                    aria-label="Delete notification"
                  >
                    <FiTrash2 className="h-5 w-5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Footer />
    </ProviderAppLayout>
  );
};

export default ProviderNotificationsScreen;
