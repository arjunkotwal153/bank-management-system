import { useState } from 'react';
import { CreditCard, Eye, EyeOff, Lock, Unlock, Loader2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface VirtualCardProps {
  accountId: string;
}

export default function VirtualCard({ accountId }: VirtualCardProps) {
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);

  const { data: card, isLoading } = useQuery({
    queryKey: ['virtual_card', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_cards')
        .select('*')
        .eq('account_id', accountId)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const issueCardMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('issue_virtual_card', {
        p_account_id: accountId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Virtual card issued successfully!');
      queryClient.invalidateQueries({ queryKey: ['virtual_card', accountId] });
    },
    onError: (err) => {
      toast.error(`Failed to issue card: ${err.message}`);
    }
  });

  const toggleFreezeMutation = useMutation({
    mutationFn: async (currentStatus: boolean) => {
      const { error } = await supabase
        .from('virtual_cards')
        .update({ is_frozen: !currentStatus })
        .eq('account_id', accountId);
      if (error) throw error;
      return !currentStatus;
    },
    onSuccess: (newStatus) => {
      toast.success(newStatus ? 'Card frozen.' : 'Card unfrozen.');
      queryClient.invalidateQueries({ queryKey: ['virtual_card', accountId] });
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`);
    }
  });

  if (isLoading) {
    return (
      <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl animate-pulse h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-2">
          <CreditCard className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">No Virtual Card</h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs">Issue a virtual debit card instantly for secure online purchases.</p>
        <button
          onClick={() => issueCardMutation.mutate()}
          disabled={issueCardMutation.isPending}
          className="mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-6 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50"
        >
          {issueCardMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          Issue Card Now
        </button>
      </div>
    );
  }

  const formatCardNumber = (num: string) => {
    if (!showDetails) return '•••• •••• •••• ' + num.slice(-4);
    return num.match(/.{1,4}/g)?.join(' ') || num;
  };

  const isFrozen = card.is_frozen;

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl shadow-xl flex flex-col justify-between group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px] group-hover:bg-indigo-500/20 transition-all duration-700 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 rounded-full blur-[60px] group-hover:bg-rose-500/20 transition-all duration-700 pointer-events-none" />

      <div className="flex justify-between items-start mb-6 relative z-10">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          Virtual Card
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 bg-slate-200 dark:bg-slate-800/50 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title={showDetails ? "Hide Details" : "Show Details"}
          >
            {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => toggleFreezeMutation.mutate(isFrozen)}
            disabled={toggleFreezeMutation.isPending}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${isFrozen ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400 hover:bg-rose-500/30' : 'bg-slate-200 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'}`}
            title={isFrozen ? "Unfreeze Card" : "Freeze Card"}
          >
            {toggleFreezeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isFrozen ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />)}
          </button>
        </div>
      </div>

      <div className={`relative w-full min-h-[220px] sm:min-h-[240px] rounded-2xl p-6 flex flex-col justify-between transition-all duration-500 shadow-2xl overflow-hidden ${isFrozen ? 'opacity-75 grayscale-[0.5]' : ''}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-900 to-slate-900 z-0" />
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm z-0 border border-white/10 rounded-2xl" />

        <div className="relative z-10 flex justify-between items-center">
          <div className="text-white/80 font-semibold tracking-wider text-sm">FintechEngine</div>
          <svg className="w-10 h-10 opacity-80" viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="#eb001b" opacity="0.8" />
            <circle cx="24" cy="12" r="12" fill="#f79e1b" opacity="0.8" />
          </svg>
        </div>

        <div className="relative z-10 mt-auto">
          <div className="text-2xl sm:text-3xl font-mono text-white tracking-widest mb-4 drop-shadow-md">
            {formatCardNumber(card.card_number)}
          </div>

          <div className="flex justify-between items-end">
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Valid Thru</p>
                <p className="text-sm font-mono text-white">{card.expiry_date}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">CVV</p>
                <p className="text-sm font-mono text-white">{showDetails ? card.cvv : '•••'}</p>
              </div>
            </div>
            <div className="text-sm font-medium text-white/90 uppercase tracking-wider">
              mastercard
            </div>
          </div>
        </div>

        {isFrozen && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-20 flex flex-col items-center justify-center text-white border border-rose-500/30 rounded-2xl">
            <Lock className="w-8 h-8 text-rose-400 mb-2" />
            <span className="font-bold tracking-wide text-rose-400 uppercase">Card Frozen</span>
          </div>
        )}
      </div>

    </div>
  );
}
