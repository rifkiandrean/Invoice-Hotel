import React, { useState } from 'react';
import { signInWithGoogle } from '../services/firebaseService';

interface Props {
  hotelName: string;
}

export const Auth: React.FC<Props> = ({ hotelName }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await signInWithGoogle();
      if (authError) {
        if (authError.code === 'auth/popup-closed-by-user') {
          setError('Login dibatalkan (jendela login ditutup).');
        } else if (authError.code === 'auth/cancelled-popup-request') {
          // User opened multiple popups or aborted
        } else {
          setError(authError.message || 'Gagal masuk dengan Akun Google.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat masuk.');
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
          <p className="text-indigo-100 text-sm mt-1">Sistem Manajemen Operasional & Invoice</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center">
            <h3 className="text-base font-bold text-slate-800">Masuk Menggunakan Akun Google</h3>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan akun Google staf atau administrator Anda untuk melanjutkan.
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-xs font-semibold animate-fade-in text-center">
              {error}
            </div>
          )}

          <button 
            type="button" 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white hover:bg-slate-50 text-slate-700 py-3.5 px-4 rounded-2xl font-bold border-2 border-slate-200 hover:border-slate-300 shadow-sm hover:shadow transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-600 animate-spin rounded-full"></div>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span className="text-sm">
              {loading ? 'Menghubungkan...' : 'Lanjutkan dengan Google'}
            </span>
          </button>

          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-400 font-medium">
              🔒 Akses aman terverifikasi Firebase Authentication
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
