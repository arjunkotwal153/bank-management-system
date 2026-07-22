import { useState, useEffect } from 'react';
import { X, Loader2, Users, Hash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderAccountId: string;
}

export default function TransferModal({ isOpen, onClose, senderAccountId }: TransferModalProps) {
  const { user } = useAuth();
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [saveBeneficiary, setSaveBeneficiary] = useState(false);
  const [nickname, setNickname] = useState('');

  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [frequency, setFrequency] = useState('once');
  const [nextRunAt, setNextRunAt] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: beneficiaries, isLoading: loadingBeneficiaries } = useQuery({
    queryKey: ['beneficiaries', user?.id],
    enabled: !!user?.id && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficiaries')
        .select('*')
        .order('nickname', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: vaults } = useQuery({
    queryKey: ['vaults_dropdown', user?.id],
    enabled: !!user?.id && isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, vault_name, account_number')
        .eq('profile_id', user?.id)
        .eq('account_type', 'vault');
      if (error) throw error;
      return data || [];
    }
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setReceiverId('');
      setAmount('');
      setDescription('');
      setCategory('General');
      setUseManualEntry(false);
      setSaveBeneficiary(false);
      setNickname('');
      setIsScheduled(false);
      setFrequency('once');
      setNextRunAt('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setError('Please enter a valid positive amount.');
      setLoading(false);
      return;
    }

    if (!receiverId) {
      setError('Please select or enter a receiver account ID.');
      setLoading(false);
      return;
    }

    if (isScheduled) {
      if (!nextRunAt) {
        setError('Please select a start date for the scheduled transfer.');
        setLoading(false);
        return;
      }
      
      const { error: scheduleError } = await supabase
        .from('scheduled_transfers')
        .insert({
          sender_account_id: senderAccountId,
          receiver_account_id: receiverId,
          amount: transferAmount,
          description: description || 'Scheduled Transfer',
          category: category,
          frequency: frequency,
          next_run_at: new Date(nextRunAt).toISOString(),
        });
        
      if (scheduleError) {
        setError(scheduleError.message);
        setLoading(false);
        return;
      }
    } else {
      // Generate the Idempotency Key
      const idempotencyKey = uuidv4();
  
      const { error: rpcError } = await supabase.rpc('transfer_funds', {
        p_sender_account_id: senderAccountId,
        p_receiver_account_id: receiverId,
        p_amount: transferAmount,
        p_idempotency_key: idempotencyKey,
        p_description: description || 'Standard Transfer',
        p_category: category,
      });
  
      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }
    }

    // Save beneficiary if requested
    if (useManualEntry && saveBeneficiary && nickname && user) {
      const { error: saveError } = await supabase
        .from('beneficiaries')
        .insert({
          profile_id: user.id,
          account_id: receiverId,
          nickname: nickname
        });
      
      if (!saveError) {
        queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      } else {
        console.error("Failed to save beneficiary", saveError);
      }
    }

    // Invalidate the React Query cache to instantly refresh the dashboard UI
    queryClient.invalidateQueries({ queryKey: ['account'] });
    queryClient.invalidateQueries({ queryKey: ['ledger'] });
    
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Transfer Funds</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleTransfer} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm">
              {error}
            </div>
          )}

          {/* Contact vs Manual Toggle */}
          <div className="flex gap-2 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button 
              type="button"
              onClick={() => { setUseManualEntry(false); setReceiverId(''); }}
              className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all ${!useManualEntry ? 'bg-slate-800 text-white shadow border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Users className="w-4 h-4 mr-2" /> Contacts
            </button>
            <button 
              type="button"
              onClick={() => { setUseManualEntry(true); setReceiverId(''); }}
              className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded-md transition-all ${useManualEntry ? 'bg-slate-800 text-white shadow border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Hash className="w-4 h-4 mr-2" /> Manual UUID
            </button>
          </div>

          {/* Receiver Selection */}
          {useManualEntry ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Receiver Account ID (UUID)</label>
                <input
                  type="text"
                  required
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-sm placeholder:text-slate-600"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="saveContact" 
                  checked={saveBeneficiary} 
                  onChange={(e) => setSaveBeneficiary(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-colors"
                />
                <label htmlFor="saveContact" className="text-sm font-medium text-slate-300 cursor-pointer select-none">
                  Save this account to contacts
                </label>
              </div>

              {saveBeneficiary && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-slate-400 mb-1">Nickname</label>
                  <input
                    type="text"
                    required={saveBeneficiary}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm placeholder:text-slate-600"
                    placeholder="e.g. Jane - Checking"
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Select Contact</label>
              {loadingBeneficiaries ? (
                <div className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-500 flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading contacts...
                </div>
              ) : beneficiaries?.length === 0 ? (
                <div className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-4 text-center text-sm text-slate-400">
                  No contacts saved yet. Switch to Manual UUID to save one.
                </div>
              ) : (
                <div className="relative">
                  <select
                    required
                    value={receiverId}
                    onChange={(e) => setReceiverId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm appearance-none cursor-pointer"
                  >
                    <option value="" disabled>-- Choose a destination --</option>
                    
                    {vaults && vaults.length > 0 && (
                      <optgroup label="My Vaults">
                        {vaults.map((v) => (
                          <option key={v.id} value={v.id}>Vault: {v.vault_name} (...{v.account_number?.slice(-4)})</option>
                        ))}
                      </optgroup>
                    )}

                    <optgroup label="Saved Contacts">
                      {beneficiaries?.map((b) => (
                        <option key={b.id} value={b.account_id}>{b.nickname}</option>
                      ))}
                    </optgroup>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Amount ($)</label>
            <input
              type="number"
              required
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-sm"
              placeholder="Rent, Dinner, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="General">General</option>
                <option value="Food & Dining">Food & Dining</option>
                <option value="Rent & Housing">Rent & Housing</option>
                <option value="Utilities">Utilities</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Subscriptions">Subscriptions</option>
                <option value="Travel">Travel</option>
                <option value="Shopping">Shopping</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                ▼
              </div>
            </div>
          </div>

          {/* Scheduling Toggle & Inputs */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-center cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  className="sr-only"
                  checked={isScheduled}
                  onChange={(e) => setIsScheduled(e.target.checked)}
                />
                <div className={`block w-10 h-6 rounded-full transition-colors ${isScheduled ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isScheduled ? 'translate-x-4' : ''}`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Schedule this transfer</span>
            </label>

            {isScheduled && (
              <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none text-sm appearance-none cursor-pointer"
                  >
                    <option value="once">One-time (Future date)</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                  <input
                    type="datetime-local"
                    value={nextRunAt}
                    onChange={(e) => setNextRunAt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white outline-none text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (!receiverId && !loadingBeneficiaries)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg font-bold shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isScheduled ? 'Confirm Schedule' : 'Confirm Transfer'}
          </button>
        </form>

      </div>
    </div>
  );
}