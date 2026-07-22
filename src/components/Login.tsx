// src/components/Login.tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();

  const handleAuth = async (type: 'login' | 'signup') => {
    setLoading(true);
    setError(null);
    
    if (!email || !password) {
      setError('Email and password are required.');
      setLoading(false);
      return;
    }
    
    // Call Supabase Auth functions
    const { error } = type === 'login' 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
      
    if (error) {
      // Supabase Auth returns "{}" for fatal Postgres trigger crashes
      if (error.message === '{}') {
        setError('Internal Database Error: The signup trigger crashed. Check Postgres logs.');
      } else {
        setError(error.message);
      }
    } else if (type === 'login') {
      // If login is successful, our AuthContext will detect the session 
      // and we can navigate to the protected dashboard
      navigate('/'); 
    } else {
      alert('Signup successful! You can now log in.');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-slate-200">
        <h2 className="text-3xl font-bold text-center text-slate-800 mb-8">Fintech Engine</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm border border-red-200">
            {error}
          </div>
        )}
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
            />
          </div>
          
          <div className="flex gap-4 pt-2">
            <button 
              onClick={() => handleAuth('login')} 
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-colors"
            >
              {loading ? 'Processing...' : 'Sign In'}
            </button>
            <button 
              onClick={() => handleAuth('signup')} 
              disabled={loading}
              className="flex-1 bg-slate-100 text-slate-700 p-3 rounded-lg hover:bg-slate-200 disabled:opacity-50 font-medium transition-colors border border-slate-300"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



