// src/components/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Send, ArrowUpRight, ArrowDownRight, Wallet, Activity, Search, Download, Sun, Moon, ShieldAlert } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import TransferModal from './TransferModal';
import CashFlowChart from './CashFlowChart';
import VirtualCard from './VirtualCard';
import BudgetChart from './BudgetChart';
import PaymentRequestsWidget from './PaymentRequestsWidget';
import ScheduledTransfersWidget from './ScheduledTransfersWidget';
import SavingsVaultsWidget from './SavingsVaultsWidget';
import SecurityWidget from './SecurityWidget';
import SecuritySettings from './SecuritySettings';
import ExternalFundingWidget from './ExternalFundingWidget';

export default function Dashboard() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'dashboard' | 'security'>('dashboard');

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['account', user?.id],
    enabled: !!user?.id, // <-- ADD THIS: Prevents query from running before auth loads
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('profile_id', user?.id)
        .eq('account_type', 'checking') // Anchors exclusively to the main account
        .order('created_at', { ascending: true }) // Primary time sort
        .order('id', { ascending: true }) // Deterministic tie-breaker for identical timestamps
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const PAGE_SIZE = 10;

  const {
    data: historyData,
    isLoading: historyLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage
  } = useInfiniteQuery({
    queryKey: ['ledger', account?.id, searchTerm],
    enabled: !!account?.id,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('ledger_entries')
        .select(`id, amount, created_at, description, category`)
        .eq('account_id', account?.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchTerm) {
        query = query.ilike('description', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
  });

  const history = historyData?.pages.flat() || [];

  // Real-time WebSockets
  useEffect(() => {
    if (!account?.id) return;

    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ledger_entries',
        filter: `account_id=eq.${account.id}`
      }, (payload) => {
        const isCredit = Number(payload.new.amount) > 0;
        if (isCredit) {
          toast.success('Incoming Transfer Received!', {
            style: { background: '#0f172a', color: '#fff', border: '1px solid #334155' }
          });
        }
        queryClient.invalidateQueries({ queryKey: ['account'] });
        queryClient.invalidateQueries({ queryKey: ['ledger'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account?.id, queryClient]);

  const handleLogout = async () => await supabase.auth.signOut();

  const handleExportCSV = () => {
    if (!history || history.length === 0) return;

    // 1. Create CSV header
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];

    // 2. Map data rows
    const rows = history.map((entry: any) => {
      const date = new Date(entry.created_at).toLocaleString('en-US');
      const description = `"${(entry.description || 'System Transfer').replace(/"/g, '""')}"`;
      const category = `"${entry.category || 'General'}"`;
      const isCredit = Number(entry.amount) > 0;
      const type = isCredit ? 'Credit' : 'Debit';
      const amount = Math.abs(Number(entry.amount)).toFixed(2);
      const currency = entry.original_currency || account?.currency || 'USD';

      return `${date},${description},${category},${type},${amount},${currency}`;
    });

    // 3. Combine to CSV string
    const csvContent = [headers.join(','), ...rows].join('\n');

    // 4. Create Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `statement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeposit = async () => {
    if (!account) return;
    const { error } = await supabase.rpc('deposit_funds', {
      p_account_id: account.id,
      p_amount: 1500.00
    });
    if (error) alert("Database Error: " + error.message);
  };

  if (accountLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-300">Loading secure ledger...</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500/30 overflow-hidden relative transition-colors duration-300">
      <Toaster position="top-right" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {account?.account_status === 'frozen' && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center justify-center gap-3 animate-pulse">
            <ShieldAlert className="w-6 h-6" />
            <span className="font-bold tracking-wide">ACCOUNT FROZEN - PLEASE CONTACT SUPPORT</span>
          </div>
        )}

        <header className="flex justify-between items-center mb-10 backdrop-blur-md bg-white/5 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg"><Wallet className="w-6 h-6 text-indigo-400" /></div>
            <h1 className="text-xl font-bold tracking-tight">Fintech<span className="text-indigo-400">Engine</span></h1>
          </div>

          <div className="flex gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-all"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeView === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-300 hover:text-white bg-white/5 hover:bg-white/10'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveView('security')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeView === 'security' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-300 hover:text-white bg-white/5 hover:bg-white/10'}`}
            >
              Security
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-all ml-2 border border-rose-500/20">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </header>

        {!account ? (
          <div className="text-center py-20"><h2 className="text-2xl font-bold mb-2">No Account Found</h2></div>
        ) : activeView === 'security' ? (
          <SecuritySettings />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">

              <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mb-1 relative z-10">Available Balance</p>
                <h2 className="text-5xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 mb-6 relative z-10">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency || 'USD' }).format(Number(account.balance))}
                </h2>
                <p className="text-xs text-slate-500 font-mono mb-8 relative z-10">ACCT: {account.account_number}</p>
                <div className="flex gap-4 relative z-10">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={account.account_status === 'frozen'}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white p-4 rounded-xl font-semibold shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
                  >
                    <Send className="w-5 h-5" /> Transfer
                  </button>
                  <button onClick={handleDeposit} className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98]">
                    <ArrowDownRight className="w-5 h-5" /> Deposit
                  </button>
                </div>
              </div>

              {/* Cash Flow Section */}
              <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" /> Cash Flow
                </h3>
                <CashFlowChart data={history} />
              </div>

              {/* Budget Analytics Section */}
              <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-400" /> Budget Breakdown
                </h3>
                <BudgetChart data={history} />
              </div>

              {/* Virtual Card Section */}
              <VirtualCard accountId={account.id} />
            </div>

            <div className="lg:col-span-2">
              <SecurityWidget
                accountId={account.id}
                dailyLimit={account.daily_transfer_limit || 5000}
                status={account.account_status || 'active'}
              />
              <PaymentRequestsWidget accountId={account.id} />
              <SavingsVaultsWidget profileId={user?.id || ''} />
              <ScheduledTransfersWidget accountId={account.id} />
              <ExternalFundingWidget accountId={account.id} />

              <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl h-full flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" /> Ledger History
                  </h3>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 w-full sm:w-48 transition-all"
                      />
                    </div>
                    <button
                      onClick={handleExportCSV}
                      disabled={history.length === 0}
                      className="p-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Download Statement (CSV)"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  {historyLoading ? (
                    <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl w-full" />)}</div>
                  ) : history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20">
                      <Search className="w-12 h-12 mb-4 opacity-20" />
                      <p>No transactions found.</p>
                    </div>
                  ) : (
                    <>
                      {history.map((entry: any) => {
                        const isCredit = Number(entry.amount) > 0;
                        return (
                          <div key={entry.id} className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 transition-colors group">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-full ${isCredit ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                {isCredit ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-slate-200 group-hover:text-black dark:group-hover:text-white transition-colors">{entry.description || 'System Transfer'}</p>
                                <p className="text-xs text-slate-500">
                                  {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  <span className="mx-2">•</span>
                                  <span className="text-indigo-600 dark:text-indigo-400">{entry.category || 'General'}</span>
                                </p>
                              </div>
                            </div>
                            <div className={`text-lg font-bold ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-200'}`}>
                              {isCredit ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency || 'USD' }).format(Number(entry.amount))}
                            </div>
                          </div>
                        )
                      })}
                      {hasNextPage && (
                        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="w-full mt-6 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white rounded-xl border border-black/10 dark:border-white/10 transition-all">
                          {isFetchingNextPage ? 'Loading...' : 'Load More Transactions'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {account && <TransferModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} senderAccountId={account.id} />}
      </div>
    </div>
  );
}