import React, { useEffect, useState } from 'react';
import { FiBriefcase, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import ProviderAppLayout from '../components/ProviderAppLayout';
import Footer from '../components/Footer';
import { Loading } from '../components/StateComponents';
import { useAuth } from '../context/AuthContext';
import { subscribeToProviderEarnings } from '../services/firebase/serviceService';
import { notify } from '../utils/toast';

const formatMoney = (value) => `$${Math.round(Number(value) || 0).toLocaleString('en-AU')}`;

const ProviderEarningsScreen = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    monthlyEarnings: 0,
    totalEarnings: 0,
    pendingAmount: 0,
    completedJobs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    if (!user?.uid) return undefined;

    let unsubscribe = null;
    let mounted = true;

    const setup = async () => {
      try {
        unsubscribe = await subscribeToProviderEarnings(user.uid, (earningsData) => {
          if (!mounted) return;
          setTransactions(earningsData.transactions || []);
          setStats(earningsData.stats || {});
          setLoading(false);
        });
      } catch (error) {
        console.error('Error loading provider earnings:', error);
        notify.error('Failed to load earnings');
        setLoading(false);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  if (loading) return <Loading fullScreen />;

  return (
    <ProviderAppLayout>
      <ProviderPageTitle
        title="Earnings"
        subtitle="Review completed jobs, pending payouts, and income."
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat value={formatMoney(stats.monthlyEarnings)} label="This Month" Icon={FiDollarSign} />
        <Stat value={formatMoney(stats.totalEarnings)} label="Total Earnings" Icon={FiTrendingUp} />
        <Stat value={formatMoney(stats.pendingAmount)} label="Pending" Icon={FiDollarSign} />
        <Stat value={stats.completedJobs || 0} label="Completed Jobs" Icon={FiBriefcase} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
        <div className="mt-3 space-y-3">
          {transactions.length > 0 ? (
            transactions.slice(0, 20).map((transaction) => (
              <button
                type="button"
                key={transaction.id}
                onClick={() => setSelectedTransaction(transaction)}
                className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-950">
                      {transaction.description || 'Service'}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {transaction.customer || 'Customer'} - {transaction.date || 'TBD'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#5A52E3]">{formatMoney(transaction.amount)}</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {transaction.status || 'pending'}
                    </p>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              title="No earnings yet"
              message="Completed booking earnings will appear here."
            />
          )}
        </div>
      </section>

      {selectedTransaction ? (
        <EarningDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      ) : null}

      <Footer />
    </ProviderAppLayout>
  );
};

const ProviderPageTitle = ({ title, subtitle }) => (
  <header className="border-b border-slate-200 pb-6">
    <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h1>
    <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
  </header>
);

const Stat = ({ value, label, Icon }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xl font-semibold text-[#5A52E3] sm:text-2xl">{value}</p>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
        <Icon className="h-5 w-5 text-[#5A52E3]" />
      </div>
    </div>
    <p className="mt-2 text-sm font-semibold text-slate-500">{label}</p>
  </div>
);

const EmptyState = ({ title, message }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
    <p className="font-medium text-slate-800">{title}</p>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
  </div>
);

const EarningDetailModal = ({ transaction, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:px-4">
    <div className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Earning Details</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {transaction.description || 'Service'} - {transaction.date || 'TBD'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 font-medium text-slate-500 hover:bg-slate-100"
        >
          Close
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
        <DetailRow label="Customer" value={transaction.customer || 'Customer'} />
        <DetailRow label="Provider Amount" value={formatMoney(transaction.amount)} />
        <DetailRow label="Original Amount" value={formatMoney(transaction.originalAmount)} />
        <DetailRow label="Commission" value={formatMoney(transaction.commission)} />
        <DetailRow label="Commission Rate" value={`${transaction.commissionRate || 0}%`} />
        <DetailRow label="Status" value={transaction.status || 'pending'} />
        <DetailRow
          label="Payment Status"
          value={transaction.paymentStatus || 'Not available'}
          last
        />
      </div>
    </div>
  </div>
);

const DetailRow = ({ label, value, last = false }) => (
  <div className={`grid grid-cols-2 gap-3 px-4 py-3 ${last ? '' : 'border-b border-slate-100'}`}>
    <p className="text-sm font-medium text-slate-500">{label}</p>
    <p className="text-right text-sm font-semibold text-slate-900">{value}</p>
  </div>
);

export default ProviderEarningsScreen;
