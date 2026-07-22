import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface SecurityWidgetProps {
  accountId: string;
  dailyLimit: number;
  status: string;
}

export default function SecurityWidget({ accountId, dailyLimit, status }: SecurityWidgetProps) {
  const { data: dailySpent, isLoading } = useQuery({
    queryKey: ['daily_spent', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('amount')
        .eq('account_id', accountId)
        .lt('amount', 0)
        .gte('created_at', yesterday);

      if (error) throw error;
      
      const total = data.reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0);
      return total;
    },
    refetchInterval: 30000 // refetch every 30 seconds
  });

  const spent = dailySpent || 0;
  const percent = Math.min(100, Math.max(0, (spent / dailyLimit) * 100));
  const isNearLimit = percent >= 80;

  return (
    <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          {status === 'frozen' ? (
            <ShieldAlert className="w-5 h-5 text-rose-500" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          )}
          Security & Limits
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
          status === 'frozen' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
        }`}>
          {status}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-white/5">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-200">Daily Transfer Limit</h4>
            <p className="text-xs text-slate-500 mt-1">Rolling 24-hour window</p>
          </div>
          <div className="text-right">
            <p className={`font-bold ${isNearLimit ? 'text-rose-500 dark:text-rose-400' : 'text-slate-900 dark:text-slate-200'}`}>
              ${spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500">
              of ${Number(dailyLimit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isNearLimit ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        
        {isNearLimit && status !== 'frozen' && (
          <p className="text-xs text-rose-400 mt-3 font-medium flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Approaching daily transfer limit
          </p>
        )}
      </div>
    </div>
  );
}
