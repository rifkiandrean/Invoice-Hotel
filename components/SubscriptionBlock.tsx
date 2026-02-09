
import React from 'react';
import { UserProfile } from '../types';

interface Props {
  user: UserProfile;
  onLogout: () => void;
}

export const SubscriptionBlock: React.FC<Props> = ({ user, onLogout }) => {
  const isExpired = user.subscription_end_date 
    ? new Date(user.subscription_end_date) < new Date() 
    : true;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden text-center animate-slide-up border border-slate-100">
        <div className="bg-gradient-to-r from-rose-500 to-orange-500 p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
          <div className="relative z-10 bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Akses Terkunci</h2>
          <p className="text-white/90 text-sm font-medium mt-1">Langganan Diperlukan</p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Status Akun</p>
            <p className="text-slate-800 font-bold text-lg">
              {isExpired ? 'Masa Aktif Habis' : 'Belum Aktif'}
            </p>
            {user.subscription_end_date && (
              <p className="text-rose-500 text-xs font-medium mt-1">
                Berakhir pada: {new Date(user.subscription_end_date).toLocaleDateString('id-ID')}
              </p>
            )}
          </div>

          <p className="text-slate-600 text-sm leading-relaxed">
            Halo <strong>{user.email}</strong>,<br/>
            Untuk melanjutkan penggunaan aplikasi <strong>HotelFlow</strong> dan mengelola invoice, silakan perpanjang langganan Anda.
          </p>

          <div className="border-t border-slate-100 pt-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Hubungi Administrator</p>
            <a 
              href="mailto:rifkiandrean@gmail.com" 
              className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 mb-3"
            >
              rifkiandrean@gmail.com
            </a>
            <button 
              onClick={onLogout}
              className="text-slate-400 text-xs font-bold hover:text-rose-500 transition-colors uppercase tracking-wider"
            >
              Keluar Akun
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
