
import { supabase } from '../lib/supabase';
import { Building2, ArrowDownRight, Loader2, Server } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface ExternalFundingWidgetProps {
  accountId: string;
}

export default function ExternalFundingWidget({ accountId }: ExternalFundingWidgetProps) {
  const queryClient = useQueryClient();
  
  const processWebhookMutation = useMutation({
    mutationFn: async (payloadData: any) => {
      const { error } = await supabase.rpc('process_external_webhook', {
        p_provider: payloadData.provider,
        p_external_transaction_id: payloadData.transactionId,
        p_payload: payloadData.payload
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('External funds received successfully!');
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (err: any) => {
      toast.error(`Webhook failed: ${err.message}`);
    }
  });

  const handleSimulateStripe = () => {
    // Generate a pseudo-random external transaction ID
    const stripeTxId = `pi_${Math.random().toString(36).substring(2, 15)}`;
    
    const payload = {
      provider: 'stripe',
      transactionId: stripeTxId,
      payload: {
        destination_account_id: accountId,
        amount_cents: 250000, // $2,500.00
        description: 'Stripe Payout - E-Commerce Store',
        currency: 'usd',
        event_type: 'payout.created'
      }
    };
    
    processWebhookMutation.mutate(payload);
  };

  const handleSimulatePlaid = () => {
    // Generate a pseudo-random external transaction ID
    const plaidTxId = `ach_${Math.random().toString(36).substring(2, 15)}`;
    
    const payload = {
      provider: 'plaid',
      transactionId: plaidTxId,
      payload: {
        destination_account_id: accountId,
        amount_cents: 150000, // $1,500.00
        description: 'Direct Deposit - Employer Inc.',
        currency: 'usd',
        event_type: 'transfer.settled'
      }
    };
    
    processWebhookMutation.mutate(payload);
  };

  return (
    <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl mb-8 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          <Server className="w-5 h-5 text-blue-400" /> 
          API Webhooks (Simulated)
        </h3>
      </div>

      <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-white/5 relative z-10">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Test the external webhook endpoint by simulating an incoming JSON payload from a third-party provider. This bypasses the UI and hits the RPC directly, mimicking a server-to-server POST request.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleSimulateStripe}
            disabled={processWebhookMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-[#635BFF] hover:bg-[#5851E5] text-white p-4 rounded-xl font-semibold shadow-lg shadow-[#635BFF]/25 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {processWebhookMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownRight className="w-5 h-5" />}
            Simulate Stripe Payout
          </button>

          <button 
            onClick={handleSimulatePlaid}
            disabled={processWebhookMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-[#111111] hover:bg-[#222222] border border-white/10 text-white p-4 rounded-xl font-semibold shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {processWebhookMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Building2 className="w-5 h-5 text-[#00E6C3]" />}
            Simulate ACH Deposit
          </button>
        </div>
      </div>
    </div>
  );
}
