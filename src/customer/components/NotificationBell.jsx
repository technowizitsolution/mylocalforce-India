import React, { useState, useEffect } from 'react';
import { FiBell } from 'react-icons/fi';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../services/firebase/firebaseConfig';
import { useAuth } from '../../context/AuthContext';

const NotificationBell = ({
  onPress,
  size = 20,
  color = '#5A52E3',
  role = 'customer',
}) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    // Listen to real-time unread notifications count filtered by role
    const notificationsRef = collection(firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', user.uid),
      where('read', '==', false),
      where('data.role', '==', role)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setUnreadCount(snapshot.size);
      },
      (error) => {
        console.error('Error fetching unread count:', error);
        setUnreadCount(0);
      }
    );

    return () => unsubscribe();
  }, [user, role]);

  return (
    <button
      onClick={onPress}
      className="relative w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-indigo-100/20 hover:bg-indigo-100/40 active:bg-indigo-100/60 transition-colors"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      <FiBell style={{ width: size, height: size, color }} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 sm:top-0.5 sm:right-0.5 min-w-4.5 h-4.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 border-2 border-white animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationBell;
