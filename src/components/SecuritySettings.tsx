import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ShieldAlert, Key, History, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

export default function SecuritySettings() {
  const { user } = useAuth();
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check enrollment status on mount
  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (data.currentLevel === 'aal2' || data.nextLevel === 'aal2') {
        setIsEnrolled(true);
      }
    } catch (err: any) {
      console.error("MFA Status error:", err.message);
    }
  };

  const handleEnroll = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (error) throw error;
      
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode
      });
      
      if (verify.error) throw verify.error;
      
      toast.success('2FA successfully enabled!');
      setIsEnrolled(true);
      setQrCode('');
      setFactorId('');

      // Log to audit table
      await supabase.from('audit_logs').insert({
        profile_id: user?.id,
        action: '2fa_enabled',
        ip_address: 'Client IP hidden'
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async () => {
    setLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp[0];
      
      if (totpFactor) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
        if (error) throw error;
        toast.success('2FA disabled.');
        setIsEnrolled(false);
        
        await supabase.from('audit_logs').insert({
          profile_id: user?.id,
          action: '2fa_disabled',
          ip_address: 'Client IP hidden'
        });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Audit Logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['audit_logs', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('profile_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <div className="space-y-8">
      {/* 2FA Settings */}
      <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
          <Key className="w-5 h-5 text-indigo-400" />
          Two-Factor Authentication (2FA)
        </h3>

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-2">
                Status: 
                {isEnrolled ? (
                  <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full text-xs border border-emerald-500/20"><ShieldCheck className="w-3 h-3" /> Enabled</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-full text-xs border border-rose-500/20"><ShieldAlert className="w-3 h-3" /> Disabled</span>
                )}
              </h4>
              <p className="text-sm text-slate-400 max-w-md mt-2">Protect your account with an additional layer of security using an authenticator app (like Google Authenticator or Authy).</p>
            </div>
            
            {isEnrolled ? (
              <button 
                onClick={handleUnenroll}
                disabled={loading}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disable 2FA'}
              </button>
            ) : !qrCode ? (
              <button 
                onClick={handleEnroll}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Setup 2FA'}
              </button>
            ) : null}
          </div>

          {qrCode && !isEnrolled && (
            <div className="mt-8 pt-8 border-t border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
              <h4 className="font-semibold text-slate-200 mb-4">Scan QR Code</h4>
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="bg-white p-4 rounded-xl shadow-xl flex-shrink-0" dangerouslySetInnerHTML={{ __html: qrCode }} />
                
                <div className="flex-1 space-y-4">
                  <p className="text-sm text-slate-400">Scan this code with your authenticator app, then enter the 6-digit code below to verify.</p>
                  
                  {error && <p className="text-sm text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">{error}</p>}
                  
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                      className="w-40 bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono tracking-widest text-lg text-center"
                    />
                    <button 
                      onClick={handleVerify}
                      disabled={loading || verifyCode.length !== 6}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs */}
      <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
          <History className="w-5 h-5 text-indigo-400" />
          Security Audit Logs
        </h3>

        <div className="space-y-3">
          {logsLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl w-full" />)}
            </div>
          ) : logs?.length === 0 ? (
            <div className="text-center py-6 text-slate-500">No recent security events found.</div>
          ) : (
            logs?.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5">
                <div>
                  <p className="font-semibold text-slate-200 capitalize tracking-wide">{log.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-500 mt-1">{log.ip_address || 'Unknown IP'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400 font-mono">
                    {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
