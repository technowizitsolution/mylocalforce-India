import React, { useEffect, useMemo, useState } from 'react';
import {
  FiBell,
  FiBellOff,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiInbox,
  FiSettings,
} from 'react-icons/fi';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../../context/AuthContext';
import {
  isAppPushPermissionEnabled,
  requestNotificationPermission,
  updatePushNotificationPreference,
} from '../../services/firebase';
import { firestore } from '../../services/firebase/firebaseConfig';
import { notify, getUserFacingError } from '../../utils/toast';

const isToggleExplicitlyDisabled = (value) => {
  if (value === false) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['false', '0', 'no', 'off', 'disabled'].includes(normalized);
};

const getTimestamp = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatNotificationDate = (notification) => {
  const timestamp = getTimestamp(notification.createdAt || notification.updatedAt);
  if (!timestamp) return 'Just now';

  const date = new Date(timestamp);
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.floor((now - timestamp) / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
};

const getNotificationTone = (notification) => {
  const type = String(notification?.data?.type || '').toLowerCase();

  if (type.includes('cancel')) {
    return {
      icon: FiBellOff,
      bg: 'bg-red-50',
      text: 'text-red-500',
      border: 'border-red-100',
    };
  }

  if (type.includes('complete') || type.includes('paid')) {
    return {
      icon: FiCheckCircle,
      bg: 'bg-[#4ECDC4]/10',
      text: 'text-[#1E9E94]',
      border: 'border-[#4ECDC4]/20',
    };
  }

  if (type.includes('booking') || type.includes('lead')) {
    return {
      icon: FiClock,
      bg: 'bg-[#6C63FF]/10',
      text: 'text-[#5A52E3]',
      border: 'border-[#6C63FF]/20',
    };
  }

  return {
    icon: FiBell,
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
  };
};

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [customerPushEnabled, setCustomerPushEnabled] = useState(true);
  const [pushPreferenceUpdating, setPushPreferenceUpdating] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const notificationSettings =
      user?.notificationSettings && typeof user.notificationSettings === 'object'
        ? user.notificationSettings
        : {};
    const disabled =
      isToggleExplicitlyDisabled(user?.pushNotificationsEnabled) ||
      isToggleExplicitlyDisabled(notificationSettings.pushEnabled) ||
      isToggleExplicitlyDisabled(notificationSettings.customerPushEnabled);

    setCustomerPushEnabled(!disabled);
  }, [
    user?.pushNotificationsEnabled,
    user?.notificationSettings,
    user?.notificationSettings?.pushEnabled,
    user?.notificationSettings?.customerPushEnabled,
  ]);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const notificationsRef = collection(firestore, 'notifications');
    const notificationsQuery = query(
      notificationsRef,
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const nextNotifications = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .filter((notification) => {
            const role = notification?.data?.role || notification?.role;
            return !role || role === 'customer';
          })
          .sort(
            (a, b) =>
              getTimestamp(b.createdAt || b.updatedAt) -
              getTimestamp(a.createdAt || a.updatedAt)
          );

        setNotifications(nextNotifications);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading notifications:', error);
        setNotifications([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((notification) => !notification.read);
    }
    if (filter === 'read') {
      return notifications.filter((notification) => notification.read);
    }
    return notifications;
  }, [filter, notifications]);

  const filterItems = [
    { key: 'all', label: 'All', count: notifications.length },
    { key: 'unread', label: 'Unread', count: unreadNotifications.length },
    {
      key: 'read',
      label: 'Read',
      count: notifications.length - unreadNotifications.length,
    },
  ];

  const handlePushPreferenceToggle = async (nextValue) => {
    if (!user?.uid || pushPreferenceUpdating) return;

    if (nextValue) {
      const permissionGranted = await requestNotificationPermission();
      const systemPushEnabled = await isAppPushPermissionEnabled();
      if (!permissionGranted || !systemPushEnabled) {
        notify.warning(
          'Push notifications are off in your browser settings. Please enable them to receive updates.',
          { id: 'notifications-push' }
        );
        return;
      }
    }

    const previousValue = customerPushEnabled;
    setCustomerPushEnabled(nextValue);
    setPushPreferenceUpdating(true);

    try {
      await updatePushNotificationPreference(user.uid, 'customer', nextValue);
      notify.success(
        `Push notifications ${nextValue ? 'enabled' : 'disabled'}.`,
        { id: 'notifications-push' }
      );
    } catch (error) {
      setCustomerPushEnabled(previousValue);
      notify.error(
        getUserFacingError(
          error,
          'We could not update your push notification preference. Please try again.'
        ),
        { id: 'notifications-push' }
      );
    } finally {
      setPushPreferenceUpdating(false);
    }
  };

  const handleMarkRead = async (notificationId) => {
    if (!user?.uid || !notificationId) return;

    try {
      await updateDoc(doc(firestore, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString(),
      });
    } catch (error) {
      notify.error(
        getUserFacingError(error, 'Could not mark notification as read.'),
        { id: 'notifications-mark-read' }
      );
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.uid || unreadNotifications.length === 0 || markingAll) return;

    try {
      setMarkingAll(true);
      await Promise.all(
        unreadNotifications.map((notification) =>
          updateDoc(doc(firestore, 'notifications', notification.id), {
            read: true,
            readAt: new Date().toISOString(),
          })
        )
      );
      notify.success('All notifications marked as read.', {
        id: 'notifications-mark-all',
      });
    } catch (error) {
      notify.error(
        getUserFacingError(error, 'Could not mark all notifications as read.'),
        { id: 'notifications-mark-all' }
      );
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <AccountLayout
      title="Notifications"
      subtitle="Review booking alerts, reminders, and account updates."
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Notification Center</h2>
              <p className="mt-1 text-sm text-slate-500">
                {unreadNotifications.length > 0
                  ? `${unreadNotifications.length} unread update${
                      unreadNotifications.length === 1 ? '' : 's'
                    } need your attention.`
                  : 'You are all caught up.'}
              </p>
            </div>

            <button
              onClick={handleMarkAllRead}
              disabled={unreadNotifications.length === 0 || markingAll}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-[#6C63FF]/30 hover:bg-indigo-50 hover:text-[#5A52E3] ${
                unreadNotifications.length === 0 || markingAll
                  ? 'cursor-not-allowed opacity-60'
                  : ''
              }`}
              type="button"
            >
              {markingAll ? (
                <span className="h-4 w-4 rounded-full border-2 border-[#5A52E3] border-t-transparent animate-spin" />
              ) : (
                <FiCheck size={16} />
              )}
              Mark all read
            </button>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {filterItems.map((item) => {
              const isActive = filter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-[#6C63FF] text-white shadow-sm'
                      : 'border border-slate-200 bg-[#F8FAFC] text-slate-600 hover:bg-white'
                  }`}
                  type="button"
                >
                  {item.label}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-500'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`notification-skeleton-${index}`}
                  className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4"
                >
                  <div className="flex gap-3">
                    <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredNotifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-[#F8FAFC] p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#5A52E3] shadow-sm">
                  <FiInbox size={24} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">
                  No notifications here
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  New booking and account updates will show up in this list.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const tone = getNotificationTone(notification);
                const Icon = tone.icon;
                return (
                  <article
                    key={notification.id}
                    className={`rounded-2xl border p-4 transition-colors ${
                      notification.read
                        ? 'border-slate-200 bg-white'
                        : 'border-[#6C63FF]/20 bg-[#6C63FF]/5'
                    }`}
                  >
                    <div className="flex gap-3">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone.bg} ${tone.text} ${tone.border}`}
                      >
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-950">
                              {notification.title || 'Notification'}
                            </h3>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {notification.body || 'You have a new account update.'}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-slate-500">
                            {formatNotificationDate(notification)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {!notification.read ? (
                            <button
                              onClick={() => handleMarkRead(notification.id)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#5A52E3] ring-1 ring-[#6C63FF]/20 transition-colors hover:bg-indigo-50"
                              type="button"
                            >
                              <FiCheck size={13} />
                              Mark read
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                              <FiCheckCircle size={13} />
                              Read
                            </span>
                          )}
                          {notification?.data?.type ? (
                            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                              {String(notification.data.type).replaceAll('_', ' ')}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Push Notifications
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Receive booking updates even when this page is closed.
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6C63FF]/10 text-[#5A52E3]">
                <FiSettings size={20} />
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Browser alerts
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {customerPushEnabled ? 'Currently enabled' : 'Currently disabled'}
                </p>
              </div>
              {pushPreferenceUpdating ? (
                <div className="h-5 w-5 rounded-full border-2 border-[#6C63FF] border-t-transparent animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={() => handlePushPreferenceToggle(!customerPushEnabled)}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    customerPushEnabled ? 'bg-[#6C63FF]' : 'bg-slate-300'
                  }`}
                  aria-pressed={customerPushEnabled}
                >
                  <span
                    className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      customerPushEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#4ECDC4]/25 bg-[#4ECDC4]/10 p-5">
            <h3 className="text-sm font-semibold text-slate-950">What appears here?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Booking confirmations, provider responses, cancellations, payment updates,
              and customer account notices are collected in this center.
            </p>
          </section>
        </aside>
      </div>
    </AccountLayout>
  );
};

export default Notifications;
