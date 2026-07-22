import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LogOut, Users, Shield, Plus, ShieldCheck } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [provisioningUserId, setProvisioningUserId] = useState<string | null>(null);
  const [initialBalance, setInitialBalance] = useState<string>('1000');

  // Fetch all profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['admin_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleProvision = async (userId: string) => {
    const amount = parseFloat(initialBalance);
    if (isNaN(amount) || amount < 0) {
      alert("Please enter a valid initial balance.");
      return;
    }

    const { error } = await supabase.rpc('provision_new_account', {
      p_user_id: userId,
      p_initial_balance: amount
    });

    if (error) {
      alert("Database Error: " + error.message);
    } else {
      alert("Account provisioned successfully!");
      setProvisioningUserId(null);
      // Invalidate if we want to show account status (e.g., if we joined accounts)
      queryClient.invalidateQueries({ queryKey: ['admin_profiles'] });
    }
  };

  if (profilesLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Loading secure admin panel...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Animated Background Orbs for Admin (Different Colors) */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-600/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 py-8 relative z-10">
        {/* Navbar */}
        <header className="flex justify-between items-center mb-16 backdrop-blur-md bg-white/5 p-4 rounded-2xl border border-white/10 shadow-lg shadow-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Fintech<span className="text-purple-400">Admin</span></h1>
              <p className="text-xs text-purple-300 font-mono tracking-wider uppercase">Mission Control</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-200">{user?.email}</p>
              <p className="text-xs text-purple-400 font-mono">System Administrator</p>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all duration-300"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </header>

        {/* Users List */}
        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Registered Users
          </h3>
          
          <div className="space-y-4">
            {profiles?.map((profile: any) => (
              <div 
                key={profile.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors duration-300 border border-white/5 group gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-full">
                    {profile.is_admin ? <Shield className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-200 group-hover:text-white transition-colors">
                      {profile.email || profile.full_name || profile.id}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${profile.is_admin ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-500/20 text-slate-300'}`}>
                        {profile.is_admin ? 'ADMIN' : 'USER'}
                      </span>
                      <p className="text-xs text-slate-500 font-mono">ID: {profile.id}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!profile.is_admin && provisioningUserId !== profile.id && (
                    <button 
                      onClick={() => setProvisioningUserId(profile.id)}
                      className="flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500 text-purple-300 hover:text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 border border-purple-500/20 hover:border-transparent"
                    >
                      <Plus className="w-4 h-4" />
                      Provision Account
                    </button>
                  )}
                  
                  {provisioningUserId === profile.id && (
                    <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-white/10">
                      <span className="text-slate-400 pl-2">$</span>
                      <input 
                        type="number"
                        value={initialBalance}
                        onChange={(e) => setInitialBalance(e.target.value)}
                        className="w-24 bg-transparent text-white focus:outline-none text-sm font-medium"
                        placeholder="Balance"
                      />
                      <button 
                        onClick={() => handleProvision(profile.id)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Confirm
                      </button>
                      <button 
                        onClick={() => setProvisioningUserId(null)}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {(!profiles || profiles.length === 0) && (
              <p className="text-slate-400 text-center py-8">No users found.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
