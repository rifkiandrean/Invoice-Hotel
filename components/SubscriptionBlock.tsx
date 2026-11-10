import React from 'react';
import { UserProfile } from '../types';

interface Props {
  user: UserProfile;
  onLogout: () => void;
}

export const SubscriptionBlock: React.FC<Props> = ({ user, onLogout }) => {
  const now = new Date();
  const endDate = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
  const graceDays = typeof user.grace_period_days === 'number' ? user.grace_period_days : 3;
  
  let finalDeadline: Date | null = null;
  if (endDate) {
    finalDeadline = new Date(endDate);
    finalDeadline.setDate(finalDeadline.getDate() + graceDays);
  }

  const isPastEndDate = endDate ? now > endDate : true;
  const isPastGracePeriod = finalDeadline ? now > finalDeadline : true;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden text-center animate-slide-up border border-slate-100">
        <div className="bg-gradient-to-r from-rose-600 to-amber-600 p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
          <div className="relative z-10 bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-inner">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Akses Langganan Habis</h2>
          <p className="text-white/90 text-sm font-medium mt-1">
            {isPastGracePeriod ? 'Batas Waktu Toleransi Telah Berakhir' : 'Langganan Memerlukan Pembaruan'}
          </p>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-left space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold uppercase tracking-wider">Status Akun</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700">
                {user.subscription_status === 'inactive' ? 'Nonaktif' : 'Jatuh Tempo Lewat'}
              </span>
            </div>
            
            {endDate && (
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                <span className="text-slate-500">Jatuh Tempo Langganan:</span>
                <span className="font-bold text-slate-700">{formatDate(endDate)}</span>
              </div>
            )}

            {finalDeadline && (
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                <span className="text-slate-500">Toleransi Tambahan:</span>
                <span className="font-bold text-amber-700">{graceDays} Hari</span>
              </div>
            )}

            {finalDeadline && (
              <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                <span className="text-slate-500">Batas Akhir Toleransi:</span>
                <span className="font-bold text-rose-600">{formatDate(finalDeadline)}</span>
              </div>
            )}
          </div>

          <p className="text-slate-600 text-xs leading-relaxed text-left">
            Halo <strong>{user.email}</strong>,<br/>
            Masa aktif langganan bulanan Anda telah berakhir dan telah melewati masa toleransi jatuh tempo pembayaran. Untuk mengaktifkan kembali akses pembuatan dan pengelolaan invoice, silakan hubungi administrator.
          </p>

          <div className="border-t border-slate-100 pt-5 space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kontak Konfirmasi Pembayaran</p>
            <a 
              href="https://wa.me/6281324003413?text=Halo%20Admin,%20saya%20ingin%20perpanjang%20langganan%20bulanan%20aplikasi%20HotelFlow%20untuk%20email:%20"
              target="_blank"
              rel="noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              Konfirmasi Perpanjangan via WhatsApp
            </a>

            <button 
              onClick={onLogout}
              className="text-slate-400 text-xs font-bold hover:text-rose-500 transition-colors uppercase tracking-wider block w-full py-1"
            >
              Keluar Akun
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
