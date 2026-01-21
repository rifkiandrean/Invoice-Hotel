
import React, { useState } from 'react';
import { signIn } from '../services/supabaseService';

interface Props {
  hotelName: string;
}

export const Auth: React.FC<Props> = ({ hotelName }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error: authError } = await signIn(email, password);
      if (authError) throw authError;
    } catch (err: any) {
      setError(err.message || 'Email atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-slide-up">
        <div className="p-8 text-center bg-indigo-600 text-white">
          <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
             <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight uppercase">{hotelName}</h2>
          <p className="text-indigo-100 text-sm mt-1">Silakan masuk untuk mengelola invoice</p>
        </div>

        <form onSubmit={handleAuth} className="p-8 space-y-5">
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-[11px] font-bold animate-fade-in text-center">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="nama@hotel.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-widest">Password</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full"></div>
            ) : (
              'Masuk Sekarang'
            )}
          </button>

          <div className="text-center pt-2">
            <p className="text-[10px] text-slate-400 font-medium italic">
              Akses terbatas hanya untuk staf berwenang.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
