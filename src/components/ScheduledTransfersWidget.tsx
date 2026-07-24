import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Calendar, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ScheduledTransfersWidget({ accountId }: { accountId: string }) {
  const queryClient = useQueryClient();

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['scheduled_transfers', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_transfers')
        .select('*')
        .eq('sender_account_id', accountId)
        .eq('is_active', true)
        .order('next_run_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('scheduled_transfers')
        .update({ is_active: false })
        .eq('id', scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Scheduled transfer cancelled.');
      queryClient.invalidateQueries({ queryKey: ['scheduled_transfers', accountId] });
    },
    onError: (err) => {
      toast.error(`Cancellation failed: ${err.message}`);
    }
  });

  if (isLoading) return null;
  if (!schedules || schedules.length === 0) return null;

  return (
    <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl mb-8">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-emerald-400" />
        Active Scheduled Transfers
      </h3>
      <div className="space-y-3">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5 gap-4">
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-200">
                ${Number(schedule.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-slate-500 dark:text-slate-400 mx-1">to</span> {schedule.receiver_account_id}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{schedule.description || 'Scheduled Transfer'} • {schedule.category}</p>
              <p className="text-xs text-emerald-400 mt-1 font-medium flex items-center gap-1">
                Next run: {new Date(schedule.next_run_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ({schedule.frequency})
              </p>
            </div>
            <button
              onClick={() => cancelMutation.mutate(schedule.id)}
              disabled={cancelMutation.isPending}
              className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-rose-500/20"
            >
              {cancelMutation.isPending && cancelMutation.variables === schedule.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="w-4 h-4" /> Cancel
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
