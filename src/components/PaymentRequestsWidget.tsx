import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { Check, X, Loader2, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaymentRequestsWidgetProps {
  accountId: string;
}

export default function PaymentRequestsWidget({ accountId }: PaymentRequestsWidgetProps) {
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['payment_requests', accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('payer_account_id', accountId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const idempotencyKey = uuidv4();
      const { error } = await supabase.rpc('approve_payment_request', {
        p_request_id: requestId,
        p_idempotency_key: idempotencyKey
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Payment sent successfully!');
      queryClient.invalidateQueries({ queryKey: ['payment_requests', accountId] });
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (err) => {
      toast.error(`Approval failed: ${err.message}`);
    }
  });

  const declineMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('decline_payment_request', {
        p_request_id: requestId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Request declined.');
      queryClient.invalidateQueries({ queryKey: ['payment_requests', accountId] });
    },
    onError: (err) => {
      toast.error(`Decline failed: ${err.message}`);
    }
  });

  if (isLoading) {
    return (
      <div className="p-6 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl animate-pulse h-32 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return null; // Don't show the widget if there are no pending requests
  }

  return (
    <div className="p-6 rounded-3xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/30 backdrop-blur-xl mb-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none" />
      
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
        <Bell className="w-5 h-5 text-indigo-400 animate-bounce" /> 
        Pending Payment Requests ({requests.length})
      </h3>

      <div className="space-y-3 relative z-10">
        {requests.map((request) => (
          <div key={request.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-indigo-100 dark:border-white/5 gap-4">
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-200">
                ${Number(request.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{request.description || 'No description provided'}</p>
              <p className="text-xs text-slate-500 mt-1">From: {request.requester_account_id}</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => declineMutation.mutate(request.id)}
                disabled={approveMutation.isPending || declineMutation.isPending}
                className="flex-1 sm:flex-initial px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {declineMutation.isPending && declineMutation.variables === request.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Decline'
                )}
              </button>
              <button
                onClick={() => approveMutation.mutate(request.id)}
                disabled={approveMutation.isPending || declineMutation.isPending}
                className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {approveMutation.isPending && approveMutation.variables === request.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Pay Now
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
