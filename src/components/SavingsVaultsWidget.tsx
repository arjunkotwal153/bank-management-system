import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, PiggyBank, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SavingsVaultsWidget({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currency, setCurrency] = useState('USD');

  const { data: vaults, isLoading } = useQuery({
    queryKey: ['vaults', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('profile_id', profileId)
        .eq('account_type', 'vault')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  const createVaultMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('create_vault', {
        p_vault_name: vaultName,
        p_target_amount: parseFloat(targetAmount),
        p_currency: currency
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vault created successfully!');
      setVaultName('');
      setTargetAmount('');
      setCurrency('USD');
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ['vaults', profileId] });
      queryClient.invalidateQueries({ queryKey: ['vaults_dropdown'] }); // for TransferModal
    },
    onError: (err) => {
      toast.error(`Failed to create vault: ${err.message}`);
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultName || !targetAmount || isNaN(parseFloat(targetAmount))) return;
    createVaultMutation.mutate();
  };

  if (isLoading) return null;

  return (
    <div className="p-8 rounded-3xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-xl mb-8 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-emerald-400" /> 
          Savings Vaults
        </h3>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Vault
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5 space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Vault Name</label>
              <input
                type="text"
                required
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                placeholder="e.g., Vacation Fund"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Target Amount</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="1000.00"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none text-sm appearance-none cursor-pointer"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createVaultMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex items-center gap-2"
            >
              {createVaultMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Vault
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4 relative z-10">
        {vaults?.length === 0 && !isCreating && (
          <div className="text-center py-6 text-slate-500">
            No vaults created yet. Start saving today!
          </div>
        )}
        
        {vaults?.map((vault) => {
          const balance = Number(vault.balance);
          const target = Number(vault.target_amount);
          const percent = Math.min(100, Math.max(0, (balance / target) * 100));
          
          const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: vault.currency || 'USD' });
          
          return (
            <div key={vault.id} className="bg-white dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200 dark:border-white/5 relative overflow-hidden">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-200">{vault.vault_name}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">ACCT: {vault.account_number}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-400">{formatter.format(balance)}</p>
                  <p className="text-xs text-slate-500">of {formatter.format(target)}</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[10px] text-right mt-1 text-slate-400 font-medium">{percent.toFixed(1)}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
