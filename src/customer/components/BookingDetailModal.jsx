import React, { useState, useEffect, useCallback } from 'react';
import {
  FiFileText, FiX, FiClock, FiCheckCircle, FiCheckSquare, FiXCircle,
  FiInfo, FiShield, FiActivity, FiMapPin, FiBriefcase, FiTag, FiUser,
  FiPhone, FiMail, FiStar, FiCalendar, FiCopy, FiMap, FiAlertCircle,
  FiAlertTriangle, FiMessageCircle, FiCheck, FiSend
} from 'react-icons/fi';
import { getBookingById, updateBookingStatus } from '../../services/firebase/serviceService';
import { fetchUserProfile } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { notify, getUserFacingError } from '../../utils/toast';

const BookingDetailModal = ({ visible, bookingId, onClose, role = 'customer' }) => {
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [providerProfile, setProviderProfile] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [unavailableNote, setUnavailableNote] = useState('');
  const [showUnavailableInput, setShowUnavailableInput] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // ── Helpers ──────────────────────────────────────────────────────────

  const confirmAction = (title, message, onConfirm) => {
    setConfirmDialog({ title, message, onConfirm });
  };

  const getStatusColor = (status) => {
    switch (status) {
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
      if (role === 'customer' && bookingData?.providerId) {
        try {
          const profile = await fetchUserProfile(bookingData.providerId);
          setProviderProfile(profile);
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
        await updateBookingStatus(bookingId, 'cancelled', providerId);
        await loadBooking();
        notify.success('Booking cancelled.', { id: 'booking-detail-cancel' });
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

  const handleMarkAsArrived = () => {
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
                {booking.status?.toUpperCase() || 'PENDING'}
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
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-medium">Service Fee</span>
                      <span className="text-sm text-slate-800 font-semibold">
                        ${typeof booking.price === 'number' ? booking.price.toFixed(2) : booking.price || booking.packageData?.price || '0.00'}
                      </span>
                    </div>
                    {booking.duration && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">Duration</span>
                        <span className="text-sm text-slate-500">{booking.duration}</span>
                      </div>
                    )}
                    <hr className="border-slate-200" />
                    <div className="flex justify-between items-center">
                      <span className="text-base font-bold text-slate-800">Total Amount</span>
                      <span className="text-lg font-bold text-indigo-500">
                        ${typeof booking.price === 'number' ? booking.price.toFixed(2) : booking.price || booking.packageData?.price || '0.00'}
                      </span>
                    </div>
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
                  onClose={onClose}
                />
              ) : (
                <CustomerActions
                  booking={booking}
                  actionLoading={actionLoading}
                  onCancel={handleCancelBooking}
                  onClose={onClose}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Rating Modal ─── */}
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
  onAccept, onReject, onCancel, onComplete, onArrived, onVerifyOtp, onCustomerUnavailable, onClose,
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
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={actionLoading} className={`${btnBase} bg-white border-2 border-red-500 text-red-500 hover:bg-red-50`}>
            <FiXCircle size={18} /> {actionLoading ? 'Processing...' : 'Cancel'}
          </button>
          <button onClick={onArrived} disabled={otpSending} className={`${btnBase} bg-sky-500 text-white hover:bg-sky-600 shadow-md shadow-sky-500/30`}>
            <FiMapPin size={18} /> {otpSending ? 'Sending...' : 'Mark as Arrived'}
          </button>
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

const CustomerActions = ({ booking, actionLoading, onCancel, onClose }) => {
  const btnBase = 'flex-1 py-4 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-60';

  if (booking.status === 'pending' || booking.status === 'upcoming' || booking.status === 'accepted') {
    return (
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={actionLoading} className={`${btnBase} bg-white border-2 border-red-500 text-red-500 hover:bg-red-50`}>
          <FiXCircle size={18} /> {actionLoading ? 'Processing...' : 'Cancel Booking'}
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
